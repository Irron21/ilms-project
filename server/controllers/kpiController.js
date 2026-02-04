const db = require('../config/db');
const xlsx = require('xlsx');
const fs = require('fs');
const logActivity = require('../utils/activityLogger');
const { clearCache } = require('../utils/cacheHelper');

// 1. UPLOAD REPORT
exports.uploadKPIReport = (req, res) => {
    const adminID = req.user ? req.user.userID : 1; 
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const cleanup = () => {
        try {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (err) { console.error("Warning:", err.message); }
    };

    // 1. STRICT Filename Validation
    const fileName = req.file.originalname;
    const filenameRegex = /^KPI_K2MAC_(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)_(\d{4})\.xlsx$/i;
    const match = fileName.match(filenameRegex);

    if (!match) {
        cleanup();
        return res.status(400).json({ 
            error: "Invalid filename format. Expected: KPI_K2MAC_[MONTH]_[YEAR].xlsx (e.g., KPI_K2MAC_DECEMBER_2026.xlsx)" 
        });
    }

    const detectedMonth = match[1].toUpperCase();
    const detectedYear = parseInt(match[2]);

    try {
        const workbook = xlsx.readFile(req.file.path);
        
        // 2. Sheet Detection (Try 'K2MAC', then 'KPI', then first sheet)
        let summarySheet = workbook.Sheets['K2MAC'];
        if (!summarySheet) summarySheet = workbook.Sheets['KPI'];
        if (!summarySheet) summarySheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!summarySheet) {
            cleanup(); 
            return res.status(400).json({ error: "No valid sheet found. Please check your Excel file." });
        }

        const data = xlsx.utils.sheet_to_json(summarySheet, { header: 1 });

        // 3. Layout Validation
        const rowStrings = data.map(row => (row || []).join(" ").toUpperCase());
        
        const hasSummary = rowStrings.some(s => s.includes("SUMMARY"));
        const hasTotalShipments = rowStrings.some(s => s.includes("TOTAL NO") && s.includes("SHIPMENTS"));
        const hasReasonOfDelay = rowStrings.some(s => s.includes("REASON OF DELAY"));
        const hasActionTaken = rowStrings.some(s => s.includes("ACTION TAKEN"));

        if (!hasSummary || !hasTotalShipments || !hasReasonOfDelay || !hasActionTaken) {
            cleanup();
            return res.status(400).json({ 
                error: "Invalid Table Layout. Missing required sections: 'SUMMARY', 'Total no of shipments', 'Reason of Delay', or 'Action Taken'." 
            });
        }

        // 4. Score Parsing
        // Find the row that starts with "Total no of shipments"
        let scoreRow = null;
        const dataRowIndex = data.findIndex(row => 
            row[0] && row[0].toString().toLowerCase().includes("total no") && row[0].toString().toLowerCase().includes("shipments")
        );

        if (dataRowIndex !== -1) {
            scoreRow = data[dataRowIndex];
        }

        if (!scoreRow) {
            cleanup();
            return res.status(400).json({ error: "Could not locate the 'Total no of shipments' data row." });
        }

        const parseScore = (val) => {
            if (!val) return 0.00;
            let num = parseFloat(val);
            if (isNaN(num)) return 0.00;
            // Handle percentages (0.9 vs 90)
            let final = num <= 1.0 ? num * 100 : num;
            return parseFloat((Math.round(final * 100) / 100).toFixed(2));
        };

        // Col 3: Booking, Col 6: Truck, Col 9: CallTime, Col 12: DOT, Col 15: Delivery, Col 18: POD
        // Note: scoreRow indices are 0-based. Col D is index 3.
        const metrics = {
            booking:  parseScore(scoreRow[3]),
            truck:    parseScore(scoreRow[6]),
            calltime: parseScore(scoreRow[9]),
            dot:      parseScore(scoreRow[12]),
            delivery: parseScore(scoreRow[15]),
            pod:      parseScore(scoreRow[18])
        };

        // 4. Failure Reasons Extraction 
        // Search for "REASON OF DELAY" header
        let reasonStartRowIndex = data.findIndex(row => 
            row.join(" ").toUpperCase().includes('REASON OF DELAY')
        );

        const failureReasons = [];
        if (reasonStartRowIndex !== -1) {
            const ranges = [
                { category: 'Booking', start: 0, end: 2 },
                { category: 'Truck', start: 3, end: 5 },
                { category: 'CallTime', start: 6, end: 8 },
                { category: 'DOT', start: 9, end: 11 },
                { category: 'Delivery', start: 12, end: 14 },
                { category: 'POD', start: 15, end: 19 }
            ];
            
            // Scan rows below "Reason of Delay" until "Action Taken" or end
            for (let i = reasonStartRowIndex + 1; i < data.length; i++) {
                const row = data[i];
                if (!row) continue;
                const firstCell = row[0] ? row[0].toString().toLowerCase() : "";
                if (firstCell.includes('action') || firstCell.includes('recommendation')) break;

                ranges.forEach(range => {
                    for (let col = range.start; col <= range.end; col++) {
                        if (row[col]) {
                            let text = row[col].toString().trim();
                            // Clean up "1. ", "2. ", etc.
                            const cleanText = text.replace(/^[\d\.\-\•]+\s*/, ''); 
                            
                            // Filter out "Reason of delay" repetitions or empty/short strings
                            if (cleanText.length > 3 && isNaN(parseFloat(cleanText)) && !cleanText.toUpperCase().includes('REASON')) {
                                failureReasons.push({ category: range.category, reason: cleanText });
                                // Only extract one reason per category per row to avoid duplicates if merged
                                break; 
                            }
                        }
                    }
                });
            }
        }

        // 5. Database Operation
        const reportDate = new Date(`${detectedMonth} 1, ${detectedYear}`); 
        
        // Delete existing report for this Month/Year (Overwrite)
        const deleteSql = "DELETE FROM KPI_Monthly_Reports WHERE MONTH(reportMonth) = ? AND YEAR(reportMonth) = ?";

        db.query(deleteSql, [reportDate.getMonth() + 1, reportDate.getFullYear()], (delErr) => {
            if (delErr) {
                cleanup();
                console.error("DB Delete Error:", delErr);
                return res.status(500).json({ error: "Database error during cleanup: " + delErr.message });
            }

            const insertSql = `
                INSERT INTO KPI_Monthly_Reports 
                (reportMonth, scoreBooking, scoreTruck, scoreCalltime, scoreDOT, scoreDelivery, scorePOD, rawFailureData)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const values = [
                reportDate, metrics.booking, metrics.truck, metrics.calltime, 
                metrics.dot, metrics.delivery, metrics.pod, JSON.stringify(failureReasons)
            ];

            db.query(insertSql, values, (err, result) => {
                cleanup();
                
                if (err) {
                    console.error("DB Error:", err);
                    return res.status(500).json({ error: "Database error: " + err.message });
                }
                
                const logDetails = `Uploaded KPI Report - ${detectedMonth} ${detectedYear} [ID: ${result.insertId}]`;
                logActivity(adminID, 'UPLOAD_KPI_REPORT', logDetails, async () => {
                    await clearCache('cache:/api/kpi*'); // Clear Cache
                    res.json({ 
                        message: "Success", 
                        scores: metrics,
                        reportMonth: reportDate.toISOString(),
                        year: detectedYear
                    });
                });
            });
        });

    } catch (e) {
        cleanup(); 
        console.error("Upload Error:", e);
        res.status(500).json({ error: "Processing Error: " + e.message });
    }
};

exports.getAvailableMonths = (req, res) => {
    const sql = "SELECT reportID, reportMonth FROM KPI_Monthly_Reports ORDER BY reportMonth DESC, reportID DESC";
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const reports = results.map(r => ({
            id: r.reportID,  
            value: new Date(r.reportMonth).toISOString(),
            label: new Date(r.reportMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            uploadedAt: 'Date Unknown'
        }));
        res.json(reports);
    });
};

// 3. GET DASHBOARD DATA (Filtered)
exports.getDashboardData = (req, res) => {
    const { month, year } = req.query; 
    const targetYear = year || new Date().getFullYear();

    // Get Trend Data FIRST (We need it for averages if month is missing)
    const trendSql = "SELECT * FROM KPI_Monthly_Reports WHERE YEAR(reportMonth) = ? ORDER BY reportMonth ASC";

    db.query(trendSql, [targetYear], (err, trendResults) => {
        if (err) return res.status(500).json({ error: err.message });

        // Format Trend Data
        const formattedTrend = trendResults.map(t => {
            let failures = [];
            if (typeof t.rawFailureData === 'string') {
                try { failures = JSON.parse(t.rawFailureData); } catch(e) {}
            } else if (Array.isArray(t.rawFailureData)) {
                failures = t.rawFailureData;
            }

            return {
                month: new Date(t.reportMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                fullDate: t.reportMonth,
                Booking: t.scoreBooking,
                Truck: t.scoreTruck,
                CallTime: t.scoreCalltime,
                DOT: t.scoreDOT,
                Delivery: t.scoreDelivery,
                POD: t.scorePOD,
                failures: failures
            };
        });

        // Determine Anchor Report (Scorecards)
        let anchorReport = null;
        let selectedMonthLabel = `Yearly Average (${targetYear})`;

        const calculateAverage = (reports) => {
            if (!reports.length) return null;
            const sums = { Booking: 0, Truck: 0, Calltime: 0, DOT: 0, Delivery: 0, POD: 0 };
            const count = reports.length;
        
            reports.forEach(r => {
                sums.Booking += parseFloat(r.scoreBooking || 0);
                sums.Truck += parseFloat(r.scoreTruck || 0);
                sums.Calltime += parseFloat(r.scoreCalltime || 0);
                sums.DOT += parseFloat(r.scoreDOT || 0);
                sums.Delivery += parseFloat(r.scoreDelivery || 0);
                sums.POD += parseFloat(r.scorePOD || 0);
            });
        
            return {
                scoreBooking: (sums.Booking / count).toFixed(2),
                scoreTruck: (sums.Truck / count).toFixed(2),
                scoreCalltime: (sums.Calltime / count).toFixed(2),
                scoreDOT: (sums.DOT / count).toFixed(2),
                scoreDelivery: (sums.Delivery / count).toFixed(2),
                scorePOD: (sums.POD / count).toFixed(2)
            };
        };

        if (month) {
            if (['Q1', 'Q2', 'Q3', 'Q4'].includes(month)) {
                // Quarterly Average Logic
                const quarterMap = {
                    'Q1': [0, 1, 2], // Jan, Feb, Mar
                    'Q2': [3, 4, 5], // Apr, May, Jun
                    'Q3': [6, 7, 8], // Jul, Aug, Sep
                    'Q4': [9, 10, 11] // Oct, Nov, Dec
                };
                const targetMonths = quarterMap[month];

                const quarterReports = trendResults.filter(r => 
                    targetMonths.includes(new Date(r.reportMonth).getMonth())
                );

                if (quarterReports.length > 0) {
                    anchorReport = calculateAverage(quarterReports);
                    selectedMonthLabel = `${month} Average (${targetYear})`;
                } else {
                    selectedMonthLabel = `${month} - No Data`;
                }

            } else {
                // Case A: Specific Month Selected
                const match = trendResults.find(r => 
                    new Date(r.reportMonth).toISOString().slice(0, 7) === new Date(month).toISOString().slice(0, 7)
                );
                
                if (match) {
                    anchorReport = match;
                    selectedMonthLabel = new Date(anchorReport.reportMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                } else {
                    selectedMonthLabel = "Data Not Available";
                }
            }
        } else {
            // Case B: "Latest / All" (Yearly Average)
            if (trendResults.length > 0) {
                anchorReport = calculateAverage(trendResults);
            }
        }

        const formatScore = (val) => Number(val || 0).toFixed(2);

        res.json({
            latestScores: anchorReport ? [
                { title: 'Booking', score: formatScore(anchorReport.scoreBooking), status: getStatus(anchorReport.scoreBooking) },
                { title: 'Truck Availability', score: formatScore(anchorReport.scoreTruck), status: getStatus(anchorReport.scoreTruck) },
                { title: 'Call Time', score: formatScore(anchorReport.scoreCalltime), status: getStatus(anchorReport.scoreCalltime) },
                { title: 'DOT Compliance', score: formatScore(anchorReport.scoreDOT), status: getStatus(anchorReport.scoreDOT) },
                { title: 'Delivery', score: formatScore(anchorReport.scoreDelivery), status: getStatus(anchorReport.scoreDelivery) },
                { title: 'POD Submission', score: formatScore(anchorReport.scorePOD), status: getStatus(anchorReport.scorePOD) },
            ] : [],
            selectedMonthLabel: selectedMonthLabel,
            trendData: formattedTrend 
        });
    });
};

// Delete Report (Hard Delete)
exports.deleteReport = (req, res) => {
    const { id } = req.body;
    const adminID = req.user ? req.user.userID : 1; 

    if (!id) return res.status(400).json({ error: "Report ID required" });

    const sql = "DELETE FROM KPI_Monthly_Reports WHERE reportID = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Report not found or already deleted" });
        }

        const logDetails = `Deleted KPI Report - [ID: ${id}]`;
        logActivity(adminID, 'DELETE_KPI_REPORT', logDetails, async () => {
             await clearCache('cache:/api/kpi*'); // Clear Cache
             console.log("Report deleted successfully");
             res.json({ message: "Report deleted permanently" });
        });
    });
};

function getStatus(score) {
    if (score >= 95) return 'good';
    if (score >= 90) return 'warning';
    return 'danger';
}
const db = require('../config/db');
const xlsx = require('xlsx');
const fs = require('fs');
const logActivity = require('../utils/activityLogger');

// 1. UPLOAD REPORT
exports.uploadKPIReport = (req, res) => {
    const adminID = req.user ? req.user.userID : 1; 

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const cleanup = () => {
        try {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (err) { console.error("Warning:", err.message); }
    };

    try {
        const workbook = xlsx.readFile(req.file.path);
        
        // 1. Sheet Detection (Try 'K2MAC', then 'KPI', then first sheet)
        let summarySheet = workbook.Sheets['K2MAC'];
        if (!summarySheet) summarySheet = workbook.Sheets['KPI'];
        if (!summarySheet) summarySheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!summarySheet) {
            cleanup(); 
            return res.status(400).json({ error: "No valid sheet found. Please check your Excel file." });
        }

        const data = xlsx.utils.sheet_to_json(summarySheet, { header: 1 });
        const fileName = req.file.originalname.toUpperCase();

        // 2. ROBUST Date Detection
        // List of months for matching
        const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
        
        let detectedMonth = null;
        let detectedYear = null; 

        // A. Try Filename first
        months.forEach(m => { if (fileName.includes(m)) detectedMonth = m; });
        const yearMatchFilename = fileName.match(/202[0-9]/);
        if (yearMatchFilename) detectedYear = parseInt(yearMatchFilename[0]);

        // B. Try Content scan (First 20 rows) if missing
        if (!detectedMonth || !detectedYear) {
            for (let i = 0; i < Math.min(data.length, 20); i++) {
                const rowStr = (data[i] || []).join(" ").toUpperCase();
                
                // Find Month
                if (!detectedMonth) {
                    months.forEach(m => { 
                        // Check if row starts with Month OR contains "Month: AUGUST" pattern
                        if (rowStr.includes(m)) detectedMonth = m; 
                    });
                }

                // Find Year (Look for 2023, 2024, etc.)
                if (!detectedYear) {
                    const yearMatchContent = rowStr.match(/202[0-9]/);
                    if (yearMatchContent) detectedYear = parseInt(yearMatchContent[0]);
                }
            }
        }

        if (!detectedMonth || !detectedYear) {
            cleanup();
            const msg = `Upload Failed. Found Month: ${detectedMonth || 'None'}, Year: ${detectedYear || 'None'}`;
            return res.status(400).json({ error: "Date Detection Failed. Please ensure the Month and Year (e.g., 2025) are visible in the filename or the top rows of the sheet." });
        }

        // 3. ROBUST Score Parsing
        // Instead of relying on fixed rows, search for the specific label "Total no of shipments"
        let scoreRow = null;
        
        // Find the row that starts with "Total no of shipments"
        const dataRowIndex = data.findIndex(row => 
            row[0] && row[0].toString().toLowerCase().includes("total no") && row[0].toString().toLowerCase().includes("shipments")
        );

        if (dataRowIndex !== -1) {
            scoreRow = data[dataRowIndex];
        } else {
            // Fallback: Try to find a row below the Month Name row
            const monthRowIndex = data.findIndex(row => row[0] && row[0].toString().toUpperCase() === detectedMonth);
            if (monthRowIndex !== -1 && data[monthRowIndex + 1]) {
                scoreRow = data[monthRowIndex + 1];
            }
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

        // Based on the CSV provided:
        // Col 3: Booking, Col 6: Truck, Col 9: CallTime, Col 12: DOT, Col 15: Delivery, Col 18: POD
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

        db.query(deleteSql, [reportDate.getMonth() + 1, reportDate.getFullYear()], () => {
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
                logActivity(adminID, 'UPLOAD_KPI_REPORT', logDetails, () => {
                    res.json({ message: "Success", scores: metrics });
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

    // Get the "Anchor" Report (Score Cards) 
    let anchorSql = "SELECT * FROM KPI_Monthly_Reports ORDER BY reportMonth DESC LIMIT 1";
    let anchorParams = [];

    if (month) {
        anchorSql = "SELECT * FROM KPI_Monthly_Reports WHERE reportMonth = ? LIMIT 1";
        anchorParams = [new Date(month)]; 
    }

    db.query(anchorSql, anchorParams, (err, anchorResults) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const anchorReport = anchorResults.length > 0 ? anchorResults[0] : null;

        // Get Trend Data (Filtered by Selected Year)
        const targetYear = year || new Date().getFullYear();
        
        const trendSql = "SELECT * FROM KPI_Monthly_Reports WHERE YEAR(reportMonth) = ? ORDER BY reportMonth ASC";

        db.query(trendSql, [targetYear], (err2, trendResults) => {
             if (err2) return res.status(500).json({ error: err2.message });

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
                selectedMonthLabel: anchorReport ? new Date(anchorReport.reportMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "No Data",
                trendData: formattedTrend 
             });
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
        logActivity(adminID, 'DELETE_KPI_REPORT', logDetails, () => {
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
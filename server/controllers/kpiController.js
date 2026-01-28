const db = require('../config/db');
const xlsx = require('xlsx');
const fs = require('fs');

// 1. UPLOAD REPORT
exports.uploadKPIReport = (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        const workbook = xlsx.readFile(req.file.path);

        let summarySheet = workbook.Sheets['K2MAC'];
        
        if (!summarySheet) {
            console.log("Sheet 'K2MAC' not found. Switching to first available sheet.");
            const firstSheetName = workbook.SheetNames[0];
            summarySheet = workbook.Sheets[firstSheetName];
        }

        if (!summarySheet) return res.status(400).json({ error: "No valid sheet found in file." });
        
        const data = xlsx.utils.sheet_to_json(summarySheet, { header: 1 });
        const fileName = req.file.originalname.toUpperCase();
        console.log(`Processing: ${fileName}`);

        // A. DATE DETECTION
        let detectedMonth = null;
        let detectedYear = 2025;
        const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

        months.forEach(m => { if (fileName.includes(m)) detectedMonth = m; });
        const yearMatch = fileName.match(/202[0-9]/);
        if (yearMatch) detectedYear = parseInt(yearMatch[0]);

        if (!detectedMonth) {
            data.forEach(row => {
                if (row[0] && months.includes(row[0].toString().toUpperCase())) {
                    detectedMonth = row[0].toString().toUpperCase();
                }
            });
        }
        
        // B. SCORE EXTRACTION
        let targetRowIndex = -1;
        data.forEach((row, index) => {
            if (row[0] && months.includes(row[0].toString().toUpperCase())) {
                targetRowIndex = index;
            }
        });

        if (targetRowIndex !== -1) {
            if (isNaN(parseFloat(data[targetRowIndex][3]))) targetRowIndex++;
        } else {
            targetRowIndex = 4; 
        }

        const scoreRow = data[targetRowIndex] || [];

        const parseScore = (val) => {
            if (!val) return 0.00;
            let num = parseFloat(val);
            if (isNaN(num)) return 0.00;

            let final = num <= 1 ? num * 100 : num;

            return parseFloat((Math.round(final * 100) / 100).toFixed(2));
        };

        const metrics = {
            booking:  parseScore(scoreRow[3]),
            truck:    parseScore(scoreRow[6]),
            calltime: parseScore(scoreRow[9]),
            dot:      parseScore(scoreRow[12]),
            delivery: parseScore(scoreRow[15]),
            pod:      parseScore(scoreRow[18])
        };

        // C. FAILURE REASONS
        let reasonStartRowIndex = -1;
        data.forEach((row, index) => {
            const rowStr = row.join(" ").toUpperCase();
            if (rowStr.includes('REASON OF DELAY')) reasonStartRowIndex = index;
        });

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

            for (let i = reasonStartRowIndex + 1; i < data.length; i++) {
                const row = data[i];
                if (!row) continue;
                const firstCell = row[0] ? row[0].toString().toLowerCase() : "";
                if (firstCell.includes('action') || firstCell.includes('recommendation')) break;

                ranges.forEach(range => {
                    for (let col = range.start; col <= range.end; col++) {
                        if (row[col]) {
                            let text = row[col].toString().trim();
                            const cleanText = text.replace(/^[\d\.\-\•]+\s*/, ''); 
                            if (cleanText.length > 3 && isNaN(parseFloat(cleanText)) && !cleanText.toUpperCase().includes('REASON')) {
                                failureReasons.push({ category: range.category, reason: cleanText });
                                break; 
                            }
                        }
                    }
                });
            }
        }

        // D. SAVE TO DB
        const reportDate = new Date(`${detectedMonth || 'NOVEMBER'} 1, ${detectedYear}`);
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
                if (err) return res.status(500).json({ error: err.message });
                console.log(`Saved ${detectedMonth} ${detectedYear}`);
                res.json({ message: "Success", scores: metrics });
            });
        });

        fs.unlinkSync(req.file.path);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getAvailableMonths = (req, res) => {
    const sql = "SELECT reportID, reportMonth FROM KPI_Monthly_Reports ORDER BY reportMonth DESC, reportID DESC";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Database Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        
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
    const { month } = req.query;

    let latestSql = "SELECT * FROM KPI_Monthly_Reports ORDER BY reportMonth DESC LIMIT 1";
    let params = [];

    if (month) {
        latestSql = "SELECT * FROM KPI_Monthly_Reports WHERE reportMonth = ? LIMIT 1";
        params = [new Date(month)]; 
    }

    const trendSql = "SELECT * FROM KPI_Monthly_Reports ORDER BY reportMonth ASC LIMIT 6";

    db.query(latestSql, params, (err, latestResults) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const row = latestResults.length > 0 ? latestResults[0] : null;

        db.query(trendSql, (err2, trendResults) => {
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
                latestScores: row ? [
                    { title: 'Booking', score: formatScore(row.scoreBooking), status: getStatus(row.scoreBooking) },
                    { title: 'Truck Availability', score: formatScore(row.scoreTruck), status: getStatus(row.scoreTruck) },
                    { title: 'Call Time', score: formatScore(row.scoreCalltime), status: getStatus(row.scoreCalltime) },
                    { title: 'DOT Compliance', score: formatScore(row.scoreDOT), status: getStatus(row.scoreDOT) },
                    { title: 'Delivery', score: formatScore(row.scoreDelivery), status: getStatus(row.scoreDelivery) },
                    { title: 'POD Submission', score: formatScore(row.scorePOD), status: getStatus(row.scorePOD) },
                ] : [],
                selectedMonthLabel: row ? new Date(row.reportMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "No Data",
                trendData: formattedTrend
             });
        });
    });
};

// Delete Report (Hard Delete)
exports.deleteReport = (req, res) => {
    const { id } = req.body;

    if (!id) {
        console.error("Delete Request Failed: No ID provided");
        return res.status(400).json({ error: "Report ID required" });
    }

    console.log(`Attempting to delete report ID: ${id}`);

    const sql = "DELETE FROM KPI_Monthly_Reports WHERE reportID = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Database Error during delete:", err.message);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Report not found or already deleted" });
        }

        console.log("Report deleted successfully");
        res.json({ message: "Report deleted permanently" });
    });
};

function getStatus(score) {
    if (score >= 95) return 'good';
    if (score >= 90) return 'warning';
    return 'danger';
}
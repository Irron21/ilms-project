const db = require('../config/db');

// ✅ NEW: Fetch distinct action types for the dropdown
exports.getLogActions = (req, res) => {
    const sql = "SELECT DISTINCT actionType FROM UserActivityLog ORDER BY actionType ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        // Return simple array: ['LOGIN', 'LOGOUT', ...]
        res.json(results.map(r => r.actionType));
    });
};

// ✅ UPDATED: Fetch Logs with Year/Month Filtering
exports.getActivityLogs = (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Extract Filters & Sort
    const { action, role, year, month, order } = req.query;

    // Determine Sort Direction (Default to DESC / Newest First)
    const sortDirection = (order && order.toLowerCase() === 'asc') ? 'ASC' : 'DESC';

    // 1. Build Dynamic WHERE Clause
    let whereClauses = [];
    let queryParams = [];

    if (action && action !== 'All') {
        whereClauses.push("l.actionType = ?");
        queryParams.push(action);
    }

    if (role && role !== 'All') {
        if (role === 'System') {
            whereClauses.push("u.role IS NULL");
        } else {
            whereClauses.push("u.role = ?");
            queryParams.push(role);
        }
    }

    if (year && year !== 'All') {
        whereClauses.push("YEAR(l.timestamp) = ?");
        queryParams.push(year);
    }

    if (month && month !== 'All') {
        whereClauses.push("MONTH(l.timestamp) = ?");
        queryParams.push(month);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 2. Get Total Count
    const countSql = `
        SELECT COUNT(*) as total 
        FROM UserActivityLog l
        LEFT JOIN Users u ON l.userID = u.userID
        ${whereSql}
    `;
    
    db.query(countSql, queryParams, (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        // 3. Get Actual Data with DYNAMIC SORT
        const sql = `
            SELECT 
                l.logID, 
                l.actionType, 
                l.details, 
                l.timestamp, 
                u.firstName, 
                u.lastName, 
                u.role
            FROM UserActivityLog l
            LEFT JOIN Users u ON l.userID = u.userID
            ${whereSql}
            ORDER BY l.timestamp ${sortDirection}
            LIMIT ? OFFSET ?
        `;

        const finalParams = [...queryParams, limit, offset];

        db.query(sql, finalParams, (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
                data: results,
                pagination: {
                    totalItems,
                    totalPages,
                    currentPage: page,
                    itemsPerPage: limit
                }
            });
        });
    });
};
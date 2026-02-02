const db = require('../config/db');

const indexes = [
    // Shipments
    {
        table: 'Shipments',
        name: 'idx_shipment_archive_load',
        cols: ['isArchived', 'loadingDate'],
        description: 'Optimizes main shipment view filtering and sorting'
    },
    {
        table: 'Shipments',
        name: 'idx_shipment_creation',
        cols: ['creationTimestamp'],
        description: 'Optimizes date range filtering for exports'
    },
    {
        table: 'Shipments',
        name: 'idx_shipment_status',
        cols: ['currentStatus'],
        description: 'Optimizes filtering by status'
    },
    // Users
    {
        table: 'Users',
        name: 'idx_user_role_archived',
        cols: ['role', 'isArchived'],
        description: 'Optimizes fetching drivers and helpers'
    },
    // Vehicles
    {
        table: 'Vehicles',
        name: 'idx_vehicle_status_archived',
        cols: ['status', 'isArchived'],
        description: 'Optimizes fetching working vehicles'
    },
    // ShipmentCrew
    {
        table: 'ShipmentCrew',
        name: 'idx_crew_role',
        cols: ['role'],
        description: 'Optimizes joining crew members by role'
    },
    // PayrollRates
    {
        table: 'PayrollRates',
        name: 'idx_rates_lookup',
        cols: ['routeCluster', 'vehicleType'],
        description: 'Optimizes rate lookups'
    },
    // PayrollPeriods
    {
        table: 'PayrollPeriods',
        name: 'idx_period_status',
        cols: ['status'],
        description: 'Optimizes fetching open/closed periods'
    }
];

const run = async () => {
    console.log('Starting Database Optimization...');
    
    let appliedCount = 0;
    let skippedCount = 0;

    for (const idx of indexes) {
        const checkSql = `
            SELECT COUNT(1) as exists_count
            FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name = ? 
            AND index_name = ?
        `;

        try {
            const [rows] = await db.promise().query(checkSql, [idx.table, idx.name]);
            
            if (rows[0].exists_count > 0) {
                console.log(`⚠️Skipping ${idx.name} on ${idx.table} (Already exists)`);
                skippedCount++;
            } else {
                const alterSql = `CREATE INDEX ${idx.name} ON ${idx.table} (${idx.cols.join(', ')})`;
                await db.promise().query(alterSql);
                console.log(`Applied ${idx.name} on ${idx.table} - ${idx.description}`);
                appliedCount++;
            }
        } catch (error) {
            console.error(`Error processing ${idx.name}:`, error.message);
        }
    }

    console.log('\n==========================================');
    console.log(`Optimization Complete!`);
    console.log(`Indexes Applied: ${appliedCount}`);
    console.log(`Indexes Skipped: ${skippedCount}`);
    console.log('==========================================');
    
    process.exit(0);
};

run();

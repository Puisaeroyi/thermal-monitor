const { Client } = require('pg');

async function check() {
    const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5434/thermal_monitor" });
    try {
        await client.connect();

        // 1. Check cameras in Docker DB
        const camRes = await client.query("SELECT camera_id, name, ip_address, status FROM cameras ORDER BY created_at;");
        console.log('=== ALL CAMERAS IN DOCKER DB ===');
        camRes.rows.forEach(r => console.log(JSON.stringify(r)));

        // 2. Check today's readings for TNO-real
        const readingRes = await client.query(`
      SELECT COUNT(*) as total_readings, 
             MIN(celsius) as min_c, MAX(celsius) as max_c, AVG(celsius)::numeric(5,1) as avg_c,
             MIN(timestamp) as first_ts, MAX(timestamp) as last_ts
      FROM readings
      WHERE camera_id = 'cam-1772851032940'
        AND timestamp >= NOW() - INTERVAL '24 hours';
    `);
        console.log('\n=== TNO-REAL READINGS (last 24h) ===');
        console.log(JSON.stringify(readingRes.rows[0]));
    } finally {
        await client.end();
    }
}
check().catch(console.error);

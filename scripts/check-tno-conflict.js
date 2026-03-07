const { Client } = require('pg');

async function check() {
    const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5434/thermal_monitor" });
    try {
        await client.connect();

        // Find all cameras with TNO in name OR that have that IP address
        const res = await client.query(`
      SELECT camera_id, name, ip_address, status, group_id, created_at
      FROM cameras
      WHERE name ILIKE '%TNO%' OR ip_address = '10.10.10.163'
      ORDER BY created_at;
    `);

        console.log('=== Cameras matching TNO or IP 10.10.10.163 ===');
        res.rows.forEach(r => console.log(JSON.stringify(r)));
        console.log(`Total: ${res.rows.length}`);
    } finally {
        await client.end();
    }
}
check().catch(console.error);

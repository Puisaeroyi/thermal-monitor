const { Client } = require('pg');

async function fixStatus() {
    const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5434/thermal_monitor" });
    try {
        await client.connect();
        const r = await client.query("UPDATE cameras SET status = 'ACTIVE' WHERE camera_id = 'cam-1772851032940';");
        console.log('Set to ACTIVE. Rows updated:', r.rowCount);
        const check = await client.query("SELECT camera_id, name, status, username, password FROM cameras WHERE camera_id = 'cam-1772851032940';");
        console.log('Current state:', JSON.stringify(check.rows[0]));
    } finally {
        await client.end();
    }
}

fixStatus().catch(console.error);

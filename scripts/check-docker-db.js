const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function check() {
    const client = new Client({
        // Hardcode port 5434 to check the Dockerized DB
        connectionString: "postgresql://postgres:postgres@localhost:5434/thermal_monitor"
    });

    try {
        await client.connect();
        const res = await client.query("SELECT camera_id, name FROM cameras WHERE name ILIKE '%TNO%' OR camera_id ILIKE '%TNO%';");
        console.log('--- FOUND TNO CAMERAS ON PORT 5434 ---');
        res.rows.forEach(r => console.log(JSON.stringify(r)));
        console.log('--------------------------------------');
    } catch (err) {
        console.error('Failed to connect to port 5434:', err.message);
    } finally {
        await client.end();
    }
}

check().catch(console.error);

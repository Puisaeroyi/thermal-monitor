const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function check() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    await client.connect();
    const res = await client.query("SELECT camera_id, name FROM cameras WHERE name ILIKE '%TNO%' OR camera_id ILIKE '%TNO%';");
    console.log('--- ALL MATCHING CAMERAS ---');
    res.rows.forEach(r => console.log(JSON.stringify(r)));
    console.log('----------------------------');
    await client.end();
}

check().catch(console.error);

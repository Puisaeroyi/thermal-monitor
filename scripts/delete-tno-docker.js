const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function deleteTNO() {
    const client = new Client({
        connectionString: "postgresql://postgres:postgres@localhost:5434/thermal_monitor"
    });

    try {
        await client.connect();
        console.log('Connecting to Dockerized PostgreSQL on port 5434...');

        const res = await client.query("SELECT camera_id, name FROM cameras WHERE name ILIKE '%TNO%' OR camera_id ILIKE '%TNO%';");
        if (res.rows.length === 0) {
            console.log('No cameras matching TNO found in this DB.');
            return;
        }

        const ids = res.rows.map(r => r.camera_id);
        console.log(`Found ${res.rows.length} cameras to delete: ${ids.join(', ')}`);

        // Use raw queries for cascading or just delete in order
        await client.query("DELETE FROM readings WHERE camera_id = ANY($1);", [ids]);
        await client.query("DELETE FROM alerts WHERE camera_id = ANY($1);", [ids]);
        await client.query("DELETE FROM camera_pins WHERE camera_id = ANY($1);", [ids]);
        const delRes = await client.query("DELETE FROM cameras WHERE camera_id = ANY($1);", [ids]);

        console.log(`Successfully deleted ${delRes.rowCount} cameras and related data from Docker database.`);
    } catch (err) {
        console.error('Error during deletion:', err.message);
    } finally {
        await client.end();
    }
}

deleteTNO().catch(console.error);

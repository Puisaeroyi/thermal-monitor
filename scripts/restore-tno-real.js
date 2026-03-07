const { Client } = require('pg');

const DOCKER_DB_URL = "postgresql://postgres:postgres@localhost:5434/thermal_monitor";

async function restore() {
    const client = new Client({ connectionString: DOCKER_DB_URL });

    try {
        await client.connect();
        console.log('Connected to Docker DB (port 5434)');

        // 1. Ensure the HQ group exists
        const groupRes = await client.query(
            "SELECT id FROM groups WHERE id = 'hq' LIMIT 1;"
        );
        if (groupRes.rows.length === 0) {
            await client.query(
                "INSERT INTO groups (id, name, color, created_at, updated_at) VALUES ('hq', 'HQ', '#6b7280', NOW(), NOW()) ON CONFLICT DO NOTHING;"
            );
            console.log("Created 'hq' group.");
        } else {
            console.log("'hq' group already exists.");
        }

        // 2. Re-insert the TNO-real camera with its original IP
        // Using ON CONFLICT so it's idempotent
        await client.query(`
      INSERT INTO cameras (camera_id, name, location, status, group_id, ip_address, port, username, password, model_name, created_at, updated_at)
      VALUES ('cam-1772851032940', 'TNO-real', 'Floor 1', 'ACTIVE', 'hq', '10.10.10.163', 80, 'admin', NULL, 'TNO-4030TR', NOW(), NOW())
      ON CONFLICT (camera_id) DO UPDATE
        SET name = EXCLUDED.name,
            ip_address = EXCLUDED.ip_address,
            status = EXCLUDED.status;
    `);
        console.log("Camera 'TNO-real' restored to database.");

        // 3. Verify
        const check = await client.query(
            "SELECT camera_id, name, ip_address, status FROM cameras WHERE camera_id = 'cam-1772851032940';"
        );
        console.log('Verification:', JSON.stringify(check.rows[0]));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

restore().catch(console.error);

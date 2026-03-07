const { Client } = require('pg');

async function fixPassword() {
    const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5434/thermal_monitor" });
    try {
        await client.connect();

        // Check current camera record
        const check = await client.query(
            "SELECT camera_id, name, username, password FROM cameras WHERE camera_id = 'cam-1772851032940';"
        );
        console.log('Current record:', JSON.stringify(check.rows[0]));

        // The Python collector checks: if password doesn't start with "enc:v1:", it uses it as plaintext.
        // So inserting plaintext is safe and backward-compatible.
        await client.query(
            "UPDATE cameras SET username = 'admin', password = '1qaz!QAZ' WHERE camera_id = 'cam-1772851032940';"
        );

        const verify = await client.query(
            "SELECT camera_id, name, username, password FROM cameras WHERE camera_id = 'cam-1772851032940';"
        );
        console.log('Updated record:', JSON.stringify(verify.rows[0]));
    } finally {
        await client.end();
    }
}

fixPassword().catch(console.error);

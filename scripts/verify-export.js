const { Client } = require('pg');

const DOCKER_DB = "postgresql://postgres:postgres@localhost:5434/thermal_monitor";
const TZ = "America/New_York";

async function verify() {
    const client = new Client({ connectionString: DOCKER_DB });
    await client.connect();

    // Today in UTC
    const nowUtc = new Date();
    const todayUtc = nowUtc.toISOString().split("T")[0];

    console.log(`=== Export Verification ===`);
    console.log(`Current UTC time: ${nowUtc.toISOString()}`);
    console.log(`Testing date: ${todayUtc} (as seen in America/New_York)\n`);

    // 1. What does the stats API query produce for each camera?
    const statsQuery = await client.query(`
    SELECT
      camera_id,
      COUNT(*)                                           AS reading_count,
      AVG(celsius)::numeric(5,2)                        AS avg_c,
      MIN(COALESCE(min_celsius, celsius))::numeric(5,2) AS min_c,
      MAX(COALESCE(max_celsius, celsius))::numeric(5,2) AS max_c,
      MIN(timestamp AT TIME ZONE 'UTC' AT TIME ZONE $1) AS first_local,
      MAX(timestamp AT TIME ZONE 'UTC' AT TIME ZONE $1) AS last_local
    FROM readings
    WHERE (timestamp AT TIME ZONE 'UTC' AT TIME ZONE $1)::date = $2::date
    GROUP BY camera_id
    ORDER BY camera_id;
  `, [TZ, todayUtc]);

    console.log(`=== Cameras with readings on ${todayUtc} (EST) ===`);
    if (statsQuery.rows.length === 0) {
        console.log('  NO data found for today in EST timezone!');
        console.log('  Try checking yesterday...\n');

        // Check yesterday
        const yesterday = new Date(nowUtc);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const y = await client.query(`
      SELECT
        camera_id,
        COUNT(*) AS count,
        MIN(timestamp AT TIME ZONE 'UTC' AT TIME ZONE $1) AS first_local,
        MAX(timestamp AT TIME ZONE 'UTC' AT TIME ZONE $1) AS last_local
      FROM readings
      WHERE (timestamp AT TIME ZONE 'UTC' AT TIME ZONE $1)::date = $2::date
      GROUP BY camera_id
      ORDER BY camera_id
      LIMIT 5;
    `, [TZ, yesterdayStr]);

        console.log(`=== Sample cameras with readings on ${yesterdayStr} (EST) ===`);
        y.rows.forEach(r => console.log(`  ${r.camera_id}: ${r.count} readings, ${r.first_local} → ${r.last_local}`));
    } else {
        statsQuery.rows.forEach(r => {
            console.log(`  ${r.camera_id}: ${r.reading_count} readings | avg=${r.avg_c}°C min=${r.min_c}°C max=${r.max_c}°C`);
            console.log(`    Range: ${r.first_local} → ${r.last_local}`);
        });
    }

    // 2. Raw reading count per day for TNO-real
    console.log('\n=== TNO-Real readings by day (EST) ===');
    const tno = await client.query(`
    SELECT
      (timestamp AT TIME ZONE 'UTC' AT TIME ZONE $1)::date AS day_est,
      COUNT(*) AS count
    FROM readings
    WHERE camera_id = 'cam-1772851032940'
    GROUP BY 1
    ORDER BY 1 DESC;
  `, [TZ]);
    tno.rows.forEach(r => console.log(`  ${r.day_est}: ${r.count} readings`));

    // 3. All readings total
    const total = await client.query(`SELECT COUNT(*) as total FROM readings;`);
    console.log(`\nTotal readings in DB: ${total.rows[0].total}`);

    await client.end();
}

verify().catch(console.error);

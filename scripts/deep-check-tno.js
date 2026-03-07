const { Client } = require('pg');

const DOCKER_DB = "postgresql://postgres:postgres@localhost:5434/thermal_monitor";

async function deepCheck() {
    const client = new Client({ connectionString: DOCKER_DB });
    await client.connect();

    console.log('=== ALL Readings for TNO-real (sorted by timestamp) ===');
    const readings = await client.query(`
    SELECT
      id,
      celsius,
      max_celsius,
      min_celsius,
      timestamp AT TIME ZONE 'UTC' AS ts_utc
    FROM readings
    WHERE camera_id = 'cam-1772851032940'
    ORDER BY timestamp ASC;
  `);

    readings.rows.forEach(r => {
        console.log(`  [${r.ts_utc.toISOString()}] celsius=${r.celsius}  maxCelsius=${r.max_celsius}  minCelsius=${r.min_celsius}`);
    });

    console.log(`\nTotal readings: ${readings.rowCount}`);

    // Distribution
    console.log('\n=== Temperature distribution (celsius column) ===');
    const dist = await client.query(`
    SELECT celsius, COUNT(*) as cnt
    FROM readings
    WHERE camera_id = 'cam-1772851032940'
    GROUP BY celsius
    ORDER BY celsius;
  `);
    dist.rows.forEach(r => console.log(`  ${r.celsius}°C → ${r.cnt} readings`));

    // What the stats API computes
    console.log('\n=== What stats API returns (same query as /api/readings/stats) ===');
    const stats = await client.query(`
    SELECT
      AVG(celsius)::numeric(5,2)                        AS avg_temp,
      MIN(COALESCE(min_celsius, celsius))::numeric(5,2) AS min_temp,
      MAX(COALESCE(max_celsius, celsius))::numeric(5,2) AS max_temp,
      COUNT(*)                                          AS count
    FROM readings
    WHERE camera_id = 'cam-1772851032940'
      AND (timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date = '2026-03-07'::date;
  `);
    const s = stats.rows[0];
    console.log(`  avg=${s.avg_temp}°C  min=${s.min_temp}°C  max=${s.max_temp}°C  total=${s.count} readings`);

    // Check if min_celsius is ever populated
    const minCheck = await client.query(`
    SELECT COUNT(*) as with_min
    FROM readings
    WHERE camera_id = 'cam-1772851032940' AND min_celsius IS NOT NULL;
  `);
    console.log(`\n  Readings with minCelsius populated: ${minCheck.rows[0].with_min}`);

    const maxCheck = await client.query(`
    SELECT COUNT(*) as with_max
    FROM readings
    WHERE camera_id = 'cam-1772851032940' AND max_celsius IS NOT NULL;
  `);
    console.log(`  Readings with maxCelsius populated: ${maxCheck.rows[0].with_max}`);

    await client.end();
}

deepCheck().catch(console.error);

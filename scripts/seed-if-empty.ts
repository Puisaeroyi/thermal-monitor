import "dotenv/config";
import pg from "pg";

/** Only run the full seed if the cameras table is empty. */
async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query("SELECT count(*)::int AS n FROM cameras");
    if (res.rows[0].n > 0) {
      console.log(`DB already has ${res.rows[0].n} cameras — skipping seed.`);
      return;
    }
  } catch {
    // Table may not exist yet — run seed
  } finally {
    await client.end();
  }

  console.log("DB is empty — running initial seed...");
  const { execSync } = await import("child_process");
  execSync("npx tsx prisma/seed/seed.ts --clear --hours=24", { stdio: "inherit" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

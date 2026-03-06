import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ingestReadings } from "../src/services/reading-service";
import type { ReadingInput } from "../src/lib/validate";

const REPLAY_INTERVAL_MS = 60_000; // 60 seconds — matches real camera 1-min scan interval
const CCTV_CAMERA_IDS = ["CCTV-01", "CCTV-02", "CCTV-03"];

let running = true;

process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  running = false;
});

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    // Load all CCTV readings ordered by timestamp
    console.log("Loading CCTV readings from database...");
    const allReadings = await prisma.reading.findMany({
      where: { cameraId: { in: CCTV_CAMERA_IDS } },
      orderBy: { timestamp: "asc" },
      select: {
        id: true,
        cameraId: true,
        celsius: true,
        maxCelsius: true,
        minCelsius: true,
        timestamp: true,
      },
    });
    console.log(`Loaded ${allReadings.length} readings`);

    if (allReadings.length === 0) {
      console.log("No CCTV readings found. Run db:import-xlsx first.");
      return;
    }

    // Group by timestamp
    const byTimestamp = new Map<string, typeof allReadings>();
    for (const r of allReadings) {
      const key = r.timestamp.toISOString();
      if (!byTimestamp.has(key)) byTimestamp.set(key, []);
      byTimestamp.get(key)!.push(r);
    }

    const timestamps = [...byTimestamp.keys()].sort();
    console.log(`Replaying ${timestamps.length} timestamps at ${REPLAY_INTERVAL_MS}ms intervals`);
    console.log("Press Ctrl+C to stop.\n");

    let idx = 0;
    while (running && idx < timestamps.length) {
      const ts = timestamps[idx];
      const group = byTimestamp.get(ts)!;
      const now = new Date();

      const readings: ReadingInput[] = group.map((r) => ({
        cameraId: r.cameraId,
        celsius: r.celsius,
        ...(r.maxCelsius != null && { maxCelsius: r.maxCelsius }),
        ...(r.minCelsius != null && { minCelsius: r.minCelsius }),
        timestamp: now.toISOString(),
      }));

      await ingestReadings(readings);

      const avgTemp = readings.reduce((s, r) => s + r.celsius, 0) / readings.length;
      console.log(
        `[${now.toLocaleTimeString()}] Tick ${idx + 1}/${timestamps.length} — ` +
        `${readings.length} readings (avg: ${avgTemp.toFixed(1)}°C) — source: ${ts}`
      );

      idx++;
      if (running && idx < timestamps.length) {
        await new Promise((resolve) => setTimeout(resolve, REPLAY_INTERVAL_MS));
      }
    }

    console.log(running ? "Replay complete." : "Replay stopped.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

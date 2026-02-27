import "dotenv/config";
import { ingestReadings } from "../src/services/reading-service";
import type { ReadingInput } from "../src/lib/validate";
import { cameraSeedData } from "../prisma/seed/camera-seed-data";
import { generateReading } from "../prisma/seed/reading-generator";

let running = true;

process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  running = false;
});

async function tick() {
  const now = new Date();
  const readings: ReadingInput[] = cameraSeedData.map((cam) => ({
    cameraId: cam.cameraId,
    celsius: generateReading(cam, now),
    timestamp: now.toISOString(),
  }));

  await ingestReadings(readings);

  const avgTemp = readings.reduce((s, d) => s + d.celsius, 0) / readings.length;
  console.log(
    `[${now.toLocaleTimeString()}] Inserted ${readings.length} readings (avg: ${avgTemp.toFixed(1)}C)`
  );
}

async function main() {
  console.log("Live seeder started. Press Ctrl+C to stop.");
  while (running) {
    const start = Date.now();
    await tick();
    const elapsed = Date.now() - start;
    // Wait remaining time to hit 5s interval
    if (running) await new Promise((r) => setTimeout(r, Math.max(0, 5000 - elapsed)));
  }
  console.log("Live seeder stopped.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cameraSeedData } from "../prisma/seed/camera-seed-data";
import { generateReading } from "../prisma/seed/reading-generator";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

let running = true;

process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  running = false;
});

async function tick() {
  const now = new Date();
  const data = cameraSeedData.map((cam) => ({
    cameraId: cam.cameraId,
    celsius: generateReading(cam, now),
    timestamp: now,
  }));

  await prisma.reading.createMany({ data });

  const avgTemp = data.reduce((s, d) => s + d.celsius, 0) / data.length;
  console.log(
    `[${now.toLocaleTimeString()}] Inserted ${data.length} readings (avg: ${avgTemp.toFixed(1)}C)`
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
  await prisma.$disconnect();
  console.log("Live seeder stopped.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

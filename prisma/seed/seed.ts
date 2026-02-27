import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cameraSeedData } from "./camera-seed-data";
import { generateReadingsBatch } from "./reading-generator";
import "dotenv/config";

const BATCH_SIZE = 1000;

async function main() {
  const hours = parseInt(process.argv.find((a) => a.startsWith("--hours="))?.split("=")[1] ?? "24");
  const shouldClear = process.argv.includes("--clear");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    if (shouldClear) {
      console.log("Clearing existing data...");
      await prisma.alert.deleteMany();
      await prisma.reading.deleteMany();
      await prisma.gapThreshold.deleteMany();
      await prisma.temperatureThreshold.deleteMany();
      await prisma.camera.deleteMany();
      console.log("Cleared.");
    }

    // Upsert cameras
    console.log(`Upserting ${cameraSeedData.length} cameras...`);
    for (const cam of cameraSeedData) {
      await prisma.camera.upsert({
        where: { cameraId: cam.cameraId },
        update: { name: cam.name, location: cam.location },
        create: { cameraId: cam.cameraId, name: cam.name, location: cam.location },
      });
    }

    // Generate readings
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
    console.log(`Generating ${hours}h of readings (${startTime.toISOString()} → ${endTime.toISOString()})...`);

    for (let i = 0; i < cameraSeedData.length; i++) {
      const cam = cameraSeedData[i];
      const readings = generateReadingsBatch(cam, startTime, endTime, 5);
      // Insert in batches
      for (let j = 0; j < readings.length; j += BATCH_SIZE) {
        const batch = readings.slice(j, j + BATCH_SIZE);
        await prisma.reading.createMany({
          data: batch.map((r) => ({
            cameraId: cam.cameraId,
            celsius: r.celsius,
            timestamp: r.timestamp,
          })),
        });
      }
      if ((i + 1) % 10 === 0 || i === cameraSeedData.length - 1) {
        console.log(`  Camera ${i + 1}/${cameraSeedData.length} done (${readings.length} readings)`);
      }
    }

    // Sample thresholds
    console.log("Creating sample thresholds...");
    await prisma.temperatureThreshold.createMany({
      data: [
        { name: "Global High Temp", minCelsius: null, maxCelsius: 80, cooldownMinutes: 5, enabled: true },
        { name: "Global Low Temp", minCelsius: -15, maxCelsius: null, cooldownMinutes: 5, enabled: true },
        { name: "Furnace Max", cameraId: "CAM-001", maxCelsius: 85, cooldownMinutes: 10, enabled: true },
        { name: "Cold Storage Min", cameraId: "CAM-031", minCelsius: -10, cooldownMinutes: 10, enabled: true },
      ],
    });
    await prisma.gapThreshold.createMany({
      data: [
        { name: "Rapid Rise (5min)", intervalMinutes: 5, maxGapCelsius: 10, direction: "RISE", cooldownMinutes: 5 },
        { name: "Rapid Drop (10min)", intervalMinutes: 10, maxGapCelsius: 15, direction: "DROP", cooldownMinutes: 10 },
        { name: "Any Rapid Change (15min)", intervalMinutes: 15, maxGapCelsius: 20, direction: "BOTH", cooldownMinutes: 15 },
      ],
    });

    const readingCount = await prisma.reading.count();
    console.log(`\nSeeding complete: ${readingCount} readings, ${cameraSeedData.length} cameras.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

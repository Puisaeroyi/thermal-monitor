import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cameraSeedData, groupSeedData } from "./camera-seed-data";
import { generateReadingsBatch } from "./reading-generator";
import { config } from "dotenv";
config({ path: ".env.local" });

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
      await prisma.group.deleteMany();
      console.log("Cleared.");
    }

    // Seed default users
    console.log("Seeding users...");
    const defaultUsers = [
      { username: "operator", password: "123456", role: "operator", firstLogin: false },
      { username: "admin", password: "123456", role: "admin", firstLogin: false },
      { username: "tempus", password: "654321", role: "admin", firstLogin: false },
    ];
    for (const u of defaultUsers) {
      await prisma.user.upsert({
        where: { username: u.username },
        update: {},
        create: u,
      });
    }
    console.log(`  ${defaultUsers.length} users seeded.`);

    // Create groups
    console.log(`Creating ${groupSeedData.length} groups...`);
    const groupMap = new Map<string, string>();
    for (const grp of groupSeedData) {
      const group = await prisma.group.upsert({
        where: { id: grp.name.toLowerCase().replace(/\s+/g, "-") },
        update: {},
        create: { id: grp.name.toLowerCase().replace(/\s+/g, "-"), name: grp.name, color: grp.color },
      });
      groupMap.set(grp.name, group.id);
    }

    // Upsert cameras with group assignment
    console.log(`Upserting ${cameraSeedData.length} cameras...`);
    for (const cam of cameraSeedData) {
      const groupId = groupMap.get(cam.groupName);
      await prisma.camera.upsert({
        where: { cameraId: cam.cameraId },
        update: { name: cam.name, location: cam.location, groupId },
        create: { cameraId: cam.cameraId, name: cam.name, location: cam.location, groupId },
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

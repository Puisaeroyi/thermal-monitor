import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fahrenheitToCelsius } from "../src/lib/temperature-utils";
import path from "path";

const BATCH_SIZE = 1000;
const XLSX_PATH = path.resolve(__dirname, "../data/thermal_cctv_test_data_3days_1min.xlsx");

const CCTV_CAMERAS: Record<string, { name: string; location: string }> = {
  "CCTV-01": { name: "CCTV Camera 01", location: "Thermal Zone A" },
  "CCTV-02": { name: "CCTV Camera 02", location: "Thermal Zone B" },
  "CCTV-03": { name: "CCTV Camera 03", location: "Thermal Zone C" },
};

interface XlsxRow {
  cctv_name: string;
  timestamp: string | number;
  max_temp_f: number;
  avg_temp_f: number;
  min_temp_f: number;
  alarm_over_105F?: number | string;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log(`Reading XLSX: ${XLSX_PATH}`);
    const workbook = XLSX.readFile(XLSX_PATH);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<XlsxRow>(workbook.Sheets[sheetName]);
    console.log(`Parsed ${rows.length} rows from sheet "${sheetName}"`);

    // Upsert "CCTV Thermal" group
    const group = await prisma.group.upsert({
      where: { id: "cctv-thermal" },
      update: {},
      create: { id: "cctv-thermal", name: "CCTV Thermal", color: "#f59e0b" },
    });
    console.log(`Group: ${group.name} (${group.id})`);

    // Upsert cameras
    for (const [cameraId, info] of Object.entries(CCTV_CAMERAS)) {
      await prisma.camera.upsert({
        where: { cameraId },
        update: { name: info.name, location: info.location, groupId: group.id },
        create: { cameraId, name: info.name, location: info.location, groupId: group.id },
      });
      console.log(`  Camera: ${cameraId} - ${info.name}`);
    }

    // Prepare readings
    const readings = rows.map((row) => {
      const ts = typeof row.timestamp === "number"
        ? new Date(XLSX.SSF.format("yyyy-mm-dd HH:MM:SS", row.timestamp))
        : new Date(row.timestamp);

      return {
        cameraId: row.cctv_name,
        celsius: fahrenheitToCelsius(row.avg_temp_f),
        maxCelsius: fahrenheitToCelsius(row.max_temp_f),
        minCelsius: fahrenheitToCelsius(row.min_temp_f),
        timestamp: ts,
      };
    });

    // Bulk insert in batches
    let inserted = 0;
    for (let i = 0; i < readings.length; i += BATCH_SIZE) {
      const batch = readings.slice(i, i + BATCH_SIZE);
      await prisma.reading.createMany({ data: batch });
      inserted += batch.length;
      if (inserted % 5000 === 0 || i + BATCH_SIZE >= readings.length) {
        console.log(`  Inserted ${inserted}/${readings.length} readings`);
      }
    }

    console.log(`\nImport complete: ${inserted} readings for ${Object.keys(CCTV_CAMERAS).length} cameras.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

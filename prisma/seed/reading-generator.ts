import type { CameraSeed } from "./camera-seed-data";

/** Generate a single temperature reading with realistic patterns */
export function generateReading(
  camera: CameraSeed,
  timestamp: Date,
  seed?: number
): number {
  const hours = timestamp.getHours() + timestamp.getMinutes() / 60;
  // Daily sine wave: peaks at 14:00, trough at 02:00
  const dailyVariance = Math.sin(((hours - 2) / 24) * Math.PI * 2) * 5;
  // Deterministic-ish noise from timestamp
  const noiseSeed = seed ?? timestamp.getTime();
  const noise = (Math.sin(noiseSeed * 12.9898 + 78.233) * 43758.5453) % 1;
  const randomNoise = (noise - 0.5) * 2; // range: -1 to +1
  // 2% spike chance for alert testing
  const spikeRoll = Math.abs(Math.sin(noiseSeed * 0.001 + camera.baseTemp)) % 1;
  const spike = spikeRoll < 0.02 ? (15 + Math.abs(noise) * 10) : 0;

  return Math.round((camera.baseTemp + dailyVariance + randomNoise + spike) * 10) / 10;
}

/** Generate a batch of readings for a time window */
export function generateReadingsBatch(
  camera: CameraSeed,
  startTime: Date,
  endTime: Date,
  intervalSec: number
): { timestamp: Date; celsius: number }[] {
  const readings: { timestamp: Date; celsius: number }[] = [];
  let t = startTime.getTime();
  const end = endTime.getTime();
  let seed = 0;

  while (t <= end) {
    const ts = new Date(t);
    readings.push({
      timestamp: ts,
      celsius: generateReading(camera, ts, seed++),
    });
    t += intervalSec * 1000;
  }

  return readings;
}

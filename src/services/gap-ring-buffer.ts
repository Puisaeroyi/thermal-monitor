import { GAP_BUFFER_MAX_MINUTES } from "@/lib/constants";

export interface BufferEntry {
  timestamp: Date;
  celsius: number;
}

/** Per-camera ring buffer storing recent readings for gap/rate-of-change detection. */
class GapRingBuffer {
  private buffers: Map<string, BufferEntry[]> = new Map();
  private readonly maxAge = GAP_BUFFER_MAX_MINUTES * 60 * 1000;

  /** Add a new reading to the camera's buffer, pruning entries older than maxAge. */
  push(cameraId: string, timestamp: Date, celsius: number): void {
    const buf = this.buffers.get(cameraId) ?? [];
    buf.push({ timestamp, celsius });

    // Prune old entries
    const cutoff = timestamp.getTime() - this.maxAge;
    const trimmed = buf.filter((e) => e.timestamp.getTime() >= cutoff);
    this.buffers.set(cameraId, trimmed);
  }

  /**
   * Returns the oldest and newest entries within the given window.
   * Returns null if fewer than 2 entries exist in the window.
   */
  getWindow(
    cameraId: string,
    windowMinutes: number
  ): { oldest: BufferEntry; newest: BufferEntry } | null {
    const buf = this.buffers.get(cameraId);
    if (!buf || buf.length < 2) return null;

    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const window = buf.filter((e) => e.timestamp.getTime() >= cutoff);
    if (window.length < 2) return null;

    return {
      oldest: window[0],
      newest: window[window.length - 1],
    };
  }
}

export const gapRingBuffer = new GapRingBuffer();

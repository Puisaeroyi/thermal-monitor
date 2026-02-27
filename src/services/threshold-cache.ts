import { prisma } from "@/lib/prisma";

/** Cached threshold data with TTL-based lazy refresh. */
class ThresholdCache {
  private tempThresholds: any[] = [];
  private gapThresholds: any[] = [];
  private lastRefresh: Date | null = null;
  private readonly TTL = 60_000; // 60 seconds

  private isStale(): boolean {
    if (!this.lastRefresh) return true;
    return Date.now() - this.lastRefresh.getTime() > this.TTL;
  }

  private async refresh(): Promise<void> {
    const [temp, gap] = await Promise.all([
      prisma.temperatureThreshold.findMany({ where: { enabled: true } }),
      prisma.gapThreshold.findMany({ where: { enabled: true } }),
    ]);
    this.tempThresholds = temp;
    this.gapThresholds = gap;
    this.lastRefresh = new Date();
  }

  async getTemperatureThresholds(): Promise<any[]> {
    if (this.isStale()) await this.refresh();
    return this.tempThresholds;
  }

  async getGapThresholds(): Promise<any[]> {
    if (this.isStale()) await this.refresh();
    return this.gapThresholds;
  }

  /** Call after any threshold create/update/delete to force reload on next access. */
  invalidate(): void {
    this.lastRefresh = null;
  }
}

export const thresholdCache = new ThresholdCache();

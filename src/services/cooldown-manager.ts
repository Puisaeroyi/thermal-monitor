/** In-memory cooldown tracker to prevent alert flooding. */
class CooldownManager {
  private cooldowns: Map<string, Date> = new Map();

  /** Returns true if enough time has passed since the last alert for this threshold+camera pair. */
  canAlert(thresholdId: string, cameraId: string, cooldownMinutes: number): boolean {
    const key = `${thresholdId}:${cameraId}`;
    const last = this.cooldowns.get(key);
    if (!last) return true;
    const elapsed = Date.now() - last.getTime();
    return elapsed >= cooldownMinutes * 60 * 1000;
  }

  /** Records that an alert was fired for this threshold+camera pair right now. */
  recordAlert(thresholdId: string, cameraId: string): void {
    const key = `${thresholdId}:${cameraId}`;
    this.cooldowns.set(key, new Date());
  }
}

export const cooldownManager = new CooldownManager();

// Zero (or invalid configuration) pauses processing; -1 removes only the daily cap.
export function dailyQuotaEnabled(limit: number): boolean {
  return Number.isInteger(limit) && (limit === -1 || limit > 0);
}

export function dailyQuotaReached(limit: number, used: number): boolean {
  return !dailyQuotaEnabled(limit) || (limit !== -1 && used >= limit);
}

/**
 * Melon TOP100 按 KST 整点更新；在整点后稍晚再拉取更稳（避免榜单尚未切换）。
 * @param {number} bufferAfterHourStartMs 整点起算延后多久再拉（默认 2 分钟）
 * @returns {number} 距离建议拉取时刻的毫秒数（至少 1s）
 */
export function msUntilMelonHourlyFetchSlot(bufferAfterHourStartMs = 120_000) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const n = (t) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
  const minute = n('minute')
  const second = n('second')
  const msSinceHourStart = (minute * 60 + second) * 1000

  if (msSinceHourStart < bufferAfterHourStartMs) {
    return Math.max(1000, bufferAfterHourStartMs - msSinceHourStart)
  }

  const msUntilNextHourStart = 3600_000 - msSinceHourStart
  return Math.max(1000, msUntilNextHourStart + bufferAfterHourStartMs)
}

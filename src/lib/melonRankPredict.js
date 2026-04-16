/**
 * 本地简单预测：对官方小时名次序列做线性外推，并用近期波动估一个粗区间。
 * @param {number[]} ranks 时间正序的有效名次（数字越小越好）
 * @returns {{
 *   next: number
 *   raw: number
 *   slope: number
 *   rangeMin: number
 *   rangeMax: number
 * } | null}
 */
export function predictNextRankSimple(ranks) {
  if (!ranks?.length) return null
  const clean = ranks.filter((r) => Number.isFinite(r) && r >= 1)
  if (clean.length < 2) return null

  const n = clean.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += clean[i]
    sumXY += i * clean[i]
    sumXX += i * i
  }
  const denom = n * sumXX - sumX * sumX
  let slope = 0
  let raw
  if (denom === 0) {
    raw = clean[n - 1]
  } else {
    slope = (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n
    raw = slope * n + intercept
  }
  const rounded = Math.round(raw)
  const next = Math.min(100, Math.max(1, rounded))

  const tail = clean.slice(-Math.min(5, clean.length))
  const tMin = Math.min(...tail)
  const tMax = Math.max(...tail)
  const half = Math.max(1, Math.round((tMax - tMin) / 2 + 1))
  let rangeMin = Math.round(rounded - half)
  let rangeMax = Math.round(rounded + half)
  rangeMin = Math.min(100, Math.max(1, rangeMin))
  rangeMax = Math.min(100, Math.max(1, rangeMax))
  if (rangeMin > rangeMax) {
    ;[rangeMin, rangeMax] = [rangeMax, rangeMin]
  }

  return { next, raw: rounded, slope, rangeMin, rangeMax }
}

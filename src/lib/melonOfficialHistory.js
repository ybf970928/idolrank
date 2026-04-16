/**
 * Melon 单曲排名官方历史：服务端按 `chart/index.htm?dayTime=YYYYMMDDHH` 逐小时请求后汇总。
 */

const DEFAULT_HOURS = 24

/**
 * @param {string} songId
 * @param {number} [hours]
 */
export async function fetchMelonOfficialRankHistory(songId, hours = DEFAULT_HOURS) {
  const u = new URL(
    '/api/melon-song-rank-history',
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
  )
  u.searchParams.set('songId', songId)
  u.searchParams.set('hours', String(hours))

  const pathAndQuery = `${u.pathname}${u.search}`
  const res = await fetch(pathAndQuery)
  const text = await res.text()
  if (!res.ok) {
    let msg = text || res.statusText
    try {
      const j = JSON.parse(text)
      if (j?.error)
        msg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error)
    } catch {
      /* 保持原文 */
    }
    throw new Error(msg)
  }
  return JSON.parse(text)
}

/**
 * @param {{ points: { label: string, rank: number | null }[] }} payload
 */
export function chartSeriesFromOfficialPayload(payload) {
  if (!payload?.points?.length) return { times: [], ranks: [] }
  const times = []
  const ranks = []
  for (const p of payload.points) {
    if (p.rank != null && Number.isFinite(p.rank)) {
      times.push(p.label)
      ranks.push(p.rank)
    }
  }
  return { times, ranks }
}

/**
 * Melon TOP100（https://www.melon.com/chart/index.htm）HTML 解析。
 * 历史每小时榜单：官网「시간선택」使用 query `?dayTime=YYYYMMDDHH`（韩国标准时区 wall time）。
 * 榜单 1–50 行为 class="lst50"，51–100 为 class="lst100"。
 */

const MELON_CHART_PAGE = 'https://www.melon.com/chart/index.htm'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Referer: MELON_CHART_PAGE,
  'Accept-Encoding': 'identity',
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** @param {string | undefined | null} dayTime YYYYMMDDHH */
function melonChartUrl(dayTime) {
  const t = (dayTime || '').trim()
  if (!t) return MELON_CHART_PAGE
  return `${MELON_CHART_PAGE}?dayTime=${encodeURIComponent(t)}`
}

/**
 * 从当前时刻起共 `countHours` 个整点（含当前小时），按时间正序。使用 Asia/Seoul。
 * @param {number} countHours
 * @returns {string[]}
 */
export function kstDayTimeHourSequence(countHours) {
  const n = Math.max(1, Math.floor(countHours))
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
  /** @type {string[]} */
  const out = []
  const anchor = Date.now()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(anchor - i * 3600_000)
    const parts = formatter.formatToParts(d)
    const g = (type) => parts.find((p) => p.type === type)?.value ?? ''
    const y = g('year')
    const mo = g('month')
    const da = g('day')
    let hr = g('hour')
    if (hr.length === 1) hr = `0${hr}`
    out.push(`${y}${mo}${da}${hr}`)
  }
  return out
}

/** @param {string} dayTime */
function labelFromDayTime(dayTime) {
  if (dayTime.length < 10) return dayTime
  const mo = dayTime.slice(4, 6)
  const da = dayTime.slice(6, 8)
  const hr = dayTime.slice(8, 10)
  return `${mo}-${da} ${hr}:00`
}

/** @param {string | null | undefined} dayTime */
async function fetchChartPageHtml(dayTime, opts = {}) {
  const url = melonChartUrl(dayTime)
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: opts.signal,
  })
  const text = await res.text()
  return { res, text, url }
}

/** @param {string} s */
function decodeBasicEntities(s) {
  return s
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

/**
 * @param {string} html
 * @returns {{
 *   rank: number,
 *   songId: string,
 *   title: string,
 *   artist: string,
 *   album: string,
 * }[]}
 */
export function parseMelonTop100Html(html) {
  const rowRe =
    /<tr class="lst(?:50|100)"[^>]*data-song-no="(\d+)"[\s\S]*?<\/tr>/g
  /** @type {{ rank: number, songId: string, title: string, artist: string, album: string }[]} */
  const items = []
  let m
  while ((m = rowRe.exec(html)) !== null) {
    const chunk = m[0]
    const songId = m[1]
    const rankMatch = chunk.match(/<span class="rank ">(\d+)<\/span>/)
    const rank = rankMatch
      ? Number.parseInt(rankMatch[1], 10)
      : items.length + 1

    const playMatch = chunk.match(
      /<a href="javascript:melon\.play\.playSong\('[^']*',\d+\);" title="([^"]*)"[^>]*>([^<]*)<\/a>/,
    )
    let title = ''
    if (playMatch) {
      title = decodeBasicEntities(
        (playMatch[2] || '').trim() ||
          playMatch[1].replace(/\s*재생\s*$/, '').trim(),
      )
    }

    const artistMatch = chunk.match(
      /<div class="ellipsis rank02">[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
    )
    const artist = artistMatch
      ? decodeBasicEntities(artistMatch[1].trim())
      : ''

    const albumMatch = chunk.match(
      /<div class="ellipsis rank03">[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
    )
    const album = albumMatch
      ? decodeBasicEntities(albumMatch[1].trim())
      : ''

    items.push({ rank, songId, title, artist, album })
  }

  items.sort((a, b) => a.rank - b.rank)
  return items
}

/**
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{
 *   source: string,
 *   fetchedAt: number,
 *   items: ReturnType<typeof parseMelonTop100Html>,
 * }>}
 */
export async function fetchMelonTop100(opts = {}) {
  const { res, text } = await fetchChartPageHtml('', opts)
  if (!res.ok) {
    const err = new Error(`Melon 页面 HTTP ${res.status}`)
    /** @type {Error & { status?: number }} */ (err).status =
      res.status >= 400 && res.status < 600 ? res.status : 502
    throw err
  }
  const items = parseMelonTop100Html(text)
  if (items.length === 0) {
    const err = new Error('未能解析 Melon 榜单（页面结构可能已变更）')
    /** @type {Error & { status?: number }} */ (err).status = 502
    throw err
  }
  return {
    source: MELON_CHART_PAGE,
    fetchedAt: Date.now(),
    items,
  }
}

/**
 * 按官方 `dayTime` 逐小时拉取榜单，提取单曲排名（未进当小时 TOP100 则 rank 为 null）。
 * @param {string} songId
 * @param {{ hours?: number, delayMs?: number, signal?: AbortSignal }} [opts]
 */
export async function fetchSongOfficialRankHistory(songId, opts = {}) {
  const id = String(songId).trim()
  if (!id) {
    const err = new Error('songId 不能为空')
    /** @type {Error & { status?: number }} */ (err).status = 400
    throw err
  }

  const hours = Math.min(72, Math.max(4, opts.hours ?? 24))
  const delayMs = Math.max(80, opts.delayMs ?? 280)
  const dayTimes = kstDayTimeHourSequence(hours)

  /** @type {{ dayTime: string, label: string, rank: number | null }[]} */
  const points = []
  let outOfChartHours = 0

  for (const dt of dayTimes) {
    const { res, text } = await fetchChartPageHtml(dt, {
      signal: opts.signal,
    })
    if (!res.ok) {
      points.push({ dayTime: dt, label: labelFromDayTime(dt), rank: null })
      await sleep(delayMs)
      continue
    }
    const items = parseMelonTop100Html(text)
    const row = items.find((x) => x.songId === id)
    if (!row) {
      outOfChartHours += 1
      points.push({ dayTime: dt, label: labelFromDayTime(dt), rank: null })
    } else {
      points.push({
        dayTime: dt,
        label: labelFromDayTime(dt),
        rank: row.rank,
      })
    }
    await sleep(delayMs)
  }

  return {
    songId: id,
    hours,
    source: MELON_CHART_PAGE,
    queryParam: 'dayTime',
    timezone: 'Asia/Seoul',
    fetchedAt: Date.now(),
    points,
    outOfChartHours,
  }
}

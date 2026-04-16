/**
 * 将 Melon 艺人字段拆成合作单元并归一化，用于「同一艺人」合并匹配。
 */

const SPLIT_RE =
  /\s*(?:,|，|\/|、|､|\s+&\s+|\s+and\s+|\s+(?:feat\.?|ft\.?|featuring|with)\s+|\s+[x×]\s+)\s*/i

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function splitArtistSegments(raw) {
  const s = String(raw || '')
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
  if (!s || s === '—') return []
  return s
    .split(SPLIT_RE)
    .map((p) =>
      p
        .replace(/\s*\([^)]*\)\s*$/g, '')
        .trim()
        .normalize('NFKC'),
    )
    .filter(Boolean)
}

/**
 * @param {string} segment 单个艺人片段
 * @returns {string}
 */
export function normalizeArtistKey(segment) {
  const s = String(segment || '')
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim()
  if (!s) return ''
  return s.toLowerCase()
}

/**
 * @param {string} raw 整格艺人文案
 * @returns {string[]}
 */
export function artistKeysFromCell(raw) {
  const keys = new Set()
  for (const seg of splitArtistSegments(raw)) {
    const k = normalizeArtistKey(seg)
    if (k) keys.add(k)
  }
  return [...keys]
}

/**
 * 取合作文案中首位艺人（收藏艺人时的默认主键）
 * @param {string} raw
 * @returns {string}
 */
export function primaryArtistSegment(raw) {
  const segs = splitArtistSegments(raw)
  return segs[0] || String(raw || '').trim() || ''
}

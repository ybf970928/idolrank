/**
 * 经 Vite 开发/预览中间件 /api/melon-chart 拉取 Melon TOP100。
 */

export async function fetchMelonChart() {
  const res = await fetch('/api/melon-chart')
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

import { fetchMelonTop100 } from "../server/melonChart.mjs"

/**
 * 生产环境由 Vercel Serverless 提供，与 vite 中间件 /api/melon-chart 行为一致。
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  if (req.method === "OPTIONS") {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    res.statusCode = 405
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify({ error: "Method Not Allowed" }))
    return
  }

  try {
    const payload = await fetchMelonTop100()
    res.statusCode = 200
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify(payload))
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err))
    const status = /** @type {{ status?: number }} */ (e).status
    const code =
      status && status >= 400 && status < 500 ? status : 502
    res.statusCode = code
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify({ error: e.message }))
  }
}

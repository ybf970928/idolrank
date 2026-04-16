import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import {
  fetchMelonTop100,
  fetchSongOfficialRankHistory,
} from "./server/melonChart.mjs"

function melonChartApiPlugin() {
  const attach = (server) => {
    server.middlewares.use(async (req, res, next) => {
      let pathname = req.url || "/"
      const q = pathname.indexOf("?")
      if (q >= 0) pathname = pathname.slice(0, q)
      const sendJson = (code, body) => {
        res.statusCode = code
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(JSON.stringify(body))
      }

      if (req.method !== "GET") {
        next()
        return
      }

      if (pathname === "/api/melon-song-rank-history") {
        const rawUrl = req.url || "/"
        const q = rawUrl.indexOf("?")
        const sp =
          q >= 0
            ? new URLSearchParams(rawUrl.slice(q + 1))
            : new URLSearchParams()
        const songId = (sp.get("songId") || "").trim()
        const hoursRaw = Number.parseInt(sp.get("hours") || "24", 10)
        const hours = Number.isFinite(hoursRaw) ? hoursRaw : 24

        if (!songId) {
          sendJson(400, { error: "缺少查询参数 songId" })
          return
        }

        try {
          const payload = await fetchSongOfficialRankHistory(songId, {
            hours,
          })
          sendJson(200, payload)
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err))
          const status = /** @type {{ status?: number }} */ (e).status
          const code =
            status && status >= 400 && status < 500 ? status : 502
          sendJson(code, { error: e.message })
        }
        return
      }

      if (pathname !== "/api/melon-chart") {
        next()
        return
      }

      try {
        const payload = await fetchMelonTop100()
        sendJson(200, payload)
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        const status = /** @type {{ status?: number }} */ (e).status
        const code =
          status && status >= 400 && status < 500 ? status : 502
        sendJson(code, { error: e.message })
      }
    })
  }

  return {
    name: "melon-chart-api",
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), melonChartApiPlugin()],
})

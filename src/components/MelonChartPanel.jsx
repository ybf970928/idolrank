import useSWR, { useSWRConfig } from 'swr'
import { useEffect, useMemo, useState } from 'react'
import { fetchMelonChart } from '../lib/melonChart.js'
import {
  rowMatchesFavoriteArtist,
  useMelonFavorites,
} from '../lib/favoriteArtistsStorage.js'
import { msUntilMelonHourlyFetchSlot } from '../lib/melonKstSchedule.js'
import {
  chartSeriesFromOfficialPayload,
  fetchMelonOfficialRankHistory,
} from '../lib/melonOfficialHistory.js'
import { MelonRankTrendChart } from './MelonRankTrendChart.jsx'
import { predictNextRankSimple } from '../lib/melonRankPredict.js'

const MELON_TOP100_KEY = 'melon-top100'

/** 与 Melon 小时发榜对齐的兜底轮询（1h）；主触发仍靠 KST 整点 + 缓冲的 mutate */
const melonSwrOptions = {
  refreshInterval: 3600_000,
  revalidateOnFocus: true,
  dedupingInterval: 120_000,
}

const OFFICIAL_HOURS = 24

export function MelonChartPanel() {
  const { mutate } = useSWRConfig()
  const {
    state: favState,
    artistKeys,
    songIdSet,
    toggleArtist,
    isArtistFavorite,
    toggleSong,
    isSongFavorite,
    hasAnyFavorite,
  } = useMelonFavorites()
  const [selected, setSelected] = useState(
    /** @type {{ songId: string, title: string, artist: string } | null} */ (
      null
    ),
  )
  const { data, error, isLoading, isValidating } = useSWR(
    MELON_TOP100_KEY,
    fetchMelonChart,
    melonSwrOptions,
  )

  const {
    data: historyPayload,
    error: historyError,
    isLoading: historyLoading,
  } = useSWR(
    selected ? ['melon-official-rank', selected.songId, OFFICIAL_HOURS] : null,
    ([, id]) => fetchMelonOfficialRankHistory(id, OFFICIAL_HOURS),
    {
      revalidateOnFocus: false,
      dedupingInterval: 120_000,
      refreshInterval: 3600_000,
    },
  )

  /** 按 KST 整点 +2min 自动重拉 TOP100；若趋势弹层打开则同时重拉该曲官方小时历史 */
  useEffect(() => {
    let timer = 0
    const schedule = () => {
      const delay = msUntilMelonHourlyFetchSlot(120_000)
      timer = window.setTimeout(async () => {
        await mutate(MELON_TOP100_KEY)
        if (selected) {
          await mutate([
            'melon-official-rank',
            selected.songId,
            OFFICIAL_HOURS,
          ])
        }
        schedule()
      }, delay)
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [mutate, selected])

  useEffect(() => {
    if (!selected) return
    const onKey = (e) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const trendOfficial = useMemo(
    () => chartSeriesFromOfficialPayload(historyPayload || { points: [] }),
    [historyPayload],
  )

  const localRankPredict = useMemo(
    () => predictNextRankSimple(trendOfficial.ranks),
    [trendOfficial.ranks],
  )

  const currentRank = useMemo(() => {
    if (!selected || !data?.items?.length) return null
    const row = data.items.find((i) => String(i.songId) === selected.songId)
    return row?.rank ?? null
  }, [selected, data])

  const favoriteInChartItems = useMemo(() => {
    if (!data?.items?.length || !hasAnyFavorite) return []
    return data.items
      .filter((row) => {
        if (songIdSet.has(String(row.songId)))
          return true
        return rowMatchesFavoriteArtist(row.artist || '', artistKeys)
      })
      .slice()
      .sort((a, b) => a.rank - b.rank)
  }, [data, hasAnyFavorite, songIdSet, artistKeys])

  const favoriteOffChart = useMemo(() => {
    if (!data?.items?.length) {
      return {
        artists: favState.artists.map((a) => a.label),
        songs: favState.songs.slice(),
      }
    }
    const artistsMissing = favState.artists
      .filter(
        (a) =>
          !data.items.some((row) =>
            rowMatchesFavoriteArtist(row.artist || '', new Set([a.key])),
          ),
      )
      .map((a) => a.label)
    const onChartSongIds = new Set(data.items.map((i) => String(i.songId)))
    const songsMissing = favState.songs.filter(
      (s) => !onChartSongIds.has(s.songId),
    )
    return { artists: artistsMissing, songs: songsMissing }
  }, [data, favState.artists, favState.songs])

  return (
    <section className="panel panel--melon">
      <div className="panel__head">
        <h2 className="panel__title">Melon TOP100</h2>
        <span className="panel__meta">
          <a
            href="https://www.melon.com/chart/index.htm"
            target="_blank"
            rel="noreferrer"
          >
            melon.com/chart
          </a>
          {data?.fetchedAt ? (
            <>
              {' '}
              · 拉取{' '}
              {new Date(data.fetchedAt).toLocaleString('zh-CN', {
                hour12: false,
              })}
            </>
          ) : null}
          {isValidating && !isLoading ? ' · 更新中…' : null}
          {' · '}
          <span
            className="panel__meta-hint"
            title="与官网「시간선택」相同：chart/index.htm?dayTime=YYYYMMDDHH（KST）；列表在 KST 每整点约 2 分钟后自动重拉"
          >
            自动同步官方小时榜 · 点击曲目看近 {OFFICIAL_HOURS} 小时排名趋势
          </span>
        </span>
      </div>

      {hasAnyFavorite ? (
        <div className="melon-favorites">
          <div className="melon-favorites__head">
            <h3 className="melon-favorites__title">我的收藏</h3>
            <span className="melon-favorites__meta">
              已存本机 · 合作曲中任一艺人命中即归入该艺人 · 优先展示本期在榜
            </span>
          </div>
          {!data?.items?.length && !error ? (
            <p className="melon-favorites__wait" aria-busy="true">
              榜单加载中…
            </p>
          ) : null}
          {data?.items?.length ? (
            <>
              {favoriteInChartItems.length > 0 ? (
                <div className="melon-favorites__scroll">
                  <table className="melon-chart__table">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">曲目</th>
                        <th scope="col">艺人</th>
                        <th scope="col">专辑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {favoriteInChartItems.map((row) => (
                        <MelonChartTableRow
                          key={row.songId}
                          row={row}
                          selectedSongId={selected?.songId}
                          onSelectRow={setSelected}
                          isArtistFavorite={isArtistFavorite}
                          onToggleArtist={toggleArtist}
                          isSongFavorite={isSongFavorite}
                          onToggleSong={toggleSong}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="melon-favorites__empty">
                  本期 TOP100 中暂无这些歌手的条目。
                </p>
              )}
              {favoriteOffChart.artists.length > 0 ? (
                <p className="melon-favorites__off">
                  未入本期榜的收藏艺人：
                  <strong>{favoriteOffChart.artists.join('、')}</strong>
                </p>
              ) : null}
              {favoriteOffChart.songs.length > 0 ? (
                <p className="melon-favorites__off">
                  未入本期榜的收藏曲目：
                  <strong>
                    {favoriteOffChart.songs
                      .map((s) => `${s.title}（${s.artist}）`)
                      .join('；')}
                  </strong>
                </p>
              ) : null}
            </>
          ) : null}
          {error && !data?.items?.length ? (
            <p className="melon-favorites__empty">
              榜单暂不可用，请稍后刷新。艺人：
              <strong>{favState.artists.map((a) => a.label).join('、')}</strong>
              {favState.songs.length > 0 ? (
                <>
                  {' '}
                  · 曲目：
                  <strong>
                    {favState.songs.map((s) => s.title).join('、')}
                  </strong>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="melon-chart__err">
          {error instanceof Error && error.message
            ? error.message
            : 'Melon 数据加载失败'}
        </p>
      ) : null}

      {!data && !error ? (
        <p className="melon-chart__hint" aria-busy="true">
          正在加载榜单…
        </p>
      ) : null}

      {data?.items?.length ? (
        <div className="melon-chart__scroll">
          <table className="melon-chart__table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">曲目</th>
                <th scope="col">艺人</th>
                <th scope="col">专辑</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <MelonChartTableRow
                  key={row.songId}
                  row={row}
                  selectedSongId={selected?.songId}
                  onSelectRow={setSelected}
                  isArtistFavorite={isArtistFavorite}
                  onToggleArtist={toggleArtist}
                  isSongFavorite={isSongFavorite}
                  onToggleSong={toggleSong}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div
          className="melon-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="melon-trend-title"
        >
          <button
            type="button"
            className="melon-modal__backdrop"
            aria-label="关闭"
            onClick={() => setSelected(null)}
          />
          <div className="melon-modal__card">
            <button
              type="button"
              className="melon-modal__close"
              aria-label="关闭"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <h3 id="melon-trend-title" className="melon-modal__title">
              {selected.title}
            </h3>
            <p className="melon-modal__sub">{selected.artist}</p>
            {currentRank != null ? (
              <p className="melon-modal__now">
                当前榜单位次：<strong>第 {currentRank} 位</strong>
              </p>
            ) : null}
            {!historyLoading &&
            !historyError &&
            trendOfficial.ranks.length >= 2 ? (
              <div className="melon-predict">
                <div className="melon-predict__head">
                  <span className="melon-predict__label">下一整点名次预测</span>
                  <span className="melon-predict__sub">
                    数字越小名次越好；按历史名次线性外推，并结合近几小时波动估粗区间，仅供参考
                  </span>
                </div>
                {localRankPredict ? (
                  <>
                    <p className="melon-predict__line">
                      点预测：约 <strong>第 {localRankPredict.next} 位</strong>
                      {localRankPredict.slope > 0.05 ? (
                        <span className="melon-predict__trend">（近期数字走高）</span>
                      ) : localRankPredict.slope < -0.05 ? (
                        <span className="melon-predict__trend melon-predict__trend--up">
                          （近期数字走低）
                        </span>
                      ) : (
                        <span className="melon-predict__trend">（近期较平稳）</span>
                      )}
                    </p>
                    <p className="melon-predict__range">
                      粗算区间：第{' '}
                      <strong>{localRankPredict.rangeMin}</strong>–
                      <strong>{localRankPredict.rangeMax}</strong> 位
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
            {historyError ? (
              <p className="melon-chart__err melon-modal__err">
                {historyError instanceof Error && historyError.message
                  ? historyError.message
                  : '官方趋势加载失败'}
              </p>
            ) : null}
            {historyLoading ? (
              <p className="melon-modal__loading" aria-busy="true">
                正在拉取官方小时榜单…
              </p>
            ) : null}
            {!historyLoading &&
            historyPayload &&
            historyPayload.outOfChartHours > 0 ? (
              <p className="melon-modal__hint">
                近 {OFFICIAL_HOURS} 小时内有{' '}
                <strong>{historyPayload.outOfChartHours}</strong>{' '}
                个整点未进入 TOP100，图中已跳过这些时点。
              </p>
            ) : null}
            {!historyLoading && trendOfficial.ranks.length === 1 ? (
              <p className="melon-modal__hint">
                仅有 1
                个有效排名点（其余时点可能未进榜或页面异常）。
              </p>
            ) : null}
            <MelonRankTrendChart
              times={trendOfficial.times}
              ranks={trendOfficial.ranks}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

/**
 * @param {{
 *   row: { songId: string | number, rank: number, title?: string, artist?: string, album?: string },
 *   selectedSongId?: string | null,
 *   onSelectRow: (s: { songId: string, title: string, artist: string }) => void,
 *   isArtistFavorite: (artist: string) => boolean,
 *   onToggleArtist: (artist: string) => void,
 *   isSongFavorite: (songId: string | number) => boolean,
 *   onToggleSong: (row: { songId: string | number, title?: string, artist?: string }) => void,
 * }} props
 */
function MelonChartTableRow({
  row,
  selectedSongId,
  onSelectRow,
  isArtistFavorite,
  onToggleArtist,
  isSongFavorite,
  onToggleSong,
}) {
  const artist = row.artist || '—'
  const songId = String(row.songId)
  const favArtist = artist !== '—' && isArtistFavorite(artist)
  const favSong = isSongFavorite(songId)
  const pick = () =>
    onSelectRow({
      songId,
      title: row.title || '—',
      artist,
    })

  return (
    <tr
      className={
        selectedSongId === songId
          ? 'melon-chart__row is-selected'
          : 'melon-chart__row'
      }
      tabIndex={0}
      role="button"
      aria-label={`${row.title}，查看排名趋势`}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pick()
        }
      }}
    >
      <td className="melon-chart__rank">{row.rank}</td>
      <td>
        <span className="melon-chart__title-cell">
          <button
            type="button"
            className={`melon-fav-btn melon-fav-btn--song${favSong ? ' is-on' : ''}`}
            aria-label={
              favSong
                ? `取消收藏曲目 ${row.title || ''}`
                : `收藏曲目 ${row.title || ''}`
            }
            aria-pressed={favSong}
            title={favSong ? '取消收藏曲目' : '收藏该曲目'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSong(row)
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {favSong ? '♥' : '♡'}
          </button>
          <span className="melon-chart__song">{row.title || '—'}</span>
        </span>
      </td>
      <td>
        <span className="melon-chart__artist-cell">
          <button
            type="button"
            className={`melon-fav-btn${favArtist ? ' is-on' : ''}`}
            aria-label={
              favArtist ? `取消收藏艺人 ${artist}` : `收藏艺人 ${artist}`
            }
            aria-pressed={favArtist}
            disabled={artist === '—'}
            title={favArtist ? '取消收藏艺人' : '收藏该艺人（合作曲合并匹配）'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleArtist(artist)
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {favArtist ? '★' : '☆'}
          </button>
          <span className="melon-chart__artist-name">{artist}</span>
        </span>
      </td>
      <td className="melon-chart__album">{row.album || '—'}</td>
    </tr>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  artistKeysFromCell,
  normalizeArtistKey,
  primaryArtistSegment,
} from './melonArtistNormalize.js'

const STORAGE_KEY = 'idolrank-melon-favorites'
const LEGACY_KEY = 'idolrank-melon-favorite-artists'

/**
 * @typedef {{ key: string, label: string }} FavoriteArtist
 * @typedef {{ songId: string, title: string, artist: string }} FavoriteSong
 * @typedef {{ artists: FavoriteArtist[], songs: FavoriteSong[] }} FavoritesState
 */

/** @returns {FavoritesState} */
function emptyState() {
  return { artists: [], songs: [] }
}

/** @returns {FavoritesState} */
export function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const j = JSON.parse(raw)
      if (j && typeof j === 'object') {
        return {
          artists: sanitizeArtists(j.artists),
          songs: sanitizeSongs(j.songs),
        }
      }
    }
    const leg = localStorage.getItem(LEGACY_KEY)
    if (leg) {
      const parsed = JSON.parse(leg)
      const names = Array.isArray(parsed) ? parsed : []
      const artists = []
      const seen = new Set()
      for (const n of names) {
        const seg = primaryArtistSegment(String(n))
        const key = normalizeArtistKey(seg)
        if (!key || seen.has(key)) continue
        seen.add(key)
        artists.push({ key, label: seg || String(n).trim() })
      }
      const next = { artists, songs: [] }
      saveFavorites(next)
      localStorage.removeItem(LEGACY_KEY)
      return next
    }
  } catch {
    /* ignore */
  }
  return emptyState()
}

/** @param {unknown} v */
function sanitizeArtists(v) {
  if (!Array.isArray(v)) return []
  const out = []
  const seen = new Set()
  for (const x of v) {
    if (!x || typeof x !== 'object') continue
    const key = normalizeArtistKey(String(x.key || x.label || ''))
    const label = String(x.label || x.key || '').trim() || key
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ key, label })
  }
  return out
}

/** @param {unknown} v */
function sanitizeSongs(v) {
  if (!Array.isArray(v)) return []
  const out = []
  const seen = new Set()
  for (const x of v) {
    if (!x || typeof x !== 'object') continue
    const songId = String(x.songId || '').trim()
    if (!songId || seen.has(songId)) continue
    seen.add(songId)
    out.push({
      songId,
      title: String(x.title || '—').trim() || '—',
      artist: String(x.artist || '—').trim() || '—',
    })
  }
  return out
}

/** @param {FavoritesState} state */
export function saveFavorites(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        artists: state.artists,
        songs: state.songs,
      }),
    )
  } catch {
    /* 私密模式等 */
  }
}

/** @param {FavoriteArtist[]} artists */
function artistKeySet(artists) {
  return new Set(artists.map((a) => a.key))
}

/**
 * 行内任一合作艺人命中已收藏主键即视为该艺人相关
 * @param {string} artistCell
 * @param {Set<string>} keys
 */
export function rowMatchesFavoriteArtist(artistCell, keys) {
  for (const k of artistKeysFromCell(artistCell)) {
    if (keys.has(k)) return true
  }
  return false
}

export function useMelonFavorites() {
  const [state, setState] = useState(loadFavorites)

  useEffect(() => {
    saveFavorites(state)
  }, [state])

  const artistKeys = useMemo(() => artistKeySet(state.artists), [state.artists])

  const songIdSet = useMemo(
    () => new Set(state.songs.map((s) => s.songId)),
    [state.songs],
  )

  const toggleArtist = useCallback((artistDisplay) => {
    const keysInRow = artistKeysFromCell(artistDisplay)
    setState((prev) => {
      const favSet = artistKeySet(prev.artists)
      const matched = keysInRow.filter((k) => favSet.has(k))
      if (matched.length > 0) {
        const drop = new Set(matched)
        return {
          ...prev,
          artists: prev.artists.filter((a) => !drop.has(a.key)),
        }
      }
      const primary = primaryArtistSegment(artistDisplay)
      const key = normalizeArtistKey(primary)
      if (!key) return prev
      if (favSet.has(key)) return prev
      return {
        ...prev,
        artists: [...prev.artists, { key, label: primary.trim() || key }],
      }
    })
  }, [])

  const isArtistFavorite = useCallback(
    (artistDisplay) => rowMatchesFavoriteArtist(artistDisplay, artistKeys),
    [artistKeys],
  )

  const toggleSong = useCallback((row) => {
    const songId = String(row.songId || '').trim()
    if (!songId) return
    const title = row.title || '—'
    const artist = row.artist || '—'
    setState((prev) => {
      const i = prev.songs.findIndex((s) => s.songId === songId)
      if (i >= 0) {
        const songs = prev.songs.slice()
        songs.splice(i, 1)
        return { ...prev, songs }
      }
      return {
        ...prev,
        songs: [...prev.songs, { songId, title, artist }],
      }
    })
  }, [])

  const isSongFavorite = useCallback(
    (songId) => songIdSet.has(String(songId)),
    [songIdSet],
  )

  const hasAnyFavorite = state.artists.length > 0 || state.songs.length > 0

  return {
    state,
    artists: state.artists,
    songs: state.songs,
    artistKeys,
    songIdSet,
    toggleArtist,
    isArtistFavorite,
    toggleSong,
    isSongFavorite,
    hasAnyFavorite,
  }
}

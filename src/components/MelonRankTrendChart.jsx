import * as echarts from 'echarts'
import { useEffect, useRef } from 'react'

/**
 * Melon 排名折线：Y 轴 1 在上方（名次越好越靠上）。
 * @param {{ times: string[], ranks: number[] }} props
 */
export function MelonRankTrendChart({ times, ranks }) {
  const elRef = useRef(null)
  const chartRef = useRef(null)
  const hasData =
    Array.isArray(times) &&
    Array.isArray(ranks) &&
    times.length > 0 &&
    ranks.length > 0

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    if (!hasData) {
      chart.clear()
      return
    }

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const axis = isDark ? '#9ca3af' : '#6b7280'
    const split = isDark ? '#2e303a' : '#e5e7eb'

    const rMin = Math.min(...ranks)
    const rMax = Math.max(...ranks)
    const pad = Math.max(2, Math.ceil((rMax - rMin) * 0.15))
    let yMin = Math.max(1, rMin - pad)
    let yMax = Math.min(100, rMax + pad)
    if (yMax - yMin < 4) {
      const mid = (yMin + yMax) / 2
      yMin = Math.max(1, Math.floor(mid - 2))
      yMax = Math.min(100, Math.ceil(mid + 2))
    }

    chart.setOption({
      animationDuration: 280,
      grid: {
        left: 44,
        right: 20,
        top: 24,
        bottom: times.length > 12 ? 52 : 36,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params
          if (!p) return ''
          return `${p.axisValue}<br/>排名：第 <strong>${p.data}</strong> 位`
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: times,
        axisLabel: {
          color: axis,
          rotate: times.length > 10 ? 30 : 0,
          fontSize: 11,
        },
        axisLine: { lineStyle: { color: split } },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        inverse: true,
        name: '名次',
        nameTextStyle: { color: axis, fontSize: 11 },
        axisLabel: {
          color: axis,
          formatter: (v) => `${v}`,
        },
        splitLine: { lineStyle: { color: split, type: 'dashed' } },
      },
      series: [
        {
          name: '排名',
          type: 'line',
          smooth: 0.25,
          showSymbol: ranks.length < 20,
          symbolSize: 7,
          lineStyle: { width: 2.5, color: '#059669' },
          itemStyle: { color: '#059669' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(5, 150, 105, 0.22)' },
              { offset: 1, color: 'rgba(5, 150, 105, 0.02)' },
            ]),
          },
          data: ranks,
        },
      ],
    })
  }, [times, ranks, hasData])

  return (
    <div className="melon-trend__frame">
      {!hasData ? (
        <p className="melon-trend__empty">暂无历史采样，稍后刷新页面以累积趋势。</p>
      ) : null}
      <div
        ref={elRef}
        className={`melon-trend__chart${hasData ? '' : ' melon-trend__chart--idle'}`}
        role="img"
        aria-label="Melon 排名趋势折线图"
      />
    </div>
  )
}

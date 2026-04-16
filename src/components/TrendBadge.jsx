/**
 * @param {{ direction: 'up' | 'down' | 'flat', label: string, velocity: number }} props
 */
export function TrendBadge({ direction, label, velocity }) {
  const pct = (velocity * 100).toFixed(1)
  const sign = velocity > 0 ? '+' : ''
  const meta =
    direction === 'flat'
      ? '环比动能接近持平'
      : `相对前一窗口 ${sign}${pct}%`

  return (
    <div className={`trend-badge trend-badge--${direction}`}>
      <span className="trend-badge__label">趋势</span>
      <span className="trend-badge__value">{label}</span>
      <span className="trend-badge__meta">{meta}</span>
    </div>
  )
}

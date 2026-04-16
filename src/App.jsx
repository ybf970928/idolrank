import { MelonChartPanel } from './components/MelonChartPanel.jsx'
import './App.css'

export default function App() {
  return (
    <main className="page-home">
      <div className="dashboard">
        <header className="home-hero">
          <p className="home-hero__eyebrow">IdolRank</p>
          <h1 className="home-hero__title">Melon 实时榜</h1>
          <p className="home-hero__lead">
            韩国 Melon TOP100 小时榜：收藏艺人/曲目、点击行查看近 24
            小时官方排名趋势。
          </p>
        </header>
        <MelonChartPanel />
      </div>
    </main>
  )
}

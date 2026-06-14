import { Shield, MoreHorizontal } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Bottombar.css'

export default function Bottombar({ onStartMonitoring, monitoring }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isWeapon = location.pathname === '/weapon-detection'

  return (
    <footer className="bottombar">

      <div className="bb-left">
        <Shield size={15} className="bb-shield" />
        <span className="bb-title">SENTINEL AI</span>
      </div>

      <div className="bb-center">
        <button
          className={`bb-btn ${isWeapon ? 'active-red' : ''}`}
          onClick={() => navigate('/weapon-detection')}
        >
          <span className="bb-dot red" />
          Detect Weapon
        </button>
        <button
          className={`bb-btn ${!isWeapon ? 'active-yellow' : ''}`}
          onClick={() => navigate('/fight-detection')}
        >
          <span className="bb-dot yellow" />
          Detect Fight
        </button>
        <button className="bb-btn">
          <span className="bb-dot white" />
          Motion Tracking
        </button>
        <button className="bb-more">
          <MoreHorizontal size={15} />
        </button>
      </div>

      <div className="bb-right">
        <button
          className={`bb-start ${monitoring ? 'stop' : ''}`}
          onClick={onStartMonitoring}
        >
          <span className={`bb-start-dot ${monitoring ? 'pulse' : ''}`} />
          {monitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        </button>
      </div>

    </footer>
  )
}
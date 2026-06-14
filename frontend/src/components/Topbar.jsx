import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Shield, ChevronDown } from 'lucide-react'
import './Topbar.css'

export default function Topbar({ cpu = 18, gpu = 32 }) {
  const [time, setTime]       = useState(new Date())
  const [dropOpen, setDrop]   = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  const isWeapon = location.pathname === '/weapon-detection'

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (d) =>
    d.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })

  return (
    <header className="topbar">

      {/* LEFT */}
      <div className="topbar-left">
        <Shield size={18} className="topbar-logo-icon" />
        <span className="topbar-title">SENTINEL AI</span>
        <span className="topbar-version">v2.4.1</span>
      </div>

      {/* CENTER — CPU / GPU bars */}
      <div className="topbar-center">
        <div className="topbar-stat">
          <span className="topbar-stat-label">CPU</span>
          <div className="topbar-bar">
            <div className="topbar-bar-fill blue" style={{ width: `${cpu}%` }} />
          </div>
          <span className="topbar-stat-value blue">{cpu}%</span>
        </div>
        <div className="topbar-stat">
          <span className="topbar-stat-label">GPU</span>
          <div className="topbar-bar">
            <div className="topbar-bar-fill yellow" style={{ width: `${gpu}%` }} />
          </div>
          <span className="topbar-stat-value yellow">{gpu}%</span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="topbar-right">

        {/* Dropdown mode switcher */}
        <div className="mode-selector" onClick={() => setDrop(o => !o)}>
          <span className={`mode-dot ${isWeapon ? 'red' : 'yellow'}`} />
          <span className="mode-label">
            {isWeapon ? 'Weapon Detection' : 'Fight Detection'}
          </span>
          <ChevronDown size={13} className={`mode-chevron ${dropOpen ? 'open' : ''}`} />

          {dropOpen && (
            <div className="mode-dropdown">
              <div
                className={`mode-option ${isWeapon ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/weapon-detection')
                  setDrop(false)
                }}
              >
                <span className="mode-dot red" />
                Weapon Detection
              </div>
              <div
                className={`mode-option ${!isWeapon ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/fight-detection')
                  setDrop(false)
                }}
              >
                <span className="mode-dot yellow" />
                Fight Detection
              </div>
            </div>
          )}
        </div>

        <div className="topbar-status">
          <span className="status-dot" />
          <span className="status-label">CONNECTED</span>
        </div>

        <span className="topbar-time">{fmt(time)}</span>
      </div>
    </header>
  )
}
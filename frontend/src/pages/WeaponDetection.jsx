import { useState, useRef } from 'react'
import Topbar from '../components/Topbar.jsx'
import Bottombar from '../components/Bottombar.jsx'
import DashboardLayout from '../components/DashboardLayout.jsx'
import './Page.css'

const IDLE_STATE = {
  aiStatus: 'IDLE', threatLevel: 'LOW',
  detections: [], incidents: [], insights: null,
  cpu: 18, gpu: 32,
}

const STATS_IDLE = [
  { label: 'FRAMES',  value: '0', color: 'var(--text-muted)' },
  { label: 'OBJECTS', value: '0', color: 'var(--text-muted)' },
  { label: 'ALERTS',  value: '0', color: 'var(--text-muted)' },
  { label: 'FPS',     value: '—', color: 'var(--text-muted)' },
]

function buildStats(result) {
  const weaponCount = result?.weapons?.count ?? 0
  return [
    { label: 'FRAMES',  value: '—',                color: 'var(--accent-blue)' },
    { label: 'OBJECTS', value: String(weaponCount), color: weaponCount > 0 ? 'var(--accent-red)'   : 'var(--text-muted)' },
    { label: 'ALERTS',  value: String(weaponCount), color: weaponCount > 0 ? 'var(--accent-red)'   : 'var(--accent-green)' },
    { label: 'FPS',     value: '—',                color: 'var(--text-muted)' },
  ]
}

export default function WeaponDetection() {
  const [monitoring,  setMonitoring]  = useState(false)
  const [state,       setState]       = useState(IDLE_STATE)
  const [stats,       setStats]       = useState(STATS_IDLE)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [frameBoxes,  setFrameBoxes]  = useState({})
  const [persons,     setPersons]     = useState([])
  const fileRef = useRef(null)

  const handleFile = (file) => {
    fileRef.current = file
    setState(IDLE_STATE)
    setStats(STATS_IDLE)
    setFrameBoxes({})
    setPersons([])
    setError(null)
  }

  const startAnalysis = async () => {
    const file = fileRef.current
    if (!file) { setError('Please upload a video or image first.'); return }

    setLoading(true)
    setError(null)
    setMonitoring(true)
    setState(s => ({ ...s, aiStatus: 'SCANNING', threatLevel: 'MEDIUM' }))

    try {
      const form     = new FormData()
      form.append('file', file)
      const isVideo  = file.type.startsWith('video/')
      const endpoint = isVideo ? '/analyze/video' : '/analyze/image'

      const res = await fetch(endpoint, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const result = await res.json()

      // ── Per-frame boxes for animated bbox overlay ─────────────────────────
      setFrameBoxes(result.frame_detections ?? {})
      setPersons(result.violence?.persons ?? [])

      // ── Detections list ───────────────────────────────────────────────────
      const detections = []
      result.weapons?.detections?.forEach(w => {
        detections.push({
          label:      w.class,
          confidence: Math.round(w.confidence * 100),
          bbox:       w.bbox ?? null,
        })
      })
      if (result.violence?.detected) {
        detections.push({
          label:      'Violent Behavior',
          confidence: Math.round(result.violence.confidence * 100),
        })
      }

      // ── Incidents list ────────────────────────────────────────────────────
      const incidents = []
      result.weapons?.detections?.forEach(w => {
        incidents.push({
          type:     `${w.class} detected`,
          time:     new Date().toLocaleTimeString(),
          severity: w.confidence > 0.75 ? 'high' : 'medium',
        })
      })
      if (result.violence?.detected) {
        incidents.push({
          type:     'Violent Behavior',
          time:     new Date().toLocaleTimeString(),
          severity: 'medium',
        })
      }

      // ── Threat level ──────────────────────────────────────────────────────
      const threatLevel = result.weapons?.count > 0
        ? 'HIGH'
        : result.violence?.detected ? 'MEDIUM' : 'LOW'

      // ── Insights ──────────────────────────────────────────────────────────
      let insights = null
      if (result.weapons?.detected) {
        const names = result.weapons.detections.map(w => w.class).join(', ')
        insights = `Weapon-class object(s) detected: ${names}. Confidence threshold exceeded. Recommend immediate review.`
      } else if (result.violence?.detected) {
        insights = `No weapons detected, but violent behavior flagged at ${Math.round(result.violence.confidence * 100)}% confidence.`
      } else {
        insights = 'No weapons or threats detected. Scene appears clear.'
      }

      setState({ aiStatus: 'ACTIVE', threatLevel, detections, incidents, insights, cpu: 54, gpu: 71 })
      setStats(buildStats(result))

    } catch (e) {
      setError(e.message)
      setState(s => ({ ...s, aiStatus: 'ERROR', threatLevel: 'LOW' }))
    } finally {
      setLoading(false)
    }
  }

  const stopMonitoring = () => {
    setMonitoring(false)
    setState(IDLE_STATE)
    setStats(STATS_IDLE)
    setFrameBoxes({})
    setPersons([])
    setError(null)
    fileRef.current = null
  }

  const toggle = () => { if (monitoring) stopMonitoring(); else startAnalysis() }

  return (
    <div className="page-root">
      <Topbar cpu={state.cpu} gpu={state.gpu} />

      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 999, color: '#ff3b3b',
          fontFamily: 'Share Tech Mono, monospace', gap: '1rem',
        }}>
          <div style={{ fontSize: '1.1rem', letterSpacing: '0.15em' }}>⟳ SCANNING FOR WEAPONS…</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Running YOLO weapon detection model
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(255,59,59,0.15)', border: '1px solid rgba(255,59,59,0.4)',
          color: '#ff3b3b', padding: '0.5rem 1.5rem',
          fontSize: '0.78rem', fontFamily: 'Share Tech Mono, monospace',
          textAlign: 'center',
        }}>
          ⚠ {error}
        </div>
      )}

      <DashboardLayout
        accentColor="red"
        detections={state.detections}
        incidents={state.incidents}
        monitoring={monitoring}
        aiStatus={loading ? 'SCANNING…' : state.aiStatus}
        threatLevel={state.threatLevel}
        insights={state.insights}
        stats={stats}
        onFile={handleFile}
        persons={persons}
        frameBoxes={frameBoxes}
      />

      <Bottombar onStartMonitoring={toggle} monitoring={monitoring} />
    </div>
  )
}
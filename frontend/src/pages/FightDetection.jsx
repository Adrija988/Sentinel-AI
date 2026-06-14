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
  { label: 'PERSONS', value: '0', color: 'var(--text-muted)' },
  { label: 'ALERTS',  value: '0', color: 'var(--text-muted)' },
  { label: 'FPS',     value: '—', color: 'var(--text-muted)' },
]

function buildStats(result) {
  const weaponCount = result?.weapons?.count ?? 0
  const alertCount  = (result?.violence?.detected ? 1 : 0) + weaponCount
  return [
    { label: 'FRAMES',  value: '—',             color: 'var(--accent-blue)' },
    { label: 'PERSONS', value: '—',             color: 'var(--accent-yellow)' },
    { label: 'ALERTS',  value: String(alertCount), color: alertCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)' },
    { label: 'FPS',     value: '—',             color: 'var(--text-muted)' },
  ]
}

export default function FightDetection() {
  const [monitoring,  setMonitoring]  = useState(false)
  const [state,       setState]       = useState(IDLE_STATE)
  const [stats,       setStats]       = useState(STATS_IDLE)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [persons,     setPersons]     = useState([])
  const [frameBoxes,  setFrameBoxes]  = useState({})
  const fileRef = useRef(null)

  const handleFile = (file) => {
    fileRef.current = file
    setState(IDLE_STATE)
    setStats(STATS_IDLE)
    setPersons([])
    setFrameBoxes({})
    setError(null)
  }

  const startAnalysis = async () => {
    const file = fileRef.current
    if (!file) { setError('Please upload a video first.'); return }

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
      if (result.violence?.detected) {
        detections.push({
          label:      'Violence / Fight Detected',
          confidence: Math.round(result.violence.confidence * 100),
          bbox:       null,
        })
      }
      result.weapons?.detections?.forEach(w => {
        detections.push({
          label:      w.class,
          confidence: Math.round(w.confidence * 100),
          bbox:       w.bbox ?? null,
        })
      })

      // ── Incidents list ────────────────────────────────────────────────────
      const incidents = []
      if (result.violence?.detected) {
        incidents.push({
          type:     `Fight — ${result.violence.label}`,
          time:     new Date().toLocaleTimeString(),
          severity: result.violence.confidence > 0.8 ? 'high' : 'medium',
        })
      }

      // ── Threat level ──────────────────────────────────────────────────────
      const threatLevel = result.alert
        ? (result.violence?.confidence > 0.8 || result.weapons?.count > 0 ? 'HIGH' : 'MEDIUM')
        : 'LOW'

      // ── Insights ──────────────────────────────────────────────────────────
      let insights = null
      if (result.alert) {
        const parts = []
        if (result.violence?.detected)
          parts.push(`Fight/violence detected with ${Math.round(result.violence.confidence * 100)}% confidence.`)
        if (result.weapons?.detected)
          parts.push(`${result.weapons.count} weapon(s) identified: ${result.weapons.detections.map(w => w.class).join(', ')}.`)
        parts.push('Flagging for immediate review.')
        insights = parts.join(' ')
      } else {
        insights = 'No violence or weapons detected. Scene appears safe.'
      }

      setState({ aiStatus: 'ACTIVE', threatLevel, detections, incidents, insights, cpu: 65, gpu: 80 })
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
    setPersons([])
    setFrameBoxes({})
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
          zIndex: 999, color: '#ffb800',
          fontFamily: 'Share Tech Mono, monospace', gap: '1rem',
        }}>
          <div style={{ fontSize: '1.1rem', letterSpacing: '0.15em' }}>⟳ ANALYZING…</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Running violence &amp; weapon detection models
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
        accentColor="yellow"
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
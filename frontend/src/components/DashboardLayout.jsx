import { useState, useEffect, useRef } from 'react'
import { Upload, Zap, Eye, Maximize2 } from 'lucide-react'
import './DashboardLayout.css'

/* ── Animated Heatmap ───────────────────────────────────── */
function Heatmap({ active, accentColor }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const timeRef   = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const draw = () => {
      timeRef.current += 0.015
      const t = timeRef.current
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const blobs = [
        { x: 0.35 + Math.sin(t * 0.7) * 0.08, y: 0.45 + Math.cos(t * 0.5) * 0.1,  r: 0.28, intensity: active ? 0.9 : 0.55 },
        { x: 0.65 + Math.cos(t * 0.4) * 0.06, y: 0.40 + Math.sin(t * 0.6) * 0.08, r: 0.22, intensity: active ? 0.7 : 0.38 },
        { x: 0.50 + Math.sin(t * 0.3) * 0.10, y: 0.60 + Math.cos(t * 0.8) * 0.05, r: 0.18, intensity: active ? 0.5 : 0.25 },
      ]
      blobs.forEach(({ x, y, r, intensity }) => {
        const grd = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w)
        if (accentColor === 'red') {
          grd.addColorStop(0,   `rgba(255, 60, 60, ${intensity})`)
          grd.addColorStop(0.4, `rgba(200, 80, 20, ${intensity * 0.55})`)
        } else {
          grd.addColorStop(0,   `rgba(255, 180, 0, ${intensity})`)
          grd.addColorStop(0.4, `rgba(200, 100, 20, ${intensity * 0.55})`)
        }
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, w, h)
      })
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, accentColor])

  return <canvas ref={canvasRef} width={480} height={140} className="heatmap-canvas" />
}

/* ── Radar ──────────────────────────────────────────────── */
function Radar({ active, accentColor }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const angleRef  = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const R  = cx - 10
    const blips = [
      { angle: 45,  dist: 0.55, color: accentColor === 'red' ? '#ff3b3b' : '#ffb800' },
      { angle: 160, dist: 0.35, color: '#1a6aff' },
      { angle: 260, dist: 0.70, color: accentColor === 'red' ? '#ffb800' : '#ff3b3b' },
    ]
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = 'rgba(30,61,95,0.55)'
      ctx.lineWidth   = 0.8
      ;[0.25, 0.5, 0.75, 1].forEach(r => {
        ctx.beginPath(); ctx.arc(cx, cy, r * R, 0, Math.PI * 2); ctx.stroke()
      })
      ctx.beginPath()
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
      ctx.stroke()
      if (active) {
        angleRef.current += 0.025
        const a   = angleRef.current
        const x2  = cx + Math.cos(a) * R
        const y2  = cy + Math.sin(a) * R
        const ac  = accentColor === 'red' ? 'rgba(255,59,59,' : 'rgba(255,184,0,'
        const grd = ctx.createLinearGradient(cx, cy, x2, y2)
        grd.addColorStop(0, ac + '0.28)'); grd.addColorStop(1, ac + '0.04)')
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a - 1.2, a)
        ctx.closePath(); ctx.fillStyle = grd; ctx.fill()
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2)
        ctx.strokeStyle = accentColor === 'red' ? 'rgba(255,59,59,0.85)' : 'rgba(255,184,0,0.85)'
        ctx.lineWidth = 1.5; ctx.stroke()
      }
      blips.forEach(({ angle, dist, color }) => {
        const rad = (angle * Math.PI) / 180
        const bx  = cx + Math.cos(rad) * dist * R
        const by  = cy + Math.sin(rad) * dist * R
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.shadowBlur = 10; ctx.shadowColor = color
        ctx.fill(); ctx.shadowBlur = 0
      })
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, accentColor])

  return <canvas ref={canvasRef} width={180} height={180} className="radar-canvas" />
}

/* ── Upload Zone with bbox canvas overlay ───────────────── */
function UploadZone({ onFile, videoSrc, isVideo, monitoring, accentColor, detections, persons, frameBoxes }) {
  const [dragging, setDragging] = useState(false)
  const inputRef  = useRef(null)
  const mediaRef  = useRef(null)
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  // ── Draw bounding boxes scaled to displayed element size ──
  const drawBoxes = (dets = [], pers = []) => {
    const media  = mediaRef.current
    const canvas = canvasRef.current
    if (!media || !canvas) return

    const rect = media.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    canvas.width  = rect.width
    canvas.height = rect.height

    const natW   = media.videoWidth  || media.naturalWidth  || rect.width
    const natH   = media.videoHeight || media.naturalHeight || rect.height
    const scaleX = rect.width  / natW
    const scaleY = rect.height / natH

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // ── Weapon boxes — RED ────────────────────────────────────────────────────
    dets.forEach((det) => {
      const bbox = det.bbox
      if (!bbox) return
      const name = det.label || det.class || 'Weapon'
      const conf = det.confidence > 1
        ? Math.round(det.confidence)
        : Math.round(det.confidence * 100)
      const [x1, y1, x2, y2] = bbox
      const sx = x1 * scaleX, sy = y1 * scaleY
      const sw = (x2 - x1) * scaleX, sh = (y2 - y1) * scaleY

      ctx.strokeStyle = '#ff3b3b'
      ctx.lineWidth   = 2
      ctx.strokeRect(sx, sy, sw, sh)

      const text = `${name} ${conf}%`
      ctx.font    = 'bold 11px monospace'
      const tw    = ctx.measureText(text).width
      const ty    = Math.max(0, sy - 18)
      ctx.fillStyle = 'rgba(255,59,59,0.85)'
      ctx.fillRect(sx, ty, tw + 8, 18)
      ctx.fillStyle = '#fff'
      ctx.fillText(text, sx + 4, ty + 13)
    })

    // ── Fight / motion boxes — YELLOW ─────────────────────────────────────────
    pers.forEach((p) => {
      const bbox = p.bbox
      if (!bbox) return
      const name = p.label || 'Fight'
      const [x1, y1, x2, y2] = bbox
      const sx = x1 * scaleX, sy = y1 * scaleY
      const sw = (x2 - x1) * scaleX, sh = (y2 - y1) * scaleY

      ctx.strokeStyle = '#ffb800'
      ctx.lineWidth   = 2
      ctx.strokeRect(sx, sy, sw, sh)

      ctx.font    = 'bold 11px monospace'
      const tw    = ctx.measureText(name).width
      const ty    = Math.max(0, sy - 18)
      ctx.fillStyle = 'rgba(255,184,0,0.85)'
      ctx.fillRect(sx, ty, tw + 8, 18)
      ctx.fillStyle = '#000'
      ctx.fillText(name, sx + 4, ty + 13)
    })
  }

  // ── Animation loop for VIDEO ──────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const hasFrames = frameBoxes && Object.keys(frameBoxes).length > 0
    if (!isVideo || !hasFrames) return
    const video = mediaRef.current
    if (!video) return

    const frameKeys = Object.keys(frameBoxes).map(Number).sort((a, b) => a - b)
    const maxFrame  = Math.max(...frameKeys)

    const loop = () => {
      const pct         = (video.currentTime || 0) / (video.duration || 1)
      const approxFrame = Math.round(pct * maxFrame)
      const closest     = frameKeys.reduce((p, c) =>
        Math.abs(c - approxFrame) < Math.abs(p - approxFrame) ? c : p
      )
      const { detections: fd = [], persons: fp = [] } = frameBoxes[closest] || {}
      drawBoxes(fd, fp)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [frameBoxes, isVideo])

  // ── Static draw for IMAGE ─────────────────────────────────
  useEffect(() => {
    if (!isVideo && videoSrc) drawBoxes(detections, persons)
  }, [detections, persons, isVideo, videoSrc])

  // ── Redraw when media loads ───────────────────────────────
  useEffect(() => {
    const media = mediaRef.current
    if (!media || !videoSrc) return
    const evt    = isVideo ? 'loadeddata' : 'load'
    const onLoad = () => { if (!isVideo) drawBoxes(detections, persons) }
    media.addEventListener(evt, onLoad)
    return () => media.removeEventListener(evt, onLoad)
  }, [videoSrc, isVideo])

  return (
    <div
      className={[
        'upload-zone',
        dragging   ? 'drag'                      : '',
        monitoring ? `monitoring ${accentColor}` : '',
      ].join(' ')}
      style={{ position: 'relative', overflow: 'hidden' }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !videoSrc && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*"
        hidden
        onChange={(e) => onFile(e.target.files[0])}
      />

      {videoSrc ? (
        isVideo ? (
          <video
            ref={mediaRef}
            src={videoSrc}
            controls autoPlay muted loop
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <img
            ref={mediaRef}
            src={videoSrc}
            alt="analyzed"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        )
      ) : (
        <div className="upload-placeholder">
          <div className="upload-icon-box"><Upload size={26} /></div>
          <p className="upload-title">Upload Video or Image for Analysis</p>
          <p className="upload-sub">Drag &amp; drop or click • MP4, AVI, MOV, JPG, PNG</p>
        </div>
      )}

      {videoSrc && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
          }}
        />
      )}

      {monitoring && <div className="scan-line" />}
    </div>
  )
}

/* ── Incident row ───────────────────────────────────────── */
function IncidentItem({ type, time, severity }) {
  return (
    <div className={`incident-item ${severity}`}>
      <div className={`incident-dot ${severity}`} />
      <div className="incident-info">
        <span className="incident-type">{type}</span>
        <span className="incident-time">{time}</span>
      </div>
      <span className={`incident-badge ${severity}`}>{severity.toUpperCase()}</span>
    </div>
  )
}

/* ── Main Dashboard ─────────────────────────────────────── */
export default function DashboardLayout({
  accentColor, detections, incidents, monitoring,
  aiStatus, threatLevel, insights, stats, onFile,
  persons, frameBoxes,
}) {
  const [videoSrc, setVideoSrc] = useState(null)
  const [isVideo,  setIsVideo]  = useState(false)
  const [timer,    setTimer]    = useState(0)

  useEffect(() => {
    let t
    if (monitoring) t = setInterval(() => setTimer(s => s + 1), 1000)
    else setTimer(0)
    return () => clearInterval(t)
  }, [monitoring])

  useEffect(() => {
    if (!monitoring) { setVideoSrc(null); setIsVideo(false) }
  }, [monitoring])

  const fmtTimer = (s) => {
    const h   = String(Math.floor(s / 3600)).padStart(2, '0')
    const m   = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${h}:${m}:${sec}`
  }

  const handleFile = (file) => {
    setVideoSrc(URL.createObjectURL(file))
    setIsVideo(file.type.startsWith('video/'))
    onFile?.(file)
  }

  const accentVar = accentColor === 'red' ? 'var(--accent-red)' : 'var(--accent-yellow)'

  return (
    <div className="dash-grid">

      {/* ── LEFT: Video Analysis ── */}
      <div className="dash-panel">
        <div className="panel-header">
          <span className="panel-title">VIDEO ANALYSIS</span>
          <span className={`panel-timer ${monitoring ? 'active' : ''}`}>{fmtTimer(timer)}</span>
        </div>

        <UploadZone
          onFile={handleFile}
          videoSrc={videoSrc}
          isVideo={isVideo}
          monitoring={monitoring}
          accentColor={accentColor}
          detections={detections ?? []}
          persons={persons       ?? []}
          frameBoxes={frameBoxes ?? {}}
        />

        <div className="vstats">
          {stats.map((s, i) => (
            <div key={i} className="vstat">
              <span className="vstat-label">{s.label}</span>
              <span className="vstat-value" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MIDDLE: AI Insights ── */}
      <div className="dash-panel">
        <div className="panel-header">
          <span className="panel-title">AI INSIGHTS</span>
          <span className={`ai-pill ${monitoring ? 'active' : ''}`}>●</span>
        </div>

        <div className="ai-meta">
          <div className="ai-meta-row">
            <span className="ai-meta-key">AI STATUS:</span>
            <span className={`ai-meta-val ${monitoring ? 'green' : ''}`}>{aiStatus}</span>
          </div>
          <div className="ai-meta-row">
            <span className="ai-meta-key">Threat Level:</span>
            <span className={`ai-meta-val threat-${threatLevel.toLowerCase()}`}>{threatLevel}</span>
          </div>
        </div>

        <span className="heatmap-label">HEATMAP</span>
        <Heatmap active={monitoring} accentColor={accentColor} />

        <div className="sub-header">
          <Zap size={13} style={{ color: accentVar }} />
          <span className="sub-title">Active Detections</span>
        </div>

        <div className="detections-list">
          {detections.length === 0 ? (
            <p className="no-data">No activity detected</p>
          ) : (
            detections.map((d, i) => (
              <div key={i} className="det-item">
                <div className="det-bar" style={{ width: `${d.confidence}%`, background: accentVar }} />
                <span className="det-label">{d.label}</span>
                <span className="det-conf">{d.confidence}%</span>
              </div>
            ))
          )}
        </div>

        <div className="panel-header" style={{ marginTop: 'auto' }}>
          <span className="panel-title">AI INSIGHTS</span>
          <Eye size={13} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div className="insights-text">
          {insights ?? <span className="no-data">No detections yet</span>}
        </div>
      </div>

      {/* ── RIGHT: Incident Timeline ── */}
      <div className="dash-panel">
        <div className="panel-header">
          <span className="panel-title">INCIDENT TIMELINE</span>
          <Maximize2 size={12} style={{ color: 'var(--text-secondary)' }} />
        </div>

        <div className="sev-legend">
          <span className="sev low">LOW</span>
          <span className="sev medium">MEDIUM</span>
          <span className="sev high">HIGH</span>
        </div>

        <div className="incidents-list">
          {incidents.length === 0 ? (
            <div className="no-incidents">
              <span className="no-inc-icon">⊕</span>
              <p>No incidents detected yet.</p>
            </div>
          ) : (
            incidents.map((inc, i) => <IncidentItem key={i} {...inc} />)
          )}
        </div>

        <div className="radar-wrap">
          <Radar active={monitoring} accentColor={accentColor} />
        </div>
      </div>

    </div>
  )
}
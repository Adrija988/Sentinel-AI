// components/BBoxOverlay.jsx
import { useEffect, useRef } from 'react'

/**
 * Renders bounding boxes on a canvas overlaid on top of an image or video.
 *
 * Props:
 *   mediaUrl   - object URL of the uploaded file (from URL.createObjectURL)
 *   isVideo    - boolean
 *   detections - array of { label, confidence, bbox: [x1,y1,x2,y2] }
 *   persons    - array of { bbox: [x1,y1,x2,y2] }  (for fight detection)
 */
export default function BBoxOverlay({ mediaUrl, isVideo, detections = [], persons = [] }) {
  const mediaRef  = useRef(null)
  const canvasRef = useRef(null)

  const drawBoxes = () => {
    const media  = mediaRef.current
    const canvas = canvasRef.current
    if (!media || !canvas) return

    const W = media.videoWidth  || media.naturalWidth  || media.clientWidth
    const H = media.videoHeight || media.naturalHeight || media.clientHeight

    canvas.width  = W
    canvas.height = H

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)

    // Draw weapon detections in RED
    detections.forEach(({ label, confidence, bbox }) => {
      if (!bbox) return
      const [x1, y1, x2, y2] = bbox
      ctx.strokeStyle = '#ff3b3b'
      ctx.lineWidth   = 2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      // Label background
      const text = `${label} ${confidence}%`
      ctx.font = 'bold 13px Share Tech Mono, monospace'
      const tw = ctx.measureText(text).width
      ctx.fillStyle = 'rgba(255,59,59,0.75)'
      ctx.fillRect(x1, y1 - 20, tw + 8, 20)
      ctx.fillStyle = '#fff'
      ctx.fillText(text, x1 + 4, y1 - 5)
    })

    // Draw person/fight boxes in YELLOW
    persons.forEach(({ bbox }) => {
      if (!bbox) return
      const [x1, y1, x2, y2] = bbox
      ctx.strokeStyle = '#ffb800'
      ctx.lineWidth   = 2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      ctx.font = 'bold 13px Share Tech Mono, monospace'
      ctx.fillStyle = 'rgba(255,184,0,0.75)'
      ctx.fillRect(x1, y1 - 20, 60, 20)
      ctx.fillStyle = '#000'
      ctx.fillText('PERSON', x1 + 4, y1 - 5)
    })
  }

  // Redraw whenever detections change
  useEffect(() => {
    const media = mediaRef.current
    if (!media) return
    if (isVideo) {
      media.addEventListener('loadeddata', drawBoxes)
      return () => media.removeEventListener('loadeddata', drawBoxes)
    } else {
      media.addEventListener('load', drawBoxes)
      return () => media.removeEventListener('load', drawBoxes)
    }
  }, [mediaUrl])

  useEffect(() => { drawBoxes() }, [detections, persons])

  const wrapStyle = {
    position: 'relative', display: 'inline-block',
    width: '100%', maxWidth: '720px',
  }
  const mediaStyle = { width: '100%', display: 'block', borderRadius: '6px' }
  const canvasStyle = {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none',
  }

  return (
    <div style={wrapStyle}>
      {isVideo
        ? <video ref={mediaRef} src={mediaUrl} controls style={mediaStyle} />
        : <img   ref={mediaRef} src={mediaUrl} alt="analyzed" style={mediaStyle} />
      }
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  )
}
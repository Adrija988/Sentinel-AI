// src/api.js
// All calls go through Vite's proxy → FastAPI on :8000

const BASE = ""  // proxy handles it — no need for http://localhost:8000

/**
 * Analyze an image file
 * @param {File} file
 * @returns {Promise<object>}
 */
export async function analyzeImage(file) {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`${BASE}/analyze/image`, {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Server error ${res.status}`)
  }

  return res.json()
}

/**
 * Analyze a video file
 * @param {File} file
 * @returns {Promise<object>}
 */
export async function analyzeVideo(file) {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`${BASE}/analyze/video`, {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Server error ${res.status}`)
  }

  return res.json()
}

/**
 * Analyze an image from a URL
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function analyzeUrl(url) {
  const res = await fetch(`${BASE}/analyze/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Server error ${res.status}`)
  }

  return res.json()
}

/**
 * Health check
 * @returns {Promise<object>}
 */
export async function healthCheck() {
  const res = await fetch(`${BASE}/health`)
  return res.json()
}
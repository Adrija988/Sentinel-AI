from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
import cv2
import os
import shutil
import tempfile
from pathlib import Path

# ── Model imports ──────────────────────────────────────────────────────────────
import tensorflow as tf
from tensorflow.keras.models import load_model
from ultralytics import YOLO

# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(title="Violence & Weapon Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR       = Path(__file__).parent
VIOLENCE_MODEL = BASE_DIR / "backend" / "Violence_Detection_best_model.keras"
WEAPON_MODEL   = BASE_DIR / "backend" / "Weapon_best.pt"

# ── Weapon class names ────────────────────────────────────────────────────────
WEAPON_CLASSES = [
    "Automatic Rifle", "Bazooka", "Handgun",
    "Knife", "Grenade Launcher", "Shotgun",
    "SMG", "Sniper", "Sword"
]

# ── Load models at startup ─────────────────────────────────────────────────────
print("Loading Violence Detection model...")
violence_model = load_model(str(VIOLENCE_MODEL))
print("✅ Violence model loaded")

print("Loading Weapon Detection model...")
weapon_model = YOLO(str(WEAPON_MODEL))
print("✅ Weapon model loaded")

# ── Helper: preprocess image for violence model ───────────────────────────────
def preprocess_image(img: np.ndarray, target_size=(224, 224)) -> np.ndarray:
    img_resized = cv2.resize(img, target_size)
    img_rgb     = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
    img_norm    = img_rgb.astype(np.float32) / 255.0
    return np.expand_dims(img_norm, axis=0)

# ── Helper: extract frames from video ────────────────────────────────────────
def extract_frames(video_path: str, num_frames: int = 16, target_size=(224, 224)):
    cap    = cv2.VideoCapture(video_path)
    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    idxs   = np.linspace(0, total - 1, num_frames, dtype=int)
    frames = []
    for i in idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if ret:
            frame = cv2.resize(frame, target_size)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(frame.astype(np.float32) / 255.0)
    cap.release()
    return np.array(frames)

# ── Helper: detect motion boxes using background subtraction (like Kaggle) ────
def detect_motion_boxes(frame, prev_frame, min_area=500):
    """
    Detects motion regions between two consecutive frames.
    Returns list of bounding boxes [x1, y1, x2, y2] around moving areas.
    This is how the Kaggle notebook localized fights.
    """
    if prev_frame is None:
        return []

    # Convert to grayscale
    gray1 = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(frame,      cv2.COLOR_BGR2GRAY)

    # Blur to reduce noise
    gray1 = cv2.GaussianBlur(gray1, (21, 21), 0)
    gray2 = cv2.GaussianBlur(gray2, (21, 21), 0)

    # Frame difference
    diff = cv2.absdiff(gray1, gray2)

    # Threshold
    _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

    # Dilate to fill gaps
    thresh = cv2.dilate(thresh, None, iterations=3)

    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    boxes = []
    for cnt in contours:
        if cv2.contourArea(cnt) < min_area:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        boxes.append([
            round(float(x), 1),
            round(float(y), 1),
            round(float(x + w), 1),
            round(float(y + h), 1)
        ])

    # Merge overlapping boxes
    if len(boxes) > 1:
        boxes = merge_boxes(boxes)

    return boxes


def merge_boxes(boxes, overlap_thresh=0.3):
    """Merge overlapping bounding boxes into one."""
    if not boxes:
        return []

    x1 = min(b[0] for b in boxes)
    y1 = min(b[1] for b in boxes)
    x2 = max(b[2] for b in boxes)
    y2 = max(b[3] for b in boxes)

    # If boxes are spread across the frame, keep top 2 largest instead of merging all
    if len(boxes) > 4:
        areas = [(b[2]-b[0]) * (b[3]-b[1]) for b in boxes]
        sorted_boxes = [b for _, b in sorted(zip(areas, boxes), reverse=True)]
        return sorted_boxes[:2]

    return [[x1, y1, x2, y2]]


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"message": "Violence & Weapon Detection API is running 🚀"}

@app.get("/health")
def health():
    return {"status": "ok", "models": ["violence", "weapon"]}


# ── 1. Analyze IMAGE ──────────────────────────────────────────────────────────
@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    # Accept any file — let OpenCV decide
    suffix = Path(file.filename).suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        img = cv2.imread(tmp_path)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not read image.")

        # ── Violence detection ────────────────────────────────────────────────
        processed = preprocess_image(img)
        v_pred    = violence_model.predict(processed, verbose=0)
        v_score   = float(v_pred[0][0])
        violence  = v_score > 0.5
        v_label   = "Violence Detected" if violence else "No Violence"

        # ── Weapon detection ──────────────────────────────────────────────────
        w_results  = weapon_model(tmp_path, verbose=False)[0]
        detections = []
        for box in w_results.boxes:
            cls_id     = int(box.cls[0])
            confidence = float(box.conf[0])
            if confidence > 0.4:
                detections.append({
                    "class":      WEAPON_CLASSES[cls_id] if cls_id < len(WEAPON_CLASSES) else f"class_{cls_id}",
                    "confidence": round(confidence, 3),
                    "bbox":       [round(x, 1) for x in box.xyxy[0].tolist()]
                })

        # ── For images, no motion boxes possible (need 2 frames) ─────────────
        return JSONResponse({
            "type": "image",
            "violence": {
                "label":      v_label,
                "confidence": round(v_score, 3),
                "detected":   violence,
                "persons":    []
            },
            "weapons": {
                "detected":   len(detections) > 0,
                "count":      len(detections),
                "detections": detections
            },
            "frame_detections": {},
            "total_frames":     1,
            "alert": violence or len(detections) > 0
        })

    finally:
        os.unlink(tmp_path)


# ── 2. Analyze VIDEO ──────────────────────────────────────────────────────────
@app.post("/analyze/video")
async def analyze_video(file: UploadFile = File(...)):
    # Accept any file — let OpenCV decide
    suffix = Path(file.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # ── Violence detection on sampled frames ──────────────────────────────
        frames = extract_frames(tmp_path, num_frames=16)
        if len(frames) == 0:
            raise HTTPException(status_code=400, detail="Could not extract frames from video.")

        v_scores = []
        for frame in frames:
            inp  = np.expand_dims(frame, axis=0)
            pred = violence_model.predict(inp, verbose=0)
            v_scores.append(float(pred[0][0]))

        avg_v_score = float(np.mean(v_scores))
        violence    = avg_v_score > 0.5
        v_label     = "Violence Detected" if violence else "No Violence"

        # ── Weapon + motion detection on sampled frames ───────────────────────
        cap   = cv2.VideoCapture(tmp_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        idxs  = np.linspace(0, total - 1, min(8, total), dtype=int)

        all_weapon_detections = []
        frame_detections      = {}
        prev_frame            = None

        for idx, i in enumerate(idxs):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if not ret:
                prev_frame = None
                continue

            fnum = int(i)
            if fnum not in frame_detections:
                frame_detections[fnum] = {"detections": [], "persons": []}

            # ── Weapon detection ──────────────────────────────────────────────
            w_results = weapon_model(frame, verbose=False)[0]
            for box in w_results.boxes:
                cls_id     = int(box.cls[0])
                confidence = float(box.conf[0])
                if confidence > 0.4:
                    det = {
                        "label":      WEAPON_CLASSES[cls_id] if cls_id < len(WEAPON_CLASSES) else f"class_{cls_id}",
                        "confidence": round(confidence, 3),
                        "bbox":       [round(x, 1) for x in box.xyxy[0].tolist()],
                        "frame":      fnum
                    }
                    all_weapon_detections.append(det)
                    frame_detections[fnum]["detections"].append({
                        "label":      det["label"],
                        "confidence": det["confidence"],
                        "bbox":       det["bbox"],
                    })

            # ── Motion boxes for fight localization ───────────────────────────
            if violence and prev_frame is not None:
                motion_boxes = detect_motion_boxes(frame, prev_frame)
                for bbox in motion_boxes:
                    frame_detections[fnum]["persons"].append({
                        "bbox":  bbox,
                        "label": "Fight",
                    })

            prev_frame = frame.copy()

        cap.release()

        # ── Deduplicate weapons by class (keep highest confidence) ────────────
        seen = {}
        for d in all_weapon_detections:
            cls = d["label"]
            if cls not in seen or d["confidence"] > seen[cls]["confidence"]:
                seen[cls] = d
        unique = list(seen.values())

        return JSONResponse({
            "type": "video",
            "violence": {
                "label":      v_label,
                "confidence": round(avg_v_score, 3),
                "detected":   violence,
                "persons":    []
            },
            "weapons": {
                "detected":   len(unique) > 0,
                "count":      len(unique),
                "detections": [{
                    "class":      d["label"],
                    "confidence": d["confidence"],
                    "bbox":       d["bbox"]
                } for d in unique]
            },
            "frame_detections": frame_detections,
            "total_frames":     int(total),
            "alert": violence or len(unique) > 0
        })

    finally:
        os.unlink(tmp_path)


# ── 3. Analyze via URL (optional) ─────────────────────────────────────────────
@app.post("/analyze/url")
async def analyze_url(payload: dict):
    import requests as req
    url = payload.get("url", "")
    if not url:
        raise HTTPException(status_code=400, detail="Provide a 'url' field.")

    resp = req.get(url, timeout=10)
    arr  = np.frombuffer(resp.content, np.uint8)
    img  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image from URL.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        cv2.imwrite(tmp.name, img)
        tmp_path = tmp.name

    try:
        processed = preprocess_image(img)
        v_pred    = violence_model.predict(processed, verbose=0)
        v_score   = float(v_pred[0][0])
        violence  = v_score > 0.5

        w_results  = weapon_model(tmp_path, verbose=False)[0]
        detections = []
        for box in w_results.boxes:
            cls_id     = int(box.cls[0])
            confidence = float(box.conf[0])
            if confidence > 0.4:
                detections.append({
                    "class":      WEAPON_CLASSES[cls_id] if cls_id < len(WEAPON_CLASSES) else f"class_{cls_id}",
                    "confidence": round(confidence, 3)
                })

        return JSONResponse({
            "type":     "url_image",
            "violence": {"label": "Violence Detected" if violence else "No Violence", "confidence": round(v_score, 3), "detected": violence},
            "weapons":  {"detected": len(detections) > 0, "count": len(detections), "detections": detections},
            "alert":    violence or len(detections) > 0
        })
    finally:
        os.unlink(tmp_path)


# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
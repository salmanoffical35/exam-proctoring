"""
AI Proctoring Service
Uses MediaPipe for:
  - Face detection (no face, multiple faces)
  - Face mesh for gaze/head-pose estimation
  - Pose landmarks for suspicious movement
"""

import cv2
import numpy as np
import base64
import mediapipe as mp
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field

# ── MediaPipe setup ──────────────────────────────────────────────────────────
mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh

face_detector = mp_face_detection.FaceDetection(
    model_selection=1,          # 1 = full-range model
    min_detection_confidence=0.6
)

face_mesh_detector = mp_face_mesh.FaceMesh(
    max_num_faces=3,
    refine_landmarks=True,      # includes iris landmarks
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ── Gaze landmark indices ────────────────────────────────────────────────────
# MediaPipe face mesh: 468 landmarks + 10 iris landmarks (with refine)
LEFT_EYE_INDICES  = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
RIGHT_EYE_INDICES = [33,  7,   163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
LEFT_IRIS  = [474, 475, 476, 477]
RIGHT_IRIS = [469, 470, 471, 472]
NOSE_TIP   = 1
CHIN       = 152
LEFT_EAR   = 323
RIGHT_EAR  = 93

@dataclass
class ProctoringResult:
    """Returned from analyze_frame()."""
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    face_count: int = 0
    alerts: list = field(default_factory=list)
    gaze_direction: str = "center"   # center / left / right / up / down
    head_pose: dict = field(default_factory=dict)  # yaw/pitch
    confidence_scores: dict = field(default_factory=dict)
    annotated_frame_b64: Optional[str] = None  # base64 JPEG for dashboard

def decode_frame(b64_data: str) -> Optional[np.ndarray]:
    """Decode base64 image → OpenCV BGR array."""
    try:
        # Strip data URL prefix if present
        if "," in b64_data:
            b64_data = b64_data.split(",")[1]
        img_bytes = base64.b64decode(b64_data)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None

def encode_frame(frame: np.ndarray, quality: int = 70) -> str:
    """Encode OpenCV frame → base64 JPEG string."""
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer).decode("utf-8")

def _get_iris_ratio(landmarks, iris_indices: list, eye_indices: list, w: int, h: int) -> float:
    """
    Compute iris position ratio within eye bounding box.
    Returns 0.0 (far left) → 1.0 (far right).
    """
    iris_pts  = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in iris_indices])
    eye_pts   = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in eye_indices])
    iris_cx   = iris_pts[:, 0].mean()
    eye_min_x = eye_pts[:, 0].min()
    eye_max_x = eye_pts[:, 0].max()
    span = eye_max_x - eye_min_x
    if span < 1:
        return 0.5
    return (iris_cx - eye_min_x) / span

def _head_pose_from_landmarks(landmarks, w: int, h: int) -> dict:
    """
    Estimate yaw and pitch from face landmark geometry.
    Positive yaw  = face turned right
    Positive pitch = face looking up
    """
    def pt(idx):
        l = landmarks[idx]
        return np.array([l.x * w, l.y * h])

    nose   = pt(NOSE_TIP)
    chin   = pt(CHIN)
    l_ear  = pt(LEFT_EAR)
    r_ear  = pt(RIGHT_EAR)

    # Yaw: asymmetry between ear distances to nose
    l_dist = np.linalg.norm(nose - l_ear)
    r_dist = np.linalg.norm(nose - r_ear)
    yaw_ratio = (r_dist - l_dist) / (r_dist + l_dist + 1e-6)
    yaw_deg   = yaw_ratio * 90   # rough degrees

    # Pitch: nose-chin vector vs vertical
    face_vec  = chin - nose
    pitch_deg = np.degrees(np.arctan2(-face_vec[1], abs(face_vec[0]) + 1e-6)) - 90
    pitch_deg = np.clip(pitch_deg, -60, 60)

    return {"yaw": round(float(yaw_deg), 1), "pitch": round(float(pitch_deg), 1)}

def analyze_frame(b64_frame: str, draw_annotations: bool = True) -> ProctoringResult:
    """
    Main entry point. Accepts base64 image, returns ProctoringResult with:
      - face_count
      - list of alerts (type + message + confidence)
      - gaze direction
      - head pose
    """
    result = ProctoringResult()

    frame = decode_frame(b64_frame)
    if frame is None:
        result.alerts.append({
            "type": "frame_error",
            "message": "Could not decode frame",
            "confidence": 1.0
        })
        return result

    h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # ── 1. Face Detection ────────────────────────────────────────────────────
    det_results = face_detector.process(rgb)
    faces = det_results.detections if det_results.detections else []
    result.face_count = len(faces)

    if result.face_count == 0:
        result.alerts.append({
            "type": "no_face",
            "message": "No face detected in frame",
            "confidence": 0.95
        })
        result.gaze_direction = "unknown"

    elif result.face_count > 1:
        result.alerts.append({
            "type": "multiple_faces",
            "message": f"{result.face_count} faces detected — possible impersonation",
            "confidence": 0.9
        })

    # ── 2. Face Mesh → Gaze + Head Pose ─────────────────────────────────────
    if result.face_count >= 1:
        mesh_results = face_mesh_detector.process(rgb)
        if mesh_results.multi_face_landmarks:
            lm = mesh_results.multi_face_landmarks[0].landmark  # primary face

            # Head pose
            pose = _head_pose_from_landmarks(lm, w, h)
            result.head_pose = pose

            # Iris gaze ratio (uses refine landmarks 468-477)
            if len(lm) > 477:
                l_ratio = _get_iris_ratio(lm, LEFT_IRIS,  LEFT_EYE_INDICES,  w, h)
                r_ratio = _get_iris_ratio(lm, RIGHT_IRIS, RIGHT_EYE_INDICES, w, h)
                avg_ratio = (l_ratio + r_ratio) / 2.0

                # Gaze direction thresholds
                if avg_ratio < 0.35:
                    result.gaze_direction = "left"
                elif avg_ratio > 0.65:
                    result.gaze_direction = "right"
                elif pose["pitch"] < -20:
                    result.gaze_direction = "down"
                elif pose["pitch"] > 20:
                    result.gaze_direction = "up"
                else:
                    result.gaze_direction = "center"
            else:
                # Fallback to head pose only
                if pose["yaw"] < -25:
                    result.gaze_direction = "left"
                elif pose["yaw"] > 25:
                    result.gaze_direction = "right"
                else:
                    result.gaze_direction = "center"

            # Alert if looking away (not center)
            if result.gaze_direction != "center":
                yaw_mag = abs(pose.get("yaw", 0))
                # Only alert on significant deviation
                if yaw_mag > 20 or result.gaze_direction in ["left", "right", "up"]:
                    conf = min(0.5 + yaw_mag / 100, 0.95)
                    result.alerts.append({
                        "type": "looking_away",
                        "message": f"Student looking {result.gaze_direction} (yaw={pose['yaw']}°)",
                        "confidence": round(conf, 2)
                    })

            result.confidence_scores["gaze"] = round(
                1.0 - abs(0.5 - (l_ratio + r_ratio) / 2) * 2
                if len(lm) > 477 else 0.5, 2
            )

    # ── 3. Draw Annotations ──────────────────────────────────────────────────
    if draw_annotations:
        annotated = frame.copy()
        color_map = {
            "no_face":         (0,   0,   255),
            "multiple_faces":  (0,   0,   255),
            "looking_away":    (0,   165, 255),
        }

        # Draw face boxes
        for det in faces:
            bbox = det.location_data.relative_bounding_box
            x1 = int(bbox.xmin * w)
            y1 = int(bbox.ymin * h)
            bw = int(bbox.width * w)
            bh = int(bbox.height * h)
            cv2.rectangle(annotated, (x1, y1), (x1+bw, y1+bh), (0, 255, 0), 2)

        # Alert overlay
        y_pos = 30
        for alert in result.alerts:
            color = color_map.get(alert["type"], (255, 255, 0))
            cv2.putText(annotated, f"! {alert['message'][:60]}",
                        (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            y_pos += 30

        # Gaze label
        cv2.putText(annotated, f"Gaze: {result.gaze_direction}",
                    (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        result.annotated_frame_b64 = encode_frame(annotated)

    return result

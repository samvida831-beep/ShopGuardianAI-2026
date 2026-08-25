# 🛡️ ShopGuardian AI — Smart AI Protection for Small Businesses

> **AI-Powered CCTV Security & Footfall Analytics Engine**  
> Solves theft, customer entry detection, and occupancy monitoring for small retail shops using real-time Computer Vision.

---

## 🚀 Executive Overview

Small retail shopkeepers often face security challenges, unmonitored entrances, and a lack of footfall analytics. Traditional CCTV DVR systems passively record video without intelligent alerting or instant event snapshots.

**ShopGuardian AI** transforms standard CCTV video feeds into an intelligent security system:
- 🤖 **YOLOv8 Person Detection**: Identifies customers in real time with high accuracy.
- 🎯 **Dual-Camera Occupancy Fusion**: Combines entrance and interior camera feeds to track total shop occupancy accurately.
- 🔔 **Non-Blocking Entry Alerts**: Plays a 2-beep audio chime on entry without locking frame processing.
- 📸 **Automatic Snapshot Logging**: Captures and persists high-resolution JPEG event snapshots to a searchable history gallery.
- 🟢 **Offline Demo Mode**: Prerecorded CCTV feeds run the actual YOLOv8 AI pipeline for instant evaluation without physical camera setup.

---

## 📐 System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CAMERA / VIDEO SOURCE                         │
│  (Offline Demo MP4 Videos / RTSP CCTV Streams / Local Webcam Index 0)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         PYTHON CAMERA THREAD                           │
│ (CameraStream: cv2.VideoCapture -> atomic read_with_id() under lock)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        YOLOv8 DETECTION ENGINE                         │
│ (detect_people: yolov8n.pt conf=0.35 -> Foot-point zone math -> Fusion)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│   AUDIO CHIME      │   │  SNAPSHOT WRITER   │   │ SQLITE DATABASE    │
│ Daemon Thread      │   │ JPEG File -> Disk  │   │ SnapshotRecord     │
└────────────────────┘   └────────────────────┘   └────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           FASTAPI BACKEND                              │
│         (Uvicorn on Port 8000: /api/status, /api/frame, /api/snapshots)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            REACT DASHBOARD                             │
│       (Vite + TanStack Router on Port 8080: Monitoring & Gallery UI)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ 2-Minute Hackathon Evaluation Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Environment Configuration
Copy environment template files:
```bash
# In project root
cp .env.example .env

# In frontend directory
cd frotend/shop-guardian-friendly
cp .env.example .env.local
```

### 3. Start Backend Server
```bash
cd backend
python main.py
```
*Backend runs at `http://127.0.0.1:8000`.*

### 4. Start Frontend UI
```bash
cd frotend/shop-guardian-friendly
npm run dev
```
*Frontend runs at `http://localhost:8080/` (or `http://localhost:5173/`).*

### 5. Judge Walkthrough Steps
1. **Open Dashboard**: Go to `http://localhost:8080/dashboard`.
2. **Observe Demo Mode**: Notice the green `🟢 DEMO MODE — Prerecorded CCTV` badge indicating offline evaluation mode.
3. **Observe AI Pipeline**: Watch live bounding boxes, foot points, and customer counts update automatically as people enter the shop.
4. **Interactive Zone Editor**: Test moving or adjusting entry zones directly on the UI canvas.
5. **Snapshot Gallery**: Navigate to `/gallery` to browse persistent historical entry snapshots.

---

## 📂 Project Structure

```
ShopGuardianAI/
├── backend/
│   ├── main.py              # Main backend entry point (FastAPI + Detection Thread)
│   ├── api.py               # FastAPI REST endpoints & CORS configuration
│   ├── detection.py         # YOLOv8 object detection, zone logic & snapshot generation
│   ├── camera.py            # Multi-threaded VideoCapture & frame_id synchronization
│   ├── database.py          # SQLAlchemy models, PBKDF2 auth & safe SQLite migrations
│   ├── state.py             # Shared in-memory shop status dictionary
│   ├── Utils/
│   │   └── config.py        # Environment-driven mode & camera configuration
│   └── DemoVideos/          # Prerecorded CCTV video files for offline judging
├── frotend/shop-guardian-friendly/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── index.tsx    # Onboarding & Auth Wizard
│   │   │   ├── dashboard.tsx# Live Monitoring Dashboard & Zone Editor
│   │   │   └── gallery.tsx  # Snapshot History Gallery
│   │   └── lib/
│   │       ├── api.ts       # API Client with dynamic VITE_API_BASE_URL
│   │       └── shop-store.ts# State management & token persistence
│   └── .env.example         # Frontend environment template
├── .env.example             # Root environment template
└── README.md                # Project documentation & submission guide
```

---

## 🔐 Environment Variables & Security

| Variable | Description |
| :--- | :--- |
| `CAMERA_MODE` | Controls system video mode (`demo`, `live`, `webcam`). Default: `demo`. |
| `ENTRY_RTSP_URL` | Main entrance CCTV RTSP stream URL (configured via `.env`). |
| `INSIDE_RTSP_URL` | Interior shop CCTV RTSP stream URL (configured via `.env`). |
| `CORS_ORIGINS` | Comma-separated list of production frontend domain origins. |
| `VITE_API_BASE_URL` | Frontend API base URL (Default: `http://127.0.0.1:8000`). |

> **Security Note**: No real CCTV credentials, private IP addresses, or secrets are stored in tracked source files. `.env` files are strictly protected via `.gitignore`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Artificial Intelligence** | Ultralytics YOLOv8 (`yolov8n.pt`), PyTorch |
| **Computer Vision** | OpenCV (`cv2`), NumPy, Shapely geometry math |
| **Backend & API** | Python 3.12, FastAPI, Uvicorn, SQLAlchemy, SQLite |
| **Security & Auth** | PBKDF2 Password Hashing, HMAC Session Tokens |
| **Frontend Framework** | React 18, Vite, TypeScript, TanStack Router |
| **Styling & Icons** | TailwindCSS, Lucide React Icons, Canvas API |

---

## 🌐 Public vs Real CCTV Deployment

### 1. Public Web Demo
- **Frontend**: Deployed to Vercel or Netlify (`VITE_API_BASE_URL=https://your-api.render.com`).
- **Backend**: Hosted on cloud GPU/CPU server (Render / AWS EC2) running Demo Mode with prerecorded MP4 video streams.

### 2. Local Shop CCTV Setup
- **Edge Gateway**: Local shop PC connects to CCTV DVR streams over private LAN (`rtsp://username:password@192.168.1.x:554/...`).
- **Privacy & Security**: RTSP credentials remain in local `.env` files and are never committed to public repositories or transmitted externally.

---

## 🔮 Future Roadmap

- 📱 Push notifications for instant entry alerts via Telegram / Webhooks.
- ⚡ WebSockets / MJPEG streaming for higher-frequency remote frame streaming.
- 📊 Advanced footfall heatmaps and peak customer shopping hour analytics.

---

## 📄 License & Attribution

Developed for retail shop monitoring and hackathon evaluation. Uses open-source YOLOv8 model weights by Ultralytics.

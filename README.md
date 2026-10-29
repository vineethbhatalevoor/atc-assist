<div align="center">

# ✈️ ATC-Assist

### AI-Augmented Air Traffic Control Decision Support System

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.162-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![LightGBM](https://img.shields.io/badge/LightGBM-ML-brightgreen?style=for-the-badge)](https://lightgbm.readthedocs.io)
[![OR-Tools](https://img.shields.io/badge/OR--Tools-CP--SAT-blue?style=for-the-badge)](https://developers.google.com/optimization)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> **A real-time, AI-powered ATC decision support tool that ingests live ADS-B surveillance data, detects conflicts, predicts landing times with ML, and optimally sequences arrivals — all presented on an interactive radar display with voice alerting.**

[🚀 Quick Start](#-quick-start) · [🧠 How It Works](#-how-it-works) · [🎯 Problem Statement](#-problem-statement) · [🔬 Research Gap](#-research-gap--innovation) · [📐 Architecture](#-architecture) · [📊 ML Models](#-ml-models) · [⚙️ Configuration](#️-configuration)

</div>

---

## 🎯 Problem Statement

Air Traffic Control (ATC) is one of the most cognitively demanding professions on earth. A single controller may simultaneously manage 15–30 aircraft, mentally tracking each aircraft's position, altitude, speed, routing, separation minima, runway assignment, weather, and wake turbulence category — all in real time, all under time pressure.

**The core challenges that ATC-Assist addresses:**

| Challenge | Current Reality | ATC-Assist Solution |
|-----------|----------------|---------------------|
| **Separation Assurance** | Controllers mentally compute conflicts; tools alert too late or too coarsely | 3-min lookahead conflict probing with 5 NM / 1000 ft minima and vectoring advisories |
| **Landing ETA Uncertainty** | Physics models diverge significantly beyond 10 NM out | Hybrid physics + LightGBM residual model cuts ETA error from ~188s → ~83s MAE |
| **Arrival Sequencing** | Manual sequencing by intuition; FCFS dominates at busy airports | CP-SAT (Google OR-Tools) optimizer minimizes priority-weighted delay across all arrivals |
| **Wake Turbulence** | Manual look-up of separation tables (ICAO / RECAT-EU) | Automated wake-pair lookup with spacing violation alerts |
| **Situation Awareness** | Multiple disconnected systems; cognitive overload | Single unified radar + panel interface with WebSocket push at ≤1 Hz |
| **Go-Around / Holding** | Detected reactively after radio communication | Proactive algorithmic detection from trajectory history |
| **Runway Conflicts** | No real-time runway occupancy overlay in affordable tools | Per-runway claim tracking with ARR/DEP overlap detection |

---

## 🔬 Research Gap & Innovation

### What Existing Systems Do

Most operational ATC tools (e.g., EUROCONTROL MTCD, FAA ERAM/STARS, commercial CWP systems) are:

- **Closed proprietary systems** — inaccessible to researchers, students, and smaller ANSPs
- **Radar-only or data-link-only** — not fused with open ADS-B feeds
- **Sequence planners or conflict detectors** — almost never *both* in the same open tool
- **Rules-based only** — lacking data-driven ETA and anomaly prediction
- **Airport-specific hardware dependencies** — cannot run on a laptop

Academic research prototypes either focus narrowly on one problem (e.g., conflict resolution geometry) or rely on expensive simulation datasets. There is a clear gap: **no open-source system combines live ADS-B ingestion, ML prediction, CP-SAT optimization, and conflict resolution advisory generation in a single deployable tool.**

### 5 Key Innovations

**Innovation 1 — Resilient Multi-Provider ADS-B Fusion**
Four live ADS-B feeds (adsb.lol / adsb.fi / airplanes.live / OpenSky) with per-provider circuit breakers, rate-limit exponential backoff, and sample-age filtering. No single point of failure.

**Innovation 2 — Hybrid Physics + ML ETA**
Below 5 NM: pure physics (speed × distance). Above 5 NM: physics ETA + LightGBM residual correction. Trained on EDDF/EGLL/EHAM/OMDB; tested on LFPG & VABB. Results: 188s → 83s MAE (56% reduction at LFPG).

**Innovation 3 — CP-SAT Arrival Sequencer**
Uses Google OR-Tools CP-SAT to minimize priority-weighted delay across all arriving aircraft, respecting wake sep (ICAO / RECAT-EU), runway occupancy times, crossing-runway constraints, freeze windows, and go-around re-insertion.

**Innovation 4 — Resolution Advisory Engine**
For each confirmed conflict pair: simulate heading (±20/30°), level change (±1000-3000 ft), and speed reduction options. Rank by separation margin × side-effect cost × priority. Output: ICAO-phraseology instruction text + speech synthesis.

**Innovation 5 — Anomaly Detection (Isolation Forest)**
Unsupervised ML flags unusual approach trajectories using 15+ approach-segment features (altitude profile, GS, turn rate, vertical rate trend). Secondary signal to rule-based alerts.

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | ≥ 3.12 |
| Node.js | ≥ 18 |
| npm | ≥ 9 |

### One-Command Launch (Windows PowerShell)

```powershell
git clone https://github.com/Vpnayak97/atc-assist.git
cd atc-assist
.\start.ps1
```

### Manual Setup

#### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # Windows PowerShell
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000 --reload
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

#### Access

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Radar display & control panels |
| http://localhost:8000/docs | Interactive API docs (Swagger UI) |
| http://localhost:8000/api/health | System health check |

---

## 🧠 How It Works

### System Pipeline

```
ADS-B Providers (4x)
        │
        ▼
   FetchLoop (30s)
   ┌────────────┐
   │  Merger    │  ← dedup, plausibility filter, stale-drop
   └────┬───────┘
        │ RawSamples
        ▼
   Tracker / LiveState
   ┌────────────┐
   │ Phase FSM  │  ← 12 flight phases with 3-tick hysteresis
   └────┬───────┘
        ├──────────────────────────────┐
        ▼                              ▼
PredictionService                 OpsService
  M1: Vertical alt                 ConflictService
  M2: Landing ETA                  SequenceService
  M3: Anomaly score                RunwayService
                                    AlertService
                                    WeatherService
        └──────────────┬────────────┘
                        ▼
                 WebSocket Hub
                 push_loop (≤1Hz)
                        │
                        ▼
              React Frontend (Vite)
              RadarCanvas + 7 Panels
```

---

## 📐 Architecture

### Backend Directory

```
backend/
├── app/
│   ├── main.py              # FastAPI app, lifespan startup/shutdown
│   ├── config.py            # Pydantic settings (ATC_* env vars)
│   ├── api/                 # REST + WebSocket endpoints
│   ├── core/                # Conflict, resolution, sequencer, geo, phraseology
│   ├── ml/                  # Model registry, ETA, vertical, anomaly models
│   ├── providers/           # adsb.lol, adsb.fi, airplanes.live, OpenSky
│   ├── services/            # Fetch loop, tracker, ops, prediction orchestration
│   └── schemas/             # Pydantic models: Track, Airport, Alert
├── data/
│   ├── airports.json        # Airport geometry (runways, coordinates)
│   └── separation_matrix.json
└── models/                  # Pre-trained LightGBM & Isolation Forest files
```

### Frontend Directory

```
frontend/src/
├── App.tsx                  # Root layout, tab router
├── api/                     # Typed fetch + WebSocket client
├── state/                   # Zustand store + TypeScript types
├── radar/                   # HTML5 Canvas 2D radar + layers
├── panels/                  # 9 functional panels
├── components/              # Badge, StatusBar
├── voice/                   # Web Speech API announcer
└── styles/                  # CSS design system
```

---

## 📊 ML Models

### Model 1 — Vertical Profile (LightGBM)

Predicts altitude correction over physics dead-reckoning at +30s and +60s.

| Metric | LFPG +30s | LFPG +60s | VIDP +30s | VIDP +60s |
|--------|-----------|-----------|-----------|-----------|
| Physics MAE (ft) | 152 | 399 | 118 | 298 |
| ML MAE (ft) | **127** | **296** | **115** | **263** |

Training: EDDF · EGLL · EHAM · OMDB · VABB · WSSS · VOBL | Test: LFPG · VIDP

### Model 2 — Landing ETA (LightGBM, Hybrid)

LightGBM residual on physics ETA; pure physics below 5 NM.

| Metric | LFPG | VABB |
|--------|------|------|
| Physics MAE (s) | 188.8 | 157.4 |
| Hybrid MAE (s) | **83.1** | **67.7** |
| Improvement | **56%** | **57%** |

Includes P10–P90 confidence bands per distance bucket.

### Model 3 — Unusual Approach (Isolation Forest)

Unsupervised anomaly detection on 15+ approach-segment features.

| Airport | n | Flagged | Recall (rank-4) | Precision (rank-4) |
|---------|---|---------|-----------------|-------------------|
| EGLL | 658 | 10.6% | 0.11 | **1.0** |
| VABB | 473 | 4.7% | 0.25 | **0.79** |
| WSSS | 540 | 4.1% | 0.39 | 0.59 |

*Secondary signal. Primary alerts use rule-based go-around & holding detection.*

---

## 🔧 Core Algorithms

### Conflict Detection (CPA Geometry)
- Dead-reckoning at 5-second intervals over 180-second lookahead
- Triggers at < 5 NM horizontal AND < 1000 ft vertical
- Debounced: 3 consecutive detections to confirm, 5 misses to clear
- Severity: `CAUTION` (45–90 s to conflict) / `WARNING` (< 45 s or LOS)

### Resolution Advisory Engine
1. Generate candidates for both aircraft (skip finals/runway/go-around)
2. Test: ±20°/30° heading, ±1000–3000 ft altitude, −20/30 kt speed
3. Simulate each against the intruder AND all other nearby traffic
4. Score: `cost = disruption + (50 if high-priority aircraft)`
5. Return top-3 resolving options or top-2 best-effort
6. Format as ICAO phraseology + phonetic callsign pronunciation

### CP-SAT Arrival Sequencer (Google OR-Tools)
- Variables: `T[i]` = landing time per arrival (integer seconds)
- Constraints: wake separation, runway occupancy, crossing-runway windows, freeze window, emergency priority
- Objective: minimize `Σ weight(priority) × (T[i] − ETA[i])`
- Priority weights: Emergency=1000, Priority=200, Standard=10
- Fallback: FCFS if solver times out

### Flight Phase State Machine (12 states)
```
PARKED → TAXI → LINEUP → TAKEOFF_ROLL → CLIMB → CRUISE
                                                    ↓
GO_AROUND ← FINAL ← APPROACH ← DESCENT ←──────────┘
    ↓
HOLDING (detected from orbit geometry in trajectory history)
```

---

## 🌐 Data Sources

| Provider | Format | Auth | Resilience |
|----------|--------|------|------------|
| adsb.lol | readsb JSON | None | Circuit breaker |
| adsb.fi | readsb JSON | None | Circuit breaker |
| airplanes.live | readsb JSON | None | Circuit breaker |
| OpenSky Network | OpenSky JSON | OAuth2 | Circuit breaker + rate limit |

---

## ⚙️ Configuration

Create `.env` in `backend/`:

```env
ATC_AIRPORT=VABB
ATC_SEPARATION_SCHEME=ICAO
ATC_QUERY_RADIUS_NM=60.0
ATC_FETCH_INTERVAL_S=30.0

# OpenSky (optional)
ATC_OPENSKY_CLIENT_ID=your_id
ATC_OPENSKY_CLIENT_SECRET=your_secret

# Separation minima
ATC_RADAR_SEP_NM=5.0
ATC_VERTICAL_SEP_FT=1000.0

# Conflict detection
ATC_CONFLICT_LOOKAHEAD_S=180.0
ATC_CONFLICT_WARN_S=45.0

# Arrival planner
ATC_PLANNER_HORIZON_MIN=40.0
ATC_FREEZE_WINDOW_S=300.0

# Local adjustments
ATC_MAGNETIC_VARIATION_DEG=0.0
ATC_TRANSITION_ALTITUDE_FT=4000.0
```

### Supported Airports

| ICAO | Airport |
|------|---------|
| VABB | Mumbai Chhatrapati Shivaji Maharaj |
| VOBL | Bengaluru Kempegowda |
| VIDP | Delhi Indira Gandhi |
| EGLL | London Heathrow |
| EDDF | Frankfurt |
| EHAM | Amsterdam Schiphol |
| OMDB | Dubai |
| WSSS | Singapore Changi |
| LFPG | Paris Charles de Gaulle |

---

## 🖥️ UI Panels

| Tab | Panel | Contents |
|-----|-------|----------|
| FLIGHT | FlightDetail | Call sign, type, squawk, phase, ETA band, altitude prediction, anomaly score |
| SEQ | SequencePanel | CP-SAT arrival order, delay metrics, wake badges, freeze/GA flags |
| RWY | RunwayPanel | Per-runway status, ARR/DEP claim timeline, conflict warnings, close/open toggle |
| STRIPS | StripsPanel | Finals progress strips sorted by ETA |
| LIST | FlightList | All tracked aircraft, sortable table |
| AI | AIPanel | ML model status, version, accuracy metrics |
| WX | WeatherPanel | METAR, runway headwind/crosswind, best runway |

### Voice Alerting

Built-in Web Speech API announces:
- **Conflicts**: *"Traffic alert. IndiGo two three four and Air India five six seven. Conflict in sixty seconds."*
- **Clear**: *"IndiGo two three four and Air India five six seven, clear of conflict."*
- **Go-around**: *"Go around. IndiGo two three four, runway two seven."*

---

## 📋 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Provider status, data age, model status |
| `GET` | `/api/flights` | All current tracks |
| `GET` | `/api/ops` | Conflicts, advisories, sequence, alerts |
| `GET` | `/api/weather` | METAR + runway wind components |
| `GET` | `/api/sequence` | Current CP-SAT arrival plan |
| `GET` | `/api/runways` | Runway occupancy and claims |
| `GET` | `/api/models` | ML model status and accuracy cards |
| `GET` | `/api/airport` | Airport geometry |
| `POST` | `/api/advisories/{id}/approve` | Approve a vectoring advisory |
| `POST` | `/api/advisories/{id}/reject` | Reject a vectoring advisory |
| `POST` | `/api/alerts/{id}/ack` | Acknowledge an alert |
| `POST` | `/api/flights/{hex}/emergency` | Declare / clear emergency |
| `POST` | `/api/flights/{hex}/priority` | Set priority (0=emergency, 4=low) |
| `POST` | `/api/runways/closure` | Open / close a runway |
| `WS` | `/ws` | Real-time push (snapshot + deltas + ops) |

---

## 🧪 Testing

```bash
cd backend
.venv\Scripts\Activate.ps1
pytest -v
```

---

## ⚠️ Safety Disclaimer

> **This system is a research and demonstration prototype. It MUST NOT be used for operational air traffic control.**

Key limitations:
- No certified data link — ADS-B has gaps; non-equipped aircraft are invisible
- No radar secondary surveillance — Mode C squawk correlation not implemented
- ETA band does not transfer perfectly across airports (66% cross-airport coverage)
- Anomaly recall is low (~20–39%) — do not rely on it as the sole safety net
- No flight plan data — routing and waypoints are not integrated
- Simulated instruction approval — approved advisories are logged but not transmitted
- Single airport per instance

---

## 🤝 Contributing

Areas open for contribution:
- `metar.py` — direct METAR/TAF ingestion
- `replay.py` — historical ADS-B replay mode
- `rag/answer.py` — natural-language ATC Q&A engine
- `priority_service.py` — dynamic priority re-scoring
- RECAT-EU full separation matrix
- Multi-airport support

---

## 📜 License

MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

- **ADS-B data**: [adsb.lol](https://adsb.lol) · [adsb.fi](https://adsb.fi) · [airplanes.live](https://airplanes.live) · [OpenSky Network](https://opensky-network.org)
- **ML**: [LightGBM](https://lightgbm.readthedocs.io) · [scikit-learn](https://scikit-learn.org)
- **Optimization**: [Google OR-Tools](https://developers.google.com/optimization) CP-SAT solver
- **Airport data**: [OurAirports](https://ourairports.com)
- **Standards**: ICAO Doc 4444 (PANS-ATM) · EUROCONTROL RECAT-EU

---

<div align="center">

**ATC-Assist** · Built with ❤️ for aviation safety research

*"The controller's eye sees everything. The system's eye never blinks."*

</div>

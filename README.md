# MARG - Emergency Vehicle Traffic Coordination

A hackathon prototype for coordinating emergency vehicle traffic and dynamically allocating green corridors based on priority scoring.

## Tech Stack (Free-Stack Version)
- **Frontend**: React.js, Leaflet.js (OpenStreetMap)
- **Backend**: Python, FastAPI, WebSockets
- **Database**: PostgreSQL (SQLAlchemy)
- **AI/ML**: Scikit-Learn (ETA Prediction)

## Getting Started

### 1. Database
Ensure you have PostgreSQL running locally (or via Docker) and a database named `marg_db` exists.
You can configure the connection string in `backend/database.py`.

### 2. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
The FastAPI backend will automatically train the Scikit-learn ETA prediction model on startup and host the WebSocket for the simulation.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173`. Click **"Run Canonical Demo"** to see the system in action.

---

## Feature Mapping (For Viva Reference)

| Feature | Implemented In | Description |
|---|---|---|
| **1. Simulated Live GPS** | `backend/simulation.py` | Advances vehicle positions along their path at a configurable speed using interpolations (`step()` method). Updates are sent via WebSocket in `main.py`. |
| **2. Traffic & Road Data / Route Selection** | `backend/graph.py` | Hand-built offline road graph structure (`NODES`, `EDGES`) representing the Canonical Demo junctions with traffic multipliers and distance calculations. |
| **3. AI Traffic-Adjusted ETA** | `backend/ml_eta.py` | Isolated Scikit-Learn `RandomForestRegressor` trained on synthetic data representing route length, time of day, and congestion levels. |
| **4. Emergency Priority Engine** | `backend/priority_engine.py` | Implements the exact canonical priority formula (`W1×Proximity + W2×Severity + W3×Lives + W4×ETA Urgency`). Contains assertions that exactly verify the 0.73 and 0.85 scores for Ambulance and Fire Brigade. |
| **5. Multi-Emergency Conflict Detection** | `backend/simulation.py` | `detect_and_resolve_conflicts()` checks if vehicles will cross the same junction in a given window, computes their priority scores, and dynamically reroutes the loser. |
| **6. Dynamic Green Corridor** | `backend/simulation.py` | `update_signals()` scans paths of active vehicles and sets the upcoming 1-2 junctions to green, holding cross-traffic to red. |
| **7. Alternate Routing (Dijkstra/A*)** | `backend/graph.py` | `get_shortest_path()` implements Dijkstra's algorithm to recalculate paths dynamically, allowing it to avoid congested/conflict nodes. |
| **8. Automatic Signal Reset** | `backend/simulation.py` | The signals dict is reset to red on each tick before being dynamically turned green for the upcoming junctions. |
| **9. Dynamic Priority Recalculation** | `backend/simulation.py` | Priority scores are actively re-evaluated (`update_scores()`) before deciding the winner at conflict points. |
| **10. React Frontend Dashboard** | `frontend/src/*` | `App.jsx`, `MapComponent.jsx`, and `ControlPanel.jsx` handle the Leaflet integration, glassmorphism UI styling, WebSocket syncing, and Canonical Demo controls. |

## FAQ: Why not Google Maps API?
*We're using a free OpenStreetMap-based routing layer for the prototype to keep the demo dependency-free; the architecture is designed to swap in Google's Routes API directly for production without changing the core priority/routing logic.*

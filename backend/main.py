import math
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from graph import get_graph_data
from simulation import sim_state, simulation_loop
from database import SessionLocal
from models import HospitalDirectory

hospital_cache = []

def load_hospitals():
    global hospital_cache
    db = SessionLocal()
    try:
        print("Loading hospitals from Supabase database...")
        hospitals = db.query(HospitalDirectory).all()
        for h in hospitals:
            if h.coordinates:
                parts = h.coordinates.split(",")
                if len(parts) == 2:
                    try:
                        lat = float(parts[0].strip())
                        lon = float(parts[1].strip())
                        hospital_cache.append({
                            "id": h.id,
                            "lat": lat,
                            "lon": lon,
                            "tags": {
                                "amenity": "hospital",
                                "name": h.hospital_name or "Hospital",
                                "location": h.location,
                                "district": h.district
                            }
                        })
                    except ValueError:
                        pass
        print(f"Loaded {len(hospital_cache)} hospitals into memory cache.")
    except Exception as e:
        print(f"Failed to load hospitals: {e}")
    finally:
        db.close()

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

app = FastAPI(title="MARG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For hackathon demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Load hospitals into memory
    import threading
    threading.Thread(target=load_hospitals).start()
    
    # Start the simulation loop in the background
    import asyncio
    asyncio.create_task(simulation_loop())

class GPSUpdate(BaseModel):
    vehicle_id: str
    latitude: float
    longitude: float
    timestamp: float

@app.post("/api/gps/update")
async def update_gps(payload: GPSUpdate):
    if payload.vehicle_id in sim_state.vehicles:
        sim_state.update_vehicle_gps(payload.vehicle_id, payload.latitude, payload.longitude)
        return {"status": "success", "message": "GPS updated"}
    return {"status": "error", "message": "Vehicle not found"}

@app.get("/api/facilities")
def get_facilities(lat: float, lng: float, radius: float = Query(10.0, description="Radius in km")):
    nearby = []
    for h in hospital_cache:
        dist = haversine(lat, lng, h['lat'], h['lon'])
        if dist <= radius:
            h_copy = dict(h)
            h_copy['distance'] = dist
            nearby.append(h_copy)
    
    nearby.sort(key=lambda x: x['distance'])
    return {"elements": nearby}

@app.get("/api/graph")
def get_graph():
    return get_graph_data()

@app.post("/api/demo/start")
def start_demo():
    sim_state.reset_canonical_demo()
    return {"status": "started"}

@app.post("/api/demo/pause")
def pause_demo():
    sim_state.running = not sim_state.running
    return {"status": "paused" if not sim_state.running else "running"}

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Send current state
            state_data = {
                "vehicles": sim_state.vehicles,
                "signals": sim_state.signals,
                "conflicts": sim_state.conflicts,
                "running": sim_state.running
            }
            await websocket.send_json(state_data)
            await asyncio.sleep(0.5) # Send updates every 500ms
    except WebSocketDisconnect:
        print("Client disconnected")


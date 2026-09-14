import math
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from graph import get_graph_data
from simulation import sim_state, simulation_loop
import requests
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
                                "district": h.district,
                                "has_icu": getattr(h, 'has_icu', False),
                                "phone": getattr(h, 'phone_number', None),
                                "category": getattr(h, 'category', None)
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

import models
from database import engine
models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="MARG API")

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from auth import verify_token
from fastapi import Request, Depends

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

def get_hospitals_from_overpass(lat: float, lon: float, radius_km: float):
    # Overpass API requires radius in meters
    radius_m = radius_km * 1000
    
    overpass_url = "https://z.overpass-api.de/api/interpreter"
    overpass_query = f'[out:json][timeout:25];nwr["amenity"="hospital"](around:{radius_m},{lat},{lon});out center;'
    headers = {"User-Agent": "MargDriver/1.0 (contact@example.com)"}
    try:
        resp = requests.post(overpass_url, data={'data': overpass_query}, headers=headers)
        if resp.status_code == 200:
            return resp.json().get('elements', [])
        else:
            print(f"Overpass returned status: {resp.status_code}")
    except Exception as e:
        print("Overpass error:", e)
    return []

@app.get("/api/facilities")
def get_facilities(lat: float, lng: float, radius: float = Query(10.0, description="Radius in km")):
    nearby = []
    
    # 1. Fetch from Database Cache
    if len(hospital_cache) > 0:
        for h in hospital_cache:
            dist = haversine(lat, lng, h['lat'], h['lon'])
            if dist <= radius:
                h_copy = dict(h)
                h_copy['distance'] = dist
                nearby.append(h_copy)
    
    # 2. Fetch from Live OpenStreetMap (Overpass API)
    print(f"Fetching additional hospitals from Overpass API (radius: {radius}km)...")
    osm_elements = get_hospitals_from_overpass(lat, lng, radius)
    for el in osm_elements:
        el_lat = el.get('lat') or el.get('center', {}).get('lat')
        el_lon = el.get('lon') or el.get('center', {}).get('lon')
        if el_lat is None or el_lon is None:
            continue
            
        dist = haversine(lat, lng, el_lat, el_lon)
        if dist > radius:
            continue
            
        # Deduplicate: if an OSM hospital is within 150 meters of an already found DB hospital, skip it
        is_duplicate = False
        for existing in nearby:
            if haversine(el_lat, el_lon, existing['lat'], existing['lon']) < 0.15:
                is_duplicate = True
                break
                
        if not is_duplicate:
            nearby.append({
                "id": f"osm-{el.get('id')}",
                "lat": el_lat,
                "lon": el_lon,
                "tags": {
                    "amenity": "hospital",
                    "name": el.get('tags', {}).get('name', 'Hospital (OSM)')
                },
                "distance": dist
            })
    
    nearby.sort(key=lambda x: x['distance'])
    return {"elements": nearby[:10]}

from pydantic import BaseModel
from ai_core import calculate_urgency_score
from ai_chat import handle_chat
from fastapi import Depends

class ChatQuery(BaseModel):
    query: str
    lat: float = None
    lon: float = None

@app.post("/api/ai/chat")
@limiter.limit("5/minute")
def ai_chat(request: Request, query: ChatQuery, token: dict = Depends(verify_token)):
    db = SessionLocal()
    try:
        response_text = handle_chat(query.query, query.lat, query.lon, db)
        return {"response": response_text}
    finally:
        db.close()

from fastapi import UploadFile, File
import shutil
import tempfile
import os
from ai_voice import transcribe_and_parse

@app.post("/api/ai/voice")
@limiter.limit("5/minute")
def process_voice(request: Request, file: UploadFile = File(...), token: dict = Depends(verify_token)):
    ext = ".webm" if "webm" in file.content_type else ".m4a"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    
    try:
        parsed = transcribe_and_parse(tmp_path)
        return {"status": "success", "data": parsed}
    finally:
        os.remove(tmp_path)

from ai_command import parse_voice_command

class CommandQuery(BaseModel):
    text: str

@app.post("/api/ai/command")
@limiter.limit("30/minute")
def ai_command(request: Request, query: CommandQuery, token: dict = Depends(verify_token)):
    return parse_voice_command(query.text)

class PatientCreate(BaseModel):
    ambulance_id: str
    severity: str
    patient_count: int
    symptoms: str = None
    hospital_id: str = None

@app.post("/api/patients")
@limiter.limit("10/minute")
def create_patient(request: Request, patient: PatientCreate, token: dict = Depends(verify_token)):
    db = SessionLocal()
    try:
        urgency = calculate_urgency_score(patient.severity, patient.patient_count)
        db_patient = models.Patient(
            ambulance_id=patient.ambulance_id,
            severity=patient.severity,
            patient_count=patient.patient_count,
            symptoms=patient.symptoms,
            hospital_id=patient.hospital_id,
            urgency_score=urgency
        )
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return {"status": "success", "patient_id": db_patient.id, "urgency_score": urgency}
    finally:
        db.close()

class DispositionCreate(BaseModel):
    patient_id: int
    hospital_id: str
    decision: str
    rejection_reason: str = None

@app.post("/api/disposition")
@limiter.limit("20/minute")
def create_disposition(request: Request, disp: DispositionCreate, token: dict = Depends(verify_token)):
    db = SessionLocal()
    try:
        db_disp = models.PatientDisposition(
            patient_id=disp.patient_id,
            hospital_id=disp.hospital_id,
            decision=disp.decision,
            rejection_reason=disp.rejection_reason
        )
        db.add(db_disp)
        db.commit()
        return {"status": "success"}
    finally:
        db.close()

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


from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db

@app.get("/api/traffic-lights")
def get_traffic_lights(minLat: float, minLon: float, maxLat: float, maxLon: float, db: Session = Depends(get_db)):
    lights = db.query(models.TrafficLight).filter(
        models.TrafficLight.lat >= minLat,
        models.TrafficLight.lat <= maxLat,
        models.TrafficLight.lon >= minLon,
        models.TrafficLight.lon <= maxLon
    ).all()
    
    return {
        "elements": [
            {
                "id": l.osm_id,
                "lat": l.lat,
                "lon": l.lon,
                "tags": {"name": l.name, "highway": "traffic_signals"}
            } for l in lights
        ]
    }

# --- NEW WS AND REST ENDPOINTS FOR DASHBOARDS ---

from fastapi import WebSocketException
from typing import List

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

ambulance_manager = ConnectionManager()
control_manager = ConnectionManager()

@app.websocket("/ws/control")
async def websocket_control_endpoint(websocket: WebSocket):
    """Control center listens here for global updates."""
    await control_manager.connect(websocket)
    try:
        while True:
            # Receive commands from control/hospital (like reject/accept)
            data = await websocket.receive_json()
            if data.get("type") == "hospital_response":
                # Forward this directly to the specific ambulance
                amb_id = data.get("ambulance_id")
                # We need a way to send to a specific connection. 
                # Let's just broadcast to all ambulances, and the ambulance will filter by its ID
                await ambulance_manager.broadcast(data)
    except WebSocketDisconnect:
        control_manager.disconnect(websocket)

@app.websocket("/ws/ambulance/{ambulance_id}")
async def websocket_ambulance_endpoint(websocket: WebSocket, ambulance_id: str, token: str = None):
    """Ambulances push their GPS coordinates here, which gets broadcast to Control Center."""
    # In a real production setup, uncomment the below to enforce JWT on WebSocket.
    # We must pass ?token=... from frontend for this to work.
    # if not token:
    #     await websocket.close(code=1008)
    #     return
    # try:
    #     from auth import get_jwks
    #     # Validate token logic...
    # except Exception:
    #     await websocket.close(code=1008)
    #     return
    
    await ambulance_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            severity = data.get("severity", "stable")
            patient_count = data.get("patient_count", 1)
            
            # Calculate urgency score
            weight = {"critical": 3, "serious": 2, "stable": 1}.get(severity, 1)
            urgency_score = weight * patient_count

            # Broadcast location and patient details to control center & hospital
            await control_manager.broadcast({
                "type": "ambulance_location",
                "ambulance_id": ambulance_id,
                "lat": data.get("lat"),
                "lon": data.get("lon"),
                "status": data.get("status", "en_route"),
                "target_hospital": data.get("target_hospital"),
                "route": data.get("route"),
                "driver_name": data.get("driver_name", "Unknown Driver"),
                "severity": severity,
                "patient_count": patient_count,
                "symptoms": data.get("symptoms", ""),
                "urgency_score": urgency_score
            })
    except WebSocketDisconnect:
        ambulance_manager.disconnect(websocket)

# --- USER MANAGEMENT ENDPOINTS ---
import os

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_API_BASE = "https://api.clerk.com/v1"

@app.get("/api/admin/users")
def get_all_users():
    if not CLERK_SECRET_KEY:
        return {"error": "CLERK_SECRET_KEY not set"}
    
    headers = {
        "Authorization": f"Bearer {CLERK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    try:
        # Fetch users from Clerk
        response = requests.get(f"{CLERK_API_BASE}/users?limit=100", headers=headers)
        if response.status_code == 200:
            users_data = response.json()
            # Clean up data to send to frontend
            formatted_users = []
            for u in users_data:
                emails = [email['email_address'] for email in u.get('email_addresses', [])]
                primary_email = emails[0] if emails else "No email"
                first_name = u.get("first_name") or ""
                last_name = u.get("last_name") or ""
                role = u.get("public_metadata", {}).get("role", "driver")
                
                formatted_users.append({
                    "id": u["id"],
                    "name": f"{first_name} {last_name}".strip() or "Unnamed",
                    "email": primary_email,
                    "role": role,
                    "image_url": u.get("image_url")
                })
            return {"users": formatted_users}
        else:
            return {"error": f"Clerk API returned {response.status_code}", "details": response.text}
    except Exception as e:
        return {"error": str(e)}

class RoleUpdateRequest(BaseModel):
    role: str

@app.patch("/api/admin/users/{user_id}/role")
def update_user_role(user_id: str, payload: RoleUpdateRequest):
    if not CLERK_SECRET_KEY:
        return {"error": "CLERK_SECRET_KEY not set"}
        
    headers = {
        "Authorization": f"Bearer {CLERK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # We must send public_metadata inside a patch request
        data = {
            "public_metadata": {
                "role": payload.role
            }
        }
        response = requests.patch(f"{CLERK_API_BASE}/users/{user_id}/metadata", json=data, headers=headers)
        if response.status_code == 200:
            return {"status": "success", "message": f"Role updated to {payload.role}"}
        else:
            return {"error": f"Clerk API returned {response.status_code}", "details": response.text}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/traffic-lights/all")
def get_all_traffic_lights(db: Session = Depends(get_db)):
    lights = db.query(models.TrafficLight).all()
    return {
        "elements": [
            {
                "id": l.osm_id,
                "lat": l.lat,
                "lon": l.lon,
                "tags": {"name": l.name, "highway": "traffic_signals"}
            } for l in lights
        ]
    }

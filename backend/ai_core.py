# Phase 1: Core AI Features

def calculate_urgency_score(severity: str, patient_count: int) -> int:
    """
    urgency_score = severity_weight x patient_count
    Can be swapped for ML model later.
    """
    weight = {"critical": 3, "serious": 2, "stable": 1}.get(severity.lower(), 1)
    return weight * patient_count

from datetime import datetime

def calculate_predictive_eta(base_eta_minutes: float, lat: float, lon: float) -> float:
    """
    Factor in time of day, traffic patterns, and signal wait times.
    """
    now = datetime.now()
    hour = now.hour
    
    # Simple heuristic: rush hour adds penalty
    traffic_multiplier = 1.0
    if 7 <= hour <= 9 or 17 <= hour <= 19:
        traffic_multiplier = 1.4
    elif 12 <= hour <= 14:
        traffic_multiplier = 1.15
        
    return round(base_eta_minutes * traffic_multiplier, 1)

from math import radians, cos, sin, asin, sqrt

def haversine(lon1, lat1, lon2, lat2):
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a)) 
    r = 6371 
    return c * r

def suggest_best_hospital(severity: str, lat: float, lon: float, db_session) -> dict:
    import models
    hospitals = db_session.query(models.HospitalDirectory).all()
    
    best_hospital = None
    min_score = float('inf')
    
    for h in hospitals:
        if not h.coordinates: continue
        parts = h.coordinates.split(",")
        if len(parts) != 2: continue
        try:
            h_lat = float(parts[0].strip())
            h_lon = float(parts[1].strip())
        except ValueError:
            continue
            
        dist = haversine(lon, lat, h_lon, h_lat)
        
        # Base score is distance
        score = dist
        
        # If critical, heavily penalize hospitals without ICU
        if severity.lower() == 'critical' and not h.has_icu:
            score += 100 # Add 100km penalty
            
        if score < min_score:
            min_score = score
            best_hospital = h
            
    if best_hospital:
        return {
            "id": best_hospital.id,
            "name": best_hospital.hospital_name,
            "has_icu": best_hospital.has_icu,
            "distance": round(min_score, 2) if min_score < 100 else round(min_score - 100, 2)
        }
    return None

def predict_signal_congestion(route_steps: list) -> dict:
    """
    Phase 4: Predict congestion ahead of route, suggest preemptive overrides.
    Stubbed as future scope.
    """
    return {"status": "future_scope", "suggested_overrides": []}

def detect_eta_anomalies(current_eta: float, original_eta: float) -> bool:
    """
    Phase 4: Flag unusual delays.
    If current ETA is >50% longer than original, it's an anomaly.
    """
    if not original_eta or original_eta == 0:
        return False
    return (current_eta / original_eta) > 1.5

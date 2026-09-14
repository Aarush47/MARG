import requests
import sys
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

def seed_traffic_lights(min_lat, min_lon, max_lat, max_lon):
    print(f"Fetching traffic lights for bounding box: {min_lat},{min_lon} to {max_lat},{max_lon}...")
    sys.stdout.flush()
    
    # Use a working overpass endpoint
    overpass_url = "https://z.overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json][timeout:25];
    node["highway"="traffic_signals"]({min_lat},{min_lon},{max_lat},{max_lon});
    out center;
    """
    
    try:
        resp = requests.post(overpass_url, data={'data': overpass_query}, headers={"User-Agent": "MargDriver/1.0"})
        if resp.status_code == 200:
            data = resp.json()
            elements = data.get('elements', [])
            print(f"Found {len(elements)} traffic lights in OSM.")
            sys.stdout.flush()
            
            db: Session = SessionLocal()
            try:
                added = 0
                for el in elements:
                    osm_id = el.get('id')
                    lat = el.get('lat')
                    lon = el.get('lon')
                    name = el.get('tags', {}).get('name')
                    
                    if not lat or not lon:
                        continue
                        
                    # Check if exists
                    existing = db.query(models.TrafficLight).filter(models.TrafficLight.osm_id == osm_id).first()
                    if not existing:
                        tl = models.TrafficLight(osm_id=osm_id, lat=lat, lon=lon, name=name)
                        db.add(tl)
                        added += 1
                db.commit()
                print(f"Successfully saved {added} new traffic lights to the database.")
                sys.stdout.flush()
            finally:
                db.close()
        else:
            print(f"Failed to fetch from Overpass. Status code: {resp.status_code}")
    except Exception as e:
        print(f"Error during seeding: {e}")

if __name__ == "__main__":
    # Chandigarh / Kharar / Mohali area
    seed_traffic_lights(30.6, 76.5, 30.8, 76.8)

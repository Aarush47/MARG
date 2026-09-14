from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
models.Base.metadata.create_all(bind=engine)

hardcoded_lights = [
{"id": 1428255152, "lat": 30.7093633, "lon": 76.7835795},
{"id": 1428255207, "lat": 30.7145924, "lon": 76.7780584},
{"id": 1428312466, "lat": 30.7258615, "lon": 76.7686402},
{"id": 1428312492, "lat": 30.7261455, "lon": 76.7678589},
{"id": 1428312540, "lat": 30.7265774, "lon": 76.7689228},
{"id": 1428312561, "lat": 30.7268008, "lon": 76.7681504},
{"id": 1428391200, "lat": 30.7325504, "lon": 76.7632047},
{"id": 1832757083, "lat": 30.7090708, "lon": 76.6960561},
{"id": 1832757091, "lat": 30.7031541, "lon": 76.7010088},
{"id": 1832906027, "lat": 30.7105109, "lon": 76.7128747},
{"id": 1832908936, "lat": 30.6910133, "lon": 76.7115672},
{"id": 1832908937, "lat": 30.6909035, "lon": 76.7116443},
{"id": 1835400765, "lat": 30.7224027, "lon": 76.7030408},
{"id": 1835405429, "lat": 30.7105803, "lon": 76.7128134}
]

db: Session = SessionLocal()
try:
    for el in hardcoded_lights:
        existing = db.query(models.TrafficLight).filter(models.TrafficLight.osm_id == el["id"]).first()
        if not existing:
            tl = models.TrafficLight(osm_id=el["id"], lat=el["lat"], lon=el["lon"], name=None)
            db.add(tl)
    db.commit()
    print("Inserted hardcoded lights!")
finally:
    db.close()

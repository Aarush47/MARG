from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
models.Base.metadata.create_all(bind=engine)

hardcoded_hospitals = [
    {"name": "Rai Multispeciality Hospital", "lat": 30.738, "lon": 76.643},
    {"name": "Civil Hospital Kharar", "lat": 30.742, "lon": 76.650},
    {"name": "Max Super Speciality Hospital", "lat": 30.760, "lon": 76.702},
    {"name": "Fortis Hospital Mohali", "lat": 30.710, "lon": 76.735},
    {"name": "Ivy Hospital Mohali", "lat": 30.720, "lon": 76.690},
]

db: Session = SessionLocal()
try:
    added = 0
    for h in hardcoded_hospitals:
        # Check if it already exists
        existing = db.query(models.HospitalDirectory).filter(models.HospitalDirectory.hospital_name == h["name"]).first()
        if not existing:
            coords = f"{h['lat']}, {h['lon']}"
            new_h = models.HospitalDirectory(
                hospital_name=h["name"],
                coordinates=coords,
                district="Mohali",
                state="Punjab"
            )
            db.add(new_h)
            added += 1
    db.commit()
    print(f"Seeded {added} hardcoded hospitals into database!")
finally:
    db.close()

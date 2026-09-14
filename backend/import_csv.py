import pandas as pd
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from dotenv import load_dotenv

load_dotenv('backend/.env')
models.Base.metadata.create_all(bind=engine)

df = pd.read_csv('/Users/aarush/Downloads/Chandigarh_Punjab_Hospitals_Master (2).csv')

db: Session = SessionLocal()
try:
    added = 0
    for index, row in df.iterrows():
        name = str(row['Hospital Name'])
        
        # Check if exists
        existing = db.query(models.HospitalDirectory).filter(models.HospitalDirectory.hospital_name == name).first()
        if not existing:
            lat = str(row['Latitude'])
            lon = str(row['Longitude'])
            coords = f"{lat}, {lon}"
            location = str(row['Address'])
            state = str(row['State'])
            
            new_h = models.HospitalDirectory(
                hospital_name=name,
                location=location,
                coordinates=coords,
                district="Punjab/Chandigarh Region", # default
                state=state,
                has_icu=str(row['ICU Facility']).strip().lower() == 'yes',
                phone_number=str(row['Phone Number']),
                category=str(row['Category'])
            )
            db.add(new_h)
            added += 1
            
    db.commit()
    print(f"Successfully imported {added} new hospitals from CSV into Supabase!")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()

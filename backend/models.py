from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, BigInteger
from sqlalchemy.sql import func
from database import Base

class VehicleRecord(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(String, unique=True, index=True)
    type = Column(String) # Ambulance, Fire Brigade
    severity = Column(Float)
    lives_at_risk = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    active = Column(Boolean, default=True)

class ConflictRecord(Base):
    __tablename__ = "conflicts"

    id = Column(Integer, primary_key=True, index=True)
    junction_id = Column(String, index=True)
    vehicle_a_id = Column(String)
    vehicle_b_id = Column(String)
    winner_id = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class HospitalDirectory(Base):
    __tablename__ = "hospital_directory"

    id = Column(BigInteger, primary_key=True, index=True)
    hospital_name = Column(String)
    location = Column(String)
    state = Column(String)
    district = Column(String)
    coordinates = Column(String)
    imported_at = Column(DateTime(timezone=True))

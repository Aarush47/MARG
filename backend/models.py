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
    __tablename__ = "hospitals_master"

    id = Column(BigInteger, primary_key=True, index=True)
    hospital_name = Column(String)
    location = Column(String)
    state = Column(String)
    district = Column(String)
    coordinates = Column(String)
    has_icu = Column(Boolean, default=False)
    phone_number = Column(String)
    category = Column(String)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())

class TrafficLight(Base):
    __tablename__ = "traffic_lights"

    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(BigInteger, unique=True, index=True)
    lat = Column(Float, index=True)
    lon = Column(Float, index=True)
    name = Column(String, nullable=True)

class ActiveAmbulance(Base):
    __tablename__ = "active_ambulances"

    id = Column(String, primary_key=True, index=True)
    vehicle_number = Column(String, nullable=True)
    driver_name = Column(String)
    vehicle_type = Column(String)
    lat = Column(Float)
    lon = Column(Float)
    target_hospital_id = Column(String, nullable=True)
    status = Column(String, default="idle") # idle, en_route, returning
    eta = Column(Float, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    ambulance_id = Column(String, index=True) # FK to active_ambulances
    severity = Column(String)
    patient_count = Column(Integer, default=1)
    symptoms = Column(String, nullable=True)
    hospital_id = Column(String, nullable=True) # FK to hospitals_master, nullable until assigned
    urgency_score = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PatientDisposition(Base):
    __tablename__ = "patient_dispositions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True) # FK to patients
    hospital_id = Column(String, index=True)
    decision = Column(String) # accepted / rejected
    rejection_reason = Column(String, nullable=True)
    decided_at = Column(DateTime(timezone=True), server_default=func.now())

class HospitalBedState(Base):
    __tablename__ = "hospital_bed_state"

    id = Column(Integer, primary_key=True, index=True)
    hospital_name = Column(String, unique=True, index=True)
    icu_beds = Column(Integer, default=0)
    general_beds = Column(Integer, default=0)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SignalOverride(Base):
    __tablename__ = "signal_overrides"

    id = Column(Integer, primary_key=True, index=True)
    signal_id = Column(String)
    operator = Column(String)
    action = Column(String)
    status = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

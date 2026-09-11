import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

# Global model instance
model = RandomForestRegressor(n_estimators=50, random_state=42)
_model_trained = False

def train_model():
    global _model_trained
    print("Training ETA Prediction Model on synthetic data...")
    # Generate synthetic data
    np.random.seed(42)
    n_samples = 2000
    
    # route length in meters
    route_length = np.random.uniform(100, 5000, n_samples)
    # time of day in hours 0-23.99
    time_of_day = np.random.uniform(0, 24, n_samples)
    # congestion level multiplier 1.0 (clear) to 3.0 (heavy traffic)
    congestion_level = np.random.uniform(1.0, 3.0, n_samples)
    
    # Base travel time assuming ~10 m/s speed
    base_time = route_length / 10.0
    
    # Rush hour effect (peaks around 8:30 AM and 5:30 PM)
    rush_hour_penalty = np.where(
        ((time_of_day >= 7.5) & (time_of_day <= 9.5)) | ((time_of_day >= 16.5) & (time_of_day <= 18.5)),
        1.4,
        1.0
    )
    
    travel_time = base_time * congestion_level * rush_hour_penalty
    
    # Add some random noise
    travel_time += np.random.normal(0, 10, n_samples)
    
    X = pd.DataFrame({
        'route_length': route_length,
        'time_of_day': time_of_day,
        'congestion_level': congestion_level
    })
    y = travel_time
    
    model.fit(X, y)
    _model_trained = True
    print("ETA Prediction Model trained.")

def predict_eta(route_features: dict) -> float:
    """
    Predicts the ETA in seconds based on route features.
    Args:
        route_features (dict): {
            'route_length': float, # in meters
            'time_of_day': float, # 0-24 hour
            'congestion_level': float # 1.0 to 3.0+
        }
    Returns:
        predicted_travel_time (float): ETA in seconds.
    """
    if not _model_trained:
        train_model()
        
    X = pd.DataFrame([route_features])
    eta = model.predict(X)[0]
    return max(1.0, float(eta))

# Train model automatically when imported
if not _model_trained:
    train_model()

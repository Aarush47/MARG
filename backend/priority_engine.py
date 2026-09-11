def calculate_priority_score(severity: float, lives_at_risk: float, proximity: float, eta_urgency: float) -> float:
    """
    Calculates the emergency priority score based on the canonical formula.
    Weights:
    - Severity: 40%
    - Lives at Risk: 30%
    - Proximity: 20%
    - ETA Urgency: 10%
    
    All inputs should be normalized 0-1 values.
    Returns: priority score (0-1)
    """
    w_severity = 0.40
    w_lives_at_risk = 0.30
    w_proximity = 0.20
    w_eta_urgency = 0.10
    
    score = (w_proximity * proximity) + \
            (w_severity * severity) + \
            (w_lives_at_risk * lives_at_risk) + \
            (w_eta_urgency * eta_urgency)
            
    # Return rounded to 2 decimal places to match canonical exact scores
    return round(score, 2)

if __name__ == "__main__":
    # Unit Tests for Canonical Example
    
    # 1. Ambulance
    amb_severity = 1.0
    amb_lives = 0.2
    amb_prox = 0.9
    amb_eta = 0.9
    amb_score = calculate_priority_score(amb_severity, amb_lives, amb_prox, amb_eta)
    assert amb_score == 0.73, f"Expected Ambulance score 0.73, got {amb_score}"
    print(f"Ambulance Score: {amb_score} - PASS")
    
    # 2. Fire Brigade
    fire_severity = 0.9
    fire_lives = 1.0
    fire_prox = 0.6
    fire_eta = 0.7
    fire_score = calculate_priority_score(fire_severity, fire_lives, fire_prox, fire_eta)
    assert fire_score == 0.85, f"Expected Fire Brigade score 0.85, got {fire_score}"
    print(f"Fire Brigade Score: {fire_score} - PASS")
    
    print("All Priority Engine tests passed successfully.")

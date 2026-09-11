import asyncio
import time
import math
from graph import NODES, EDGES, get_logical_path, get_full_geometry_path, calculate_travel_time
from priority_engine import calculate_priority_score
from ml_eta import predict_eta

def dist_between(p1, p2):
    # simple euclidean distance for step interpolation (not real meters, just for interpolation ratio)
    return math.sqrt((p1['lat'] - p2['lat'])**2 + (p1['lng'] - p2['lng'])**2)

class SimulationState:
    def __init__(self):
        self.vehicles = {}
        self.signals = {node_id: "red" for node_id in NODES.keys()}
        self.conflicts = []
        self.running = False
        self.speed_multiplier = 1.0
        self.last_update = time.time()
        self.last_recalc_time = time.time()
        
    def update_vehicle_gps(self, vehicle_id, lat, lng):
        """Overrides interpolation with live GPS data."""
        if vehicle_id in self.vehicles:
            v = self.vehicles[vehicle_id]
            v["lat"] = lat
            v["lng"] = lng
            v["is_live"] = True
        
    def reset_canonical_demo(self):
        # N1 -> N3 -> N4
        # N2 -> N3 -> N4
        logical_path_amb, _ = get_logical_path("N1", "N4")
        logical_path_fire, _ = get_logical_path("N2", "N4")
        
        # Call OSRM API to get the dense coordinate array
        dense_path_amb = get_full_geometry_path(logical_path_amb)
        dense_path_fire = get_full_geometry_path(logical_path_fire)
        
        self.vehicles = {
            "amb_1": {
                "id": "amb_1",
                "type": "Ambulance",
                "severity": 1.0,
                "lives_at_risk": 0.2,
                "proximity_score": 0.9, 
                "eta_urgency": 0.9,
                "logical_path": logical_path_amb,
                "dense_path": dense_path_amb,
                "current_node_idx": 0, # index in logical_path
                "current_dense_idx": 0, # index in dense_path
                "progress_to_next_point": 0.0,
                "lat": NODES["N1"]["lat"],
                "lng": NODES["N1"]["lng"],
                "status": "normal",
                "score": 0.0
            },
            "fire_1": {
                "id": "fire_1",
                "type": "Fire Brigade",
                "severity": 0.9,
                "lives_at_risk": 1.0,
                "proximity_score": 0.6,
                "eta_urgency": 0.7,
                "logical_path": logical_path_fire,
                "dense_path": dense_path_fire,
                "current_node_idx": 0,
                "current_dense_idx": 0,
                "progress_to_next_point": 0.0,
                "lat": NODES["N2"]["lat"],
                "lng": NODES["N2"]["lng"],
                "status": "normal",
                "score": 0.0
            }
        }
        self.signals = {node_id: "red" for node_id in NODES.keys()}
        self.conflicts = []
        self.running = True
        self.last_update = time.time()
        self.update_scores()

    def update_scores(self):
        for v_id, v in self.vehicles.items():
            score = calculate_priority_score(
                severity=v["severity"],
                lives_at_risk=v["lives_at_risk"],
                proximity=v["proximity_score"],
                eta_urgency=v["eta_urgency"]
            )
            v["score"] = score

    def step(self, dt):
        if not self.running:
            return

        # move vehicles along dense coordinate points
        # speed is arbitrary "map units per second" since OSRM coordinates are lat/lng degrees
        # ~0.0001 deg is ~10 meters. Let's say speed = 0.0003 deg / sec for visual demo
        speed = 0.0002 * self.speed_multiplier
        
        # 1. Live Recalculation every 2 seconds
        if time.time() - self.last_recalc_time >= 2.0:
            self.last_recalc_time = time.time()
            for v_id, v in self.vehicles.items():
                total_nodes = len(v["logical_path"])
                current = v["current_node_idx"]
                progress = current / max(1, total_nodes - 1)
                
                # Dynamically increase urgency as they approach
                v["proximity_score"] = min(1.0, 0.4 + (0.6 * progress))
                v["eta_urgency"] = min(1.0, 0.5 + (0.5 * progress))
            
            self.update_scores()
        
        for v_id, v in list(self.vehicles.items()):
            if v.get("is_live"):
                # Skip mathematical interpolation for vehicles providing real GPS pings
                # Note: Logical node index updating would ideally use geofencing here, 
                # but for now we just skip the position overriding.
                continue
                
            dense_path = v["dense_path"]
            idx = v["current_dense_idx"]
            
            if idx >= len(dense_path) - 1:
                # Reached destination
                continue
                
            p1 = dense_path[idx]
            p2 = dense_path[idx + 1]
            dist = dist_between(p1, p2)
            
            v["progress_to_next_point"] += speed * dt
            
            # While we overshoot, move to next point
            while v["progress_to_next_point"] >= dist:
                v["progress_to_next_point"] -= dist
                idx += 1
                v["current_dense_idx"] = idx
                if idx >= len(dense_path) - 1:
                    v["lat"] = dense_path[-1]["lat"]
                    v["lng"] = dense_path[-1]["lng"]
                    break
                p1 = dense_path[idx]
                p2 = dense_path[idx + 1]
                dist = dist_between(p1, p2)
                
            if idx < len(dense_path) - 1:
                # Interpolate
                if dist == 0:
                    ratio = 1.0
                else:
                    ratio = v["progress_to_next_point"] / dist
                v["lat"] = p1["lat"] + (p2["lat"] - p1["lat"]) * ratio
                v["lng"] = p1["lng"] + (p2["lng"] - p1["lng"]) * ratio
                
            # Update logical node index based on proximity to next logical node
            # This is a bit hacky but works for the demo: if close to next logical node, increment index
            if v["current_node_idx"] < len(v["logical_path"]) - 1:
                next_node_id = v["logical_path"][v["current_node_idx"] + 1]
                next_node = NODES[next_node_id]
                dist_to_logical = dist_between(v, next_node)
                if dist_to_logical < 0.0005: # within ~50 meters
                    v["current_node_idx"] += 1

        self.detect_and_resolve_conflicts()
        self.update_signals()

    def detect_and_resolve_conflicts(self):
        upcoming_nodes = {}
        for v_id, v in self.vehicles.items():
            if v["current_node_idx"] < len(v["logical_path"]) - 1:
                next_node = v["logical_path"][v["current_node_idx"] + 1]
                if next_node not in upcoming_nodes:
                    upcoming_nodes[next_node] = []
                upcoming_nodes[next_node].append(v_id)
                
        for node_id, vehicle_ids in upcoming_nodes.items():
            if len(vehicle_ids) > 1 and node_id == "N3":
                v1_id = vehicle_ids[0]
                v2_id = vehicle_ids[1]
                
                v1 = self.vehicles[v1_id]
                v2 = self.vehicles[v2_id]
                
                if v1["status"] == "rerouted" or v2["status"] == "rerouted":
                    continue
                
                winner, loser = (v1, v2) if v1["score"] >= v2["score"] else (v2, v1)
                
                self.conflicts.append({
                    "junction": NODES[node_id]["name"],
                    "winner": winner["id"],
                    "loser": loser["id"],
                    "winner_score": winner["score"],
                    "loser_score": loser["score"],
                    "timestamp": time.time()
                })
                
                # Reroute loser
                current_loser_node = loser["logical_path"][loser["current_node_idx"]]
                new_logical_path, _ = get_logical_path(current_loser_node, "N4", avoid_nodes={node_id})
                if new_logical_path:
                    # Fetch OSRM dense path for the new route
                    new_dense_path = get_full_geometry_path(new_logical_path)
                    
                    loser["logical_path"] = new_logical_path
                    loser["dense_path"] = new_dense_path
                    loser["current_node_idx"] = 0
                    loser["current_dense_idx"] = 0
                    loser["progress_to_next_point"] = 0.0
                    loser["status"] = "rerouted"
                    print(f"Rerouted {loser['id']} to avoid {node_id}")

    def update_signals(self):
        new_signals = {node_id: "red" for node_id in NODES.keys()}
        
        for v_id, v in self.vehicles.items():
            idx = v["current_node_idx"]
            path = v["logical_path"]
            # Look ahead 1-2 junctions
            for ahead_idx in range(idx + 1, min(idx + 3, len(path))):
                node_id = path[ahead_idx]
                new_signals[node_id] = "green"
                
        self.signals = new_signals

sim_state = SimulationState()

async def simulation_loop():
    while True:
        if sim_state.running:
            now = time.time()
            dt = now - sim_state.last_update
            sim_state.last_update = now
            if dt > 0.5:
                dt = 0.1
            sim_state.step(dt)
        else:
            sim_state.last_update = time.time()
            
        await asyncio.sleep(0.1)

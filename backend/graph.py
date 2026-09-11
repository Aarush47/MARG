import urllib.request
import json
import heapq
import math

# Coordinates for Canonical Demo in Connaught Place, New Delhi
NODES = {
    "N1": {"lat": 28.6429, "lng": 77.2191, "name": "New Delhi Rly Station (North)"},
    "N2": {"lat": 28.6295, "lng": 77.2120, "name": "Shivaji Stadium (West)"},
    "N3": {"lat": 28.6328, "lng": 77.2197, "name": "Rajiv Chowk (Center)"},
    "N4": {"lat": 28.6258, "lng": 77.1994, "name": "RML Hospital (Destination)"},
    "N5": {"lat": 28.6385, "lng": 77.2285, "name": "Barakhamba Bypass"},
    "N6": {"lat": 28.6290, "lng": 77.2250, "name": "India Gate Bypass"}
}

# Base traffic multipliers for route generation
# (The manual edges are kept for logical routing, but the real path coordinates are fetched from OSRM)
EDGES = {
    "N1": [
        {"to": "N3", "distance": 1800, "traffic_multiplier": 1.0},
        {"to": "N5", "distance": 1500, "traffic_multiplier": 1.0}
    ],
    "N2": [
        {"to": "N3", "distance": 1200, "traffic_multiplier": 1.5}
    ],
    "N3": [
        {"to": "N4", "distance": 2500, "traffic_multiplier": 1.2}
    ],
    "N5": [
        {"to": "N6", "distance": 2000, "traffic_multiplier": 0.8}
    ],
    "N6": [
        {"to": "N4", "distance": 3500, "traffic_multiplier": 0.9}
    ]
}

def calculate_travel_time(distance, traffic_multiplier, base_speed=10.0):
    return (distance / base_speed) * traffic_multiplier

def get_logical_path(start, end, avoid_nodes=None):
    if avoid_nodes is None:
        avoid_nodes = set()
    
    pq = [(0, start, [])]
    visited = set()
    
    while pq:
        (cost, current, path) = heapq.heappop(pq)
        
        if current in visited:
            continue
            
        visited.add(current)
        path = path + [current]
        
        if current == end:
            return path, cost
            
        for edge in EDGES.get(current, []):
            neighbor = edge["to"]
            if neighbor not in avoid_nodes:
                travel_time = calculate_travel_time(edge["distance"], edge["traffic_multiplier"])
                heapq.heappush(pq, (cost + travel_time, neighbor, path))
                
    return None, float('inf')

_osrm_cache = {}

def get_osrm_route(lon1, lat1, lon2, lat2):
    cache_key = f"{lon1},{lat1};{lon2},{lat2}"
    if cache_key in _osrm_cache:
        return _osrm_cache[cache_key]
        
    url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'MARG-Hackathon-Prototype/1.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data["code"] == "Ok":
                # OSRM returns coordinates as [lon, lat]
                coords = data["routes"][0]["geometry"]["coordinates"]
                # Convert to [lat, lon]
                lat_lon_coords = [{"lat": c[1], "lng": c[0]} for c in coords]
                _osrm_cache[cache_key] = lat_lon_coords
                return lat_lon_coords
    except Exception as e:
        print(f"OSRM Fetch Error: {e}")
    
    # Fallback to straight line if API fails
    return [{"lat": lat1, "lng": lon1}, {"lat": lat2, "lng": lon2}]

def get_full_geometry_path(logical_path):
    """
    Given a list of node IDs (e.g. ['N1', 'N3', 'N4']), calls OSRM to get the dense coordinate 
    array connecting them sequentially.
    """
    full_coords = []
    for i in range(len(logical_path) - 1):
        n1 = NODES[logical_path[i]]
        n2 = NODES[logical_path[i+1]]
        
        segment_coords = get_osrm_route(n1["lng"], n1["lat"], n2["lng"], n2["lat"])
        
        if i > 0 and len(segment_coords) > 0:
            # avoid duplicating the junction point
            segment_coords = segment_coords[1:]
            
        full_coords.extend(segment_coords)
        
    return full_coords

def get_graph_data():
    # Pre-fetch geometries for frontend display
    for from_id, edges in EDGES.items():
        for edge in edges:
            if "geometry" not in edge:
                n1 = NODES[from_id]
                n2 = NODES[edge["to"]]
                edge["geometry"] = get_osrm_route(n1["lng"], n1["lat"], n2["lng"], n2["lat"])
                
    return {
        "nodes": NODES,
        "edges": EDGES
    }

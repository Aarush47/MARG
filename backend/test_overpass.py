import requests
import json

query = """
[out:json][timeout:60];
area["ISO3166-1"="IN"]->.searchArea;
(
  node["amenity"="hospital"](area.searchArea);
  node["amenity"="fire_station"](area.searchArea);
);
out count;
"""

url = "http://overpass-api.de/api/interpreter"
print("Sending query to Overpass API...")
response = requests.post(url, data={'data': query})
if response.status_code == 200:
    print(response.json())
else:
    print(f"Error: {response.status_code}")
    print(response.text)

import openai
import os
import json

def parse_voice_command(text: str) -> dict:
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    prompt = """
    You are an intelligent assistant inside an emergency vehicle dashboard. 
    The driver speaks commands naturally. They might mix English, Hindi, or Punjabi, or just speak broken English.
    You must parse their intent into a structured JSON array of actions.
    
    Available actions:
    - {"type": "SET_SEARCH_QUERY", "payload": "<location_name>"} (e.g. "search for xyz hackathon", "take me to bahra hospital")
    - {"type": "EXECUTE_SEARCH"} (always include this AFTER SET_SEARCH_QUERY if they want to search for a specific place)
    - {"type": "FIND_NEAREST"} (e.g. "find nearest hospital", "nearby hospitals")
    - {"type": "SET_RADIUS", "payload": <number_in_km>} (e.g. "change search radius to 20", "radius 15")
    - {"type": "START_NAVIGATION"} (e.g. "start navigation", "start route")
    - {"type": "CLEAR_ROUTE"} (e.g. "clear route", "cancel route")
    - {"type": "SET_SEVERITY", "payload": "critical" | "serious" | "stable"} (e.g. "patient is critical")
    - {"type": "SET_PATIENTS", "payload": <number>} (e.g. "two patients")
    - {"type": "SET_SYMPTOMS", "payload": "<text>"} (e.g. "patient has cardiac arrest")
    - {"type": "SCROLL", "payload": "down" | "up"} (e.g. "scroll down", "go down", "scroll up")
    - {"type": "MAP_ZOOM", "payload": "in" | "out"} (e.g. "zoom in", "zoom out map")
    
    Example 1: "Search for xyz hackathon"
    [{"type": "SET_SEARCH_QUERY", "payload": "xyz hackathon"}, {"type": "EXECUTE_SEARCH"}]
    
    Example 2: "radius 20 and two critical patients"
    [{"type": "SET_RADIUS", "payload": 20}, {"type": "SET_PATIENTS", "payload": 2}, {"type": "SET_SEVERITY", "payload": "critical"}]
    
    Example 3: "scroll down"
    [{"type": "SCROLL", "payload": "down"}]
    
    Return ONLY a JSON object: {"actions": [ ... ]}
    """
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text}
        ],
        response_format={ "type": "json_object" }
    )
    
    try:
        data = json.loads(response.choices[0].message.content)
        return data
    except Exception as e:
        return {"actions": []}

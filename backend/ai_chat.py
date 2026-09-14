import openai
import os
import json
from pydantic import BaseModel
from ai_core import suggest_best_hospital, calculate_predictive_eta, calculate_urgency_score

MARG_KEYWORDS = ["ambulance", "hospital", "traffic", "patient", "route", "eta", "bed", "signal", "urgency", "driver", "vehicle", "emergency", "routing"]

def is_marg_related(query: str) -> bool:
    query_lower = query.lower()
    return any(kw in query_lower for kw in MARG_KEYWORDS)

def handle_chat(query: str, lat: float = None, lon: float = None, db_session = None):
    if not is_marg_related(query):
        return "I can only assist with MARG-related tasks (ambulance routing, traffic coordination, hospital bed availability, and patient urgency). How can I help you with the MARG system?"
    
    # We would use OpenAI function calling here.
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    tools = [
        {
            "type": "function",
            "function": {
                "name": "suggestHospital",
                "description": "Suggest the best hospital based on patient severity and current location.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "severity": {"type": "string", "enum": ["stable", "serious", "critical"]},
                    },
                    "required": ["severity"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "getETA",
                "description": "Calculate predictive ETA factoring in traffic and time of day.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "base_eta_minutes": {"type": "number"},
                    },
                    "required": ["base_eta_minutes"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "calculateUrgency",
                "description": "Calculate patient urgency score.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "severity": {"type": "string"},
                        "patient_count": {"type": "integer"}
                    },
                    "required": ["severity", "patient_count"]
                }
            }
        }
    ]

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are MARG Assistant, restricted to helping with ambulance routing, traffic coordination, hospital bed availability, and patient urgency for the MARG project. Do not answer questions unrelated to MARG's functionality, including general knowledge, math, or current events. If asked something off-topic, politely redirect the user back to MARG-related tasks."},
                {"role": "user", "content": query}
            ],
            tools=tools,
            tool_choice="auto"
        )
        
        msg = response.choices[0].message
        
        if msg.tool_calls:
            results = []
            for tool_call in msg.tool_calls:
                fn_name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)
                
                if fn_name == "suggestHospital":
                    if lat and lon and db_session:
                        res = suggest_best_hospital(args.get("severity"), lat, lon, db_session)
                        results.append(f"Suggested hospital: {res['name']} ({res['distance']}km away)")
                    else:
                        results.append("I need current GPS coordinates to suggest a hospital.")
                elif fn_name == "getETA":
                    eta = calculate_predictive_eta(args.get("base_eta_minutes"), lat or 0.0, lon or 0.0)
                    results.append(f"Predictive ETA is {eta} minutes.")
                elif fn_name == "calculateUrgency":
                    score = calculate_urgency_score(args.get("severity"), args.get("patient_count"))
                    results.append(f"Urgency score calculated as {score}.")
            return "\n".join(results)
        
        return msg.content
    except Exception as e:
        return f"AI Service Error: {str(e)}"

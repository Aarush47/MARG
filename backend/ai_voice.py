import openai
import os
import tempfile
import json
from pydantic import BaseModel

class ParsedPatientData(BaseModel):
    severity: str
    patient_count: int

def transcribe_and_parse(audio_file_path: str) -> dict:
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    # 1. Transcribe with Whisper
    with open(audio_file_path, "rb") as f:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=f
        )
        
    text = transcript.text
    
    # 2. Parse severity and patient count using LLM
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Extract the patient severity (critical, serious, stable) and patient count from this ambulance driver's voice transcript. Default to 'serious' and 1 if not explicitly stated. Return JSON like {\"severity\": \"critical\", \"patient_count\": 2}."},
            {"role": "user", "content": text}
        ],
        response_format={ "type": "json_object" }
    )
    
    try:
        data = json.loads(response.choices[0].message.content)
        return data
    except:
        return {"severity": "serious", "patient_count": 1}


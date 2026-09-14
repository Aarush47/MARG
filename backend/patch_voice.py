from fastapi import FastAPI, UploadFile, File
import shutil
import tempfile
import os

def apply_voice_endpoint(app, limiter, verify_token):
    from fastapi import Request, Depends
    from ai_voice import transcribe_and_parse
    
    @app.post("/api/ai/voice")
    @limiter.limit("5/minute")
    def process_voice(request: Request, file: UploadFile = File(...), token: dict = Depends(verify_token)):
        # Save temp file
        ext = ".webm" if "webm" in file.content_type else ".m4a"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        try:
            parsed = transcribe_and_parse(tmp_path)
            return {"status": "success", "data": parsed}
        finally:
            os.remove(tmp_path)

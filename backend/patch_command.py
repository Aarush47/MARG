from fastapi import Request, Depends
from ai_command import parse_voice_command

def apply_command_endpoint(app, limiter, verify_token, BaseModel):
    class CommandQuery(BaseModel):
        text: str

    @app.post("/api/ai/command")
    @limiter.limit("30/minute")
    def ai_command(request: Request, query: CommandQuery, token: dict = Depends(verify_token)):
        return parse_voice_command(query.text)

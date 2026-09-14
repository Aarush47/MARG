from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
import requests
import os
from dotenv import load_dotenv

load_dotenv()
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")

security = HTTPBearer()

jwks_cache = None

def get_jwks():
    global jwks_cache
    if jwks_cache:
        return jwks_cache
    
    headers = {"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
    response = requests.get("https://api.clerk.com/v1/jwks", headers=headers)
    if response.status_code == 200:
        jwks_cache = response.json()
        return jwks_cache
    raise HTTPException(status_code=500, detail="Could not fetch JWKS from Clerk")

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        jwks = get_jwks()
        # Decode without verifying signature first to get the key id
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
        
        if rsa_key:
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
            return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    raise HTTPException(status_code=401, detail="Invalid authentication credentials")

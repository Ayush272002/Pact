"""FastAPI backend for the Modern Next.js + FastAPI Template."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        # "https://yoursite.com",  # Production (uncomment and replace)
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/hello")
def hello():
    """Test endpoint to verify frontend-backend connection."""
    return {"message": "Hello from FastAPI!"}

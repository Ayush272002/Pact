"""FastAPI backend for the Pact multi-agent simulation platform.

Provides endpoints for scenario creation, simulation control, and state retrieval.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.simulation_router import router as simulation_router

app = FastAPI(
    title="Pact Engine API",
    description="Multi-agent adversarial simulation platform using Game Theory",
    version="0.1.0",
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(simulation_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "service": "pact-engine"}


@app.get("/")
def root() -> dict[str, str]:
    """Root endpoint with API information."""
    return {
        "name": "Pact Engine API",
        "version": "0.1.0",
        "docs": "/docs",
    }

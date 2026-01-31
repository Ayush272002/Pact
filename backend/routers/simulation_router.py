"""Simulation API endpoints.

Handles scenario creation, simulation control, and state retrieval.
"""

import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from schemas import ScenarioConfig, SimulationState
from services.simulation_service import simulation_service

router = APIRouter(prefix="/api", tags=["simulation"])


class CreateScenarioRequest(BaseModel):
    """Request body for creating a new scenario."""

    scenario_name: str
    description: str
    negotiation_issues: list[str]
    global_volatility: float = 0.3
    max_epochs: int = 10


class SimulationResponse(BaseModel):
    """Response containing simulation state."""

    simulation_id: str
    success: bool
    state: SimulationState | None = None
    message: str | None = None


@router.post("/scenario/create", response_model=SimulationResponse)
def create_scenario(request: CreateScenarioRequest) -> SimulationResponse:
    """Initialise a new simulation scenario.

    Creates agents, sets up the negotiation context, and returns Epoch 0 state.
    """
    config = ScenarioConfig(
        scenario_name=request.scenario_name,
        description=request.description,
        negotiation_issues=request.negotiation_issues,
        global_volatility=request.global_volatility,
        max_epochs=request.max_epochs,
    )

    state = simulation_service.create_simulation(config)

    return SimulationResponse(
        simulation_id=state.simulation_id,
        success=True,
        state=state,
        message="Simulation initialised successfully",
    )


@router.post("/simulation/{simulation_id}/start", response_model=SimulationResponse)
def start_simulation(simulation_id: str) -> SimulationResponse:
    """Begin Epoch 0 with opening statements from all agents."""
    state = simulation_service.get_simulation(simulation_id)
    if not state:
        raise HTTPException(status_code=404, detail="Simulation not found")

    state = simulation_service.step(simulation_id)

    return SimulationResponse(
        simulation_id=simulation_id,
        success=True,
        state=state,
        message="Simulation started",
    )


@router.post("/simulation/{simulation_id}/step", response_model=SimulationResponse)
def step_simulation(simulation_id: str) -> SimulationResponse:
    """Advance simulation by one turn."""
    try:
        state = simulation_service.step(simulation_id)
        return SimulationResponse(
            simulation_id=simulation_id,
            success=True,
            state=state,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/simulation/{simulation_id}/state", response_model=SimulationResponse)
def get_simulation_state(simulation_id: str) -> SimulationResponse:
    """Retrieve the current simulation state."""
    state = simulation_service.get_simulation(simulation_id)
    if not state:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return SimulationResponse(
        simulation_id=simulation_id,
        success=True,
        state=state,
    )


@router.get("/simulation/{simulation_id}/stream")
async def stream_simulation(simulation_id: str) -> StreamingResponse:
    """Stream simulation events via Server-Sent Events."""
    state = simulation_service.get_simulation(simulation_id)
    if not state:
        raise HTTPException(status_code=404, detail="Simulation not found")

    async def event_generator():
        """Generate SSE events for simulation updates."""
        for _ in range(10):
            try:
                new_state = simulation_service.step(simulation_id)
                last_msg = new_state.chat_history[-1]

                event_data = {
                    "type": "message_added",
                    "epoch": new_state.current_epoch,
                    "agent_id": last_msg.agent_id,
                    "content": last_msg.content,
                    "sentiment_delta": last_msg.sentiment_delta,
                    "global_tension": new_state.global_tension,
                    "nash_product": new_state.nash_product,
                }
                yield f"data: {json.dumps(event_data)}\n\n"

                alliance_data = {
                    "type": "coalitions_detected",
                    "alliances": new_state.active_alliances,
                }
                yield f"data: {json.dumps(alliance_data)}\n\n"

                await asyncio.sleep(1)

            except ValueError:
                break

        yield 'data: {"type": "simulation_complete"}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

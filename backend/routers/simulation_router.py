"""Simulation API endpoints.

Handles scenario creation, simulation control, and state retrieval.
"""

import asyncio
import json
import logging

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
    """Initialise the fixed Demo Scenario.

    Creates agents, sets up the negotiation context, and returns Epoch 0 state.
    """
    # OVERRIDE: Force the specific Arctic Scenario config for the demo
    # This ensures variable names are short (e.g. "revenue_share")
    # and agents know exactly what to negotiate.
    config = ScenarioConfig(
        scenario_name="Arctic Resource Treaty 2030",
        description=(
            "Negotiation between a Resource-Rich State, an Environmental Advocate, "
            "and an Indigenous Coalition over Arctic oil extraction rights."
        ),
        negotiation_issues=[
            "revenue_share",  # 0.0-1.0 (Percentage)
            "environmental_strictness",  # 0.0-1.0 (Percentage)
            "indigenous_autonomy",  # 0.0-1.0 (Control %)
            "extraction_capacity",  # 0.0-1.0 (Volume)
            "infrastructure_fund",  # 0.0-1.0 ($ Billions)
        ],
        global_volatility=0.3,
        max_epochs=12,
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
        loop = asyncio.get_event_loop()
        final_status = "COMPLETE"

        for _ in range(20):  # Max epochs as safety limit
            try:
                # Run blocking step() in thread pool to avoid blocking event loop
                new_state = await loop.run_in_executor(
                    None,  # Use default executor
                    simulation_service.step,
                    simulation_id,
                )
                last_msg = new_state.chat_history[-1]

                # Agent political capital updates
                agent_capitals = {
                    agent_id: agent.political_capital
                    for agent_id, agent in new_state.agents.items()
                }

                event_data = {
                    "type": "message_added",
                    "epoch": new_state.current_epoch,
                    "agent_id": last_msg.agent_id,
                    "content": last_msg.content,
                    "sentiment_delta": last_msg.sentiment_delta,
                    "global_tension": new_state.global_tension,
                    "nash_product": new_state.nash_product,
                    "agent_capitals": agent_capitals,
                    "treaty_values": new_state.current_treaty.issue_values,
                    "status": new_state.status,
                }
                yield f"data: {json.dumps(event_data)}\n\n"

                alliance_data = {
                    "type": "coalitions_detected",
                    "alliances": new_state.active_alliances,
                }
                yield f"data: {json.dumps(alliance_data)}\n\n"

                # Check for terminal states
                if new_state.status in ("CONSENSUS_REACHED", "DEADLOCK"):
                    final_status = new_state.status
                    break

                await asyncio.sleep(0.5)

            except ValueError:
                break
            except Exception as e:
                logging.error("SSE stream error: %s", e)
                break

        yield f'data: {{"type": "simulation_complete", "status": "{final_status}"}}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

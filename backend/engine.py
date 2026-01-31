"""The Simulation Engine.

This module provides the NashEngine class for running simulations.
The core logic is now in services/simulation_service.py.
"""

from schemas import (
    ScenarioConfig,
    SimulationState,
)

from services.simulation_service import simulation_service


class NashEngine:
    """Legacy engine wrapper delegating to SimulationService."""

    def __init__(self) -> None:
        self.state: SimulationState | None = None
        self._sim_id: str | None = None

    def initialize_simulation(self, config: ScenarioConfig) -> SimulationState:
        """Create simulation via service."""
        self.state = simulation_service.create_simulation(config)
        self._sim_id = self.state.simulation_id
        return self.state

    def step(self) -> SimulationState:
        """Step simulation via service."""
        if not self._sim_id:
            raise ValueError("Simulation not initialized")

        self.state = simulation_service.step(self._sim_id)
        return self.state


# Global singleton
engine = NashEngine()

if __name__ == "__main__":
    print("Running Engine Demo (connected to LLM)...")

    demo_config = ScenarioConfig(
        scenario_name="Test Scenario",
        description="A test run",
        negotiation_issues=["tax_rate"],
        global_volatility=0.5,
    )
    state = engine.initialize_simulation(demo_config)
    print(f"Initialised Simulation: {state.simulation_id}")

    try:
        new_state = engine.step()
        print("\nTurn Result:")
        last_msg = new_state.chat_history[-1]
        print(f"Speaker: {last_msg.agent_id}")
        print(f"Message: {last_msg.content}")
    except Exception as e:  # pylint: disable=broad-except
        print(f"Error executing step: {e}")

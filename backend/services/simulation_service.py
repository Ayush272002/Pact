"""Simulation service containing core game theory and orchestration logic.

Handles agent instantiation, turn execution, and state management.
"""

import random
import uuid

from schemas import (
    AgentProfile,
    CognitiveParams,
    DiplomaticMessage,
    IntentBid,
    IRArchetype,
    ScenarioConfig,
    ShockType,
    SimulationState,
    StrategyType,
    UtilityGoal,
)
from services.llm_service import llm_service

# Recency penalty constants
RECENCY_PENALTY_TURNS = 3
RECENCY_PENALTY_FACTOR = 2.0

# Consensus detection
CONSENSUS_URGENCY_THRESHOLD = 2.0


class SimulationService:
    """Orchestrates the multi-agent negotiation simulation.

    Implements the 3-phase orchestration loop (Think -> Select -> Act)
    and manages simulation state.
    """

    def __init__(self) -> None:
        self._simulations: dict[str, SimulationState] = {}

    def create_simulation(self, config: ScenarioConfig) -> SimulationState:
        """Initialise a new simulation with agents based on scenario config.

        Args:
            config: Scenario configuration with negotiation context

        Returns:
            Newly created SimulationState
        """
        agents = self._create_default_agents(config)

        state = SimulationState(
            simulation_id=str(uuid.uuid4()),
            agents=agents,
            current_epoch=0,
            global_tension=0.3,
            volatility=config.global_volatility,
        )

        self._simulations[state.simulation_id] = state
        return state

    def get_simulation(self, simulation_id: str) -> SimulationState | None:
        """Retrieve simulation state by ID."""
        return self._simulations.get(simulation_id)

    def step(self, simulation_id: str) -> SimulationState:
        """Advance simulation by one turn using the 3-phase orchestration loop.

        Phase A (Think): All agents generate IntentBids
        Phase B (Select): Orchestrator picks speaker based on urgency + penalties
        Phase C (Act): Winner generates DiplomaticMessage and updates state

        Args:
            simulation_id: ID of the simulation to advance

        Returns:
            Updated SimulationState

        Raises:
            ValueError: If simulation not found
        """
        state = self._simulations.get(simulation_id)
        if not state:
            raise ValueError(f"Simulation not found: {simulation_id}")

        state.current_epoch += 1

        # Check for stochastic shock based on volatility
        if self._should_trigger_shock(state):
            self._apply_shock(state)

        # === PHASE A: THINK ===
        bids = self._generate_intent_bids(state)

        # Check for consensus: if no one wants to speak urgently, end simulation
        max_urgency = max(bid.urgency for bid in bids)
        if max_urgency < CONSENSUS_URGENCY_THRESHOLD:
            state.status = "CONSENSUS_REACHED"
            return state

        # === PHASE B: SELECT ===
        speaker_id = self._select_speaker(state, bids)

        # === PHASE C: ACT ===
        message = self._generate_diplomatic_message(state, speaker_id)
        state.chat_history.append(message)

        # Deduct political capital from speaker (speaking costs influence)
        self._deduct_political_capital(state, speaker_id, message)

        # Update global tension based on sentiment
        self._update_global_tension(state, message.sentiment_delta)

        # Update treaty state if there's a numeric proposal
        if message.game_move and message.game_move.numeric_proposal:
            self._update_treaty_state(state, message.game_move.numeric_proposal)

        # Calculate Nash Product (joint utility)
        state.nash_product = self._calculate_nash_product(state)

        # Update alliance topology
        self._update_alliances(state)

        return state

    def _generate_intent_bids(self, state: SimulationState) -> list[IntentBid]:
        """Generate IntentBids for all agents in parallel (Phase A)."""
        agents = list(state.agents.values())
        return llm_service.generate_intent_bids_parallel(agents, state)

    def _select_speaker(
        self,
        state: SimulationState,
        bids: list[IntentBid],
    ) -> str:
        """Select speaker based on urgency with recency penalties (Phase B)."""
        recent_speakers = [
            msg.agent_id for msg in state.chat_history[-RECENCY_PENALTY_TURNS:]
        ]

        adjusted_bids = []
        for bid in bids:
            adjusted_urgency = bid.urgency

            if bid.agent_id in recent_speakers:
                penalty_count = recent_speakers.count(bid.agent_id)
                adjusted_urgency -= penalty_count * RECENCY_PENALTY_FACTOR

            adjusted_bids.append((bid.agent_id, max(0.0, adjusted_urgency)))

        return max(adjusted_bids, key=lambda x: x[1])[0]

    def _generate_diplomatic_message(
        self,
        state: SimulationState,
        speaker_id: str,
    ) -> DiplomaticMessage:
        """Generate diplomatic message from selected speaker (Phase C)."""
        # Use LLM to generate message
        return llm_service.generate_diplomatic_message(speaker_id, state)

    def _create_default_agents(
        self,
        config: ScenarioConfig,
    ) -> dict[str, AgentProfile]:
        """Generate agent profiles dynamically using LLM.

        Uses the scenario description to create appropriate agents
        with relevant goals and personalities.

        Args:
            config: Scenario configuration with context

        Returns:
            Dictionary of agent profiles keyed by agent_id
        """
        agents = llm_service.generate_agents_from_scenario(config)
        return agents

    def _should_trigger_shock(self, state: SimulationState) -> bool:
        """Determine if a stochastic shock should occur this turn."""
        return random.random() < state.volatility * 0.3

    def _apply_shock(self, state: SimulationState) -> None:
        """Apply a random stochastic shock to the simulation.

        Modifies agent utility weights or global tension.
        """
        shock_type = random.choice(list(ShockType))

        if shock_type == ShockType.RESOURCE_SCARCITY:
            state.global_tension = min(1.0, state.global_tension + 0.15)
            for agent in state.agents.values():
                for goal in agent.utility_goals:
                    goal.weight = min(1.0, goal.weight * 1.2)

        elif shock_type == ShockType.ASYMMETRIC_INFO:
            agent = random.choice(list(state.agents.values()))
            agent.cognitive_params.batna_score = min(
                1.0,
                agent.cognitive_params.batna_score + 0.2,
            )

        elif shock_type == ShockType.BLACK_SWAN:
            state.global_tension = min(1.0, state.global_tension + 0.3)

    def _update_global_tension(
        self,
        state: SimulationState,
        sentiment_delta: float,
    ) -> None:
        """Update global tension based on message sentiment.

        Note: sentiment_delta is POSITIVE for good/cooperative sentiment,
        so we SUBTRACT it from tension (good vibes = lower tension).
        """
        state.global_tension -= sentiment_delta  # Positive sentiment reduces tension
        state.global_tension = max(0.0, min(1.0, state.global_tension))

    def _deduct_political_capital(
        self,
        state: SimulationState,
        speaker_id: str,
        message: DiplomaticMessage,
    ) -> None:
        """Deduct political capital from speaking agent.

        Cost depends on the nature of the move:
        - Aggressive moves cost more (burning bridges)
        - Cooperative moves cost less
        - Base cost ensures capital drains over time
        """
        agent = state.agents.get(speaker_id)
        if not agent:
            return

        # Base cost: 3-6 points per turn
        base_cost = random.randint(3, 6)

        # Modifier based on sentiment (negative = aggressive = costly)
        sentiment_modifier = 0
        if message.sentiment_delta < -0.1:
            sentiment_modifier = random.randint(2, 5)  # Aggression costs more
        elif message.sentiment_delta > 0.1:
            sentiment_modifier = -random.randint(1, 2)  # Cooperation is cheaper

        total_cost = max(1, base_cost + sentiment_modifier)
        agent.political_capital = max(0, agent.political_capital - total_cost)

    def _update_treaty_state(
        self,
        state: SimulationState,
        proposal: dict[str, float],
    ) -> None:
        """Update treaty state with new proposals."""
        for issue, value in proposal.items():
            state.current_treaty.issue_values[issue] = value
        state.current_treaty.last_updated_epoch = state.current_epoch

    def _calculate_nash_product(self, state: SimulationState) -> float:
        """Calculate Nash Product: product of all agents' utilities."""
        if not state.agents:
            return 0.0

        product = 1.0
        for agent in state.agents.values():
            base_utility = 1.0 - state.global_tension
            utility = base_utility * (
                0.5 + 0.5 * agent.cognitive_params.shadow_of_future
            )
            product *= max(0.01, utility)

        return product

    def _update_alliances(self, state: SimulationState) -> None:
        """Update alliance topology based on recent interactions."""
        agent_ids = list(state.agents.keys())
        alliances = []

        for i, agent_a in enumerate(agent_ids):
            for agent_b in agent_ids[i + 1 :]:
                base_strength = random.uniform(0.3, 1.0)
                strength = base_strength * (1.0 - state.global_tension * 0.5)
                alliances.append([agent_a, agent_b, strength])

        state.active_alliances = alliances


# Global singleton instance
simulation_service = SimulationService()

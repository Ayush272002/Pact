"""Simulation service containing core game theory and orchestration logic.

Handles agent instantiation, turn execution, and state management.
"""

import logging
import random
import uuid

from schemas import (
    AgentProfile,
    DiplomaticMessage,
    IntentBid,
    ScenarioConfig,
    ShockType,
    SimulationState,
    TreatyState,
)
from services.llm_service import llm_service

# Recency penalty constants
RECENCY_PENALTY_TURNS = 3
RECENCY_PENALTY_FACTOR = 2.0

# Consensus detection
CONSENSUS_URGENCY_THRESHOLD = 2.0

# Simulation limits
MAX_EPOCHS = 15
BASE_TENSION = 0.05  # Minimum tension floor (never shows 0%)


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

        # FIX: Force initial values to 0.5 (50%) so they don't look broken (0%)
        # if the agents fail to update them immediately.
        initial_treaty = TreatyState(
            issue_values={issue: 0.5 for issue in config.negotiation_issues},
        )

        state = SimulationState(
            simulation_id=str(uuid.uuid4()),
            agents=agents,
            current_epoch=0,
            global_tension=0.3,
            volatility=config.global_volatility,
            current_treaty=initial_treaty,
        )

        # Calculate initial Nash Product so the delta isn't +0.000
        state.nash_product = self._calculate_nash_product(state)

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

        # === PRIORITY 1: Check for consensus FIRST (before epoch limit) ===
        # Check urgency threshold
        max_urgency = max(bid.urgency for bid in bids)
        urgency_consensus = max_urgency < CONSENSUS_URGENCY_THRESHOLD

        # Check for agreement keywords in recent messages
        # Only check after minimum 5 epochs to avoid premature consensus
        keyword_consensus = False
        if state.current_epoch >= 5 and len(state.chat_history) >= 3:
            recent_messages = state.chat_history[-4:]  # Last 4 messages
            last_message = state.chat_history[-1]
            last_msg_lower = last_message.content.lower()

            # === BLOCKER: Negative keywords in last message = NO consensus ===
            # If the most recent speaker is rejecting, we cannot declare consensus
            rejection_keywords = [
                "insufficient",
                "unacceptable",
                "reject",
                "refuse",
                "counter",
                "cannot accept",
                "will not accept",
                "too low",
                "too high",
                "demand",
                "must have",
                "non-negotiable",
                "we counter",
            ]
            last_message_rejects = any(
                word in last_msg_lower for word in rejection_keywords
            )

            # If the last message is a rejection, skip all consensus checks
            if not last_message_rejects:
                # === METHOD 1: Strong finalization signals (any one = consensus) ===
                finalization_phrases = [
                    "prepared to finalize",
                    "ready to finalize",
                    "ready to sign",
                    "let us finalize",
                    "we can finalize",
                    "formal acceptance",
                    "treaty is acceptable",
                    "deal is acceptable",
                ]

                has_finalization = any(
                    any(
                        phrase in msg.content.lower() for phrase in finalization_phrases
                    )
                    for msg in recent_messages
                )

                # === METHOD 2: Consecutive agreement keywords (n-1 in a row = consensus) ===
                # Simple keywords that indicate positive sentiment toward agreement
                agreement_keywords = [
                    "accept",
                    "agree",
                    "commit",
                    "consensus",
                    "convergence",
                    "acknowledge",
                    "support",
                    "endorse",
                    "approve",
                    "ratify",
                    "constructive",
                    "progress",
                    "framework",
                    "settlement",
                    "secures",
                    "stability",
                    "balanced",
                ]

                # Count consecutive messages with agreement keywords
                consecutive_agreements = 0
                for msg in reversed(recent_messages):
                    msg_lower = msg.content.lower()
                    if any(word in msg_lower for word in agreement_keywords):
                        consecutive_agreements += 1
                    else:
                        break  # Chain broken

                # === METHOD 3: High density of agreement (n-1 of last 4 messages) ===
                agreement_density = sum(
                    any(word in msg.content.lower() for word in agreement_keywords)
                    for msg in recent_messages
                )

                # Dynamic threshold: need n-1 agents agreeing (supermajority)
                # For 3 agents: need 2, for 4 agents: need 3, for 2 agents: need 2 (min)
                n_agents = len(state.agents)
                required_agreements = max(2, n_agents - 1)

                # Consensus if ANY method triggers:
                # - Any finalization phrase
                # - n-1 consecutive agreement messages (supermajority)
                # - n-1 of last 4 messages have agreement keywords
                keyword_consensus = (
                    has_finalization
                    or consecutive_agreements >= required_agreements
                    or agreement_density >= required_agreements
                )

        # If consensus detected by either method, end successfully
        if urgency_consensus or keyword_consensus:
            state.status = "CONSENSUS_REACHED"
            # Drop tension to "relief" state for satisfying visual arc
            state.global_tension = 0.05
            return state

        # === PRIORITY 2: Check for epoch limit (only if no consensus) ===
        if state.current_epoch >= MAX_EPOCHS:
            state.status = "DEADLOCK"
            # Inject system message about failed negotiations
            state.chat_history.append(
                DiplomaticMessage(
                    agent_id="SYSTEM",
                    epoch=state.current_epoch,
                    content="Negotiations have expired without agreement. The Treaty fails.",
                    sentiment_delta=-0.2,
                    game_move=None,
                )
            )
            return state

        # === PHASE B: SELECT ===
        speaker_id = self._select_speaker(state, bids)

        # === ABSOLUTE FAILSAFE: Force rotation if somehow same speaker selected ===
        last_speaker = state.chat_history[-1].agent_id if state.chat_history else None
        if speaker_id == last_speaker:
            logging.warning(
                "ECHO FAILSAFE TRIGGERED: %s was about to speak twice. Forcing rotation.",
                speaker_id,
            )
            # Pick any other agent that's not the last speaker
            other_agents = [aid for aid in state.agents.keys() if aid != last_speaker]
            if other_agents:
                speaker_id = other_agents[0]

        # === PHASE C: ACT ===
        message = self._generate_diplomatic_message(state, speaker_id)
        state.chat_history.append(message)

        # Deduct political capital from speaker (speaking costs influence)
        self._deduct_political_capital(state, speaker_id, message)

        # Update global tension based on sentiment
        self._update_global_tension(state, message.sentiment_delta)

        # Update treaty state from structured treaty_updates (preferred)
        if message.treaty_updates and message.treaty_updates.issue_updates:
            self._update_treaty_state(state, message.treaty_updates.issue_updates)
        # Fallback: also check numeric_proposal for backwards compatibility
        elif message.game_move and message.game_move.numeric_proposal:
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
        """Select speaker based on urgency with strict anti-echo enforcement.

        Hard-bans the immediate previous speaker to prevent double-speaking,
        then applies soft penalties for other recent speakers (2+ turns ago).
        """
        # 1. Identify the immediate previous speaker
        last_speaker = state.chat_history[-1].agent_id if state.chat_history else None

        # 2. FILTER THEM OUT ENTIRELY (Hard Ban)
        # This prevents the "E10... E11..." double-speak bug
        candidates = [bid for bid in bids if bid.agent_id != last_speaker]

        # Safety fallback: If everyone is banned (rare/impossible), reset
        if not candidates:
            candidates = bids

        # 3. Soft penalty for speakers from 2+ turns ago (to encourage rotation)
        # Note: We slice to [-RECENCY_PENALTY_TURNS:-1] to EXCLUDE the last speaker
        recent_speakers = [
            msg.agent_id for msg in state.chat_history[-RECENCY_PENALTY_TURNS:-1]
        ]

        adjusted_bids = []
        for bid in candidates:
            adjusted_urgency = bid.urgency
            if bid.agent_id in recent_speakers:
                # Deduct urgency if they spoke recently (but not immediately last)
                adjusted_urgency -= RECENCY_PENALTY_FACTOR

            # Ensure non-negative
            adjusted_bids.append((bid.agent_id, max(0.0, adjusted_urgency)))

        # 4. Pick winner
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
        # Clamp to [BASE_TENSION, 1.0] -- never show 0% (looks fake)
        state.global_tension = max(BASE_TENSION, min(1.0, state.global_tension))

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
        proposal: dict[str, float | bool],
    ) -> None:
        """Update treaty state with new proposals.

        Handles normalisation of values:
        - Percentages > 1.0 are divided by 100 (e.g. 40 -> 0.40)
        - Booleans are converted to 1.0/0.0 for consistent display
        - Only updates issues that exist in the initial treaty
        """
        valid_issues = set(state.current_treaty.issue_values.keys())

        for issue, value in proposal.items():
            # Skip unknown issues (prevents hallucinated keys)
            if issue not in valid_issues:
                continue

            # Normalise the value
            if isinstance(value, bool):
                normalised = 1.0 if value else 0.0
            elif isinstance(value, (int, float)):
                # If > 1.0, assume it's a percentage that needs dividing
                normalised = float(value) / 100.0 if value > 1.0 else float(value)
            else:
                continue  # Skip invalid types

            state.current_treaty.issue_values[issue] = normalised

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

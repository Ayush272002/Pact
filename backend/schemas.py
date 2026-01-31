"""Data contracts and Pydantic schemas for the Pact Engine.

Defines Agent types, Simulation state, and Game Theory protocols.
"""

import uuid
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Key enums


class StrategyType(str, Enum):
    """Algorithmic strategies defined in Game Theory literature.

    Used to determine the Agent's cooperation probability.
    """

    TIT_FOR_TAT = "tit_for_tat"
    GRIM_TRIGGER = "grim_trigger"
    PAVLOV = "win_stay_lose_shift"
    ZD_EXTORT_2 = "zero_determinant_extort_2"
    ZD_GENEROUS_2 = "zero_determinant_generous_2"
    RANDOM_WALK = "random_walk"


class IRArchetype(str, Enum):
    """International Relations schools of thought.

    Defines the Agent's base personality and default parameters.
    """

    REALISM = "realism"
    LIBERALISM = "liberalism"
    CONSTRUCTIVISM = "constructivism"
    OFFENSIVE_REALISM = "offensive_realism"


class ShockType(str, Enum):
    """Exogenous shocks injected to test system resilience (HRT Stress Test)."""

    ASYMMETRIC_INFO = "asymmetric_info"
    RESOURCE_SCARCITY = "resource_scarcity"
    BLACK_SWAN = "black_swan"


class ScenarioConfig(BaseModel):
    """Configuration for the Global Context (User Input)."""

    scenario_name: str = Field(examples=["Arctic Oil Rights 2030"])
    description: str = Field(
        ..., description="The context prompt injected into the Orchestrator"
    )
    negotiation_issues: list[str] = Field(
        ...,
        description="List of variables to settle, eg: ['tax_rate', 'land_percent']",
    )
    global_volatility: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="0.0 = Stable negotiation; 1.0 = Frequent stochastic shocks",
    )
    max_epochs: int = Field(default=10, description="Game over condition")


class CognitiveParams(BaseModel):
    """Internal logic of the agent's decision making.

    These float values drive the Monte Carlo simulations.
    """

    shadow_of_future: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Discount factor (delta)",
    )
    batna_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Best Alternative to Negotiated Agreement",
    )
    audience_cost: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Political penalty for inconsistency",
    )


class UtilityGoal(BaseModel):
    """A single dimension of the agent's goal function (The Sliders)."""

    topic: str = Field(examples=["Economic Growth"])
    weight: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Importance slider value (0.0 to 1.0)",
    )
    is_private: bool = Field(
        default=False, description="If True, other agents cannot see this weight"
    )


class AgentProfile(BaseModel):
    """The Player Object (The Diplomat).

    Constructed at Epoch 0 and evolves over time.
    """

    agent_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(examples=["Norwegian Gov"])

    # The Identity (Immutable-ish)
    archetype: IRArchetype = Field(
        ..., description="Determines base strategy/personality"
    )
    strategy: StrategyType = Field(
        ..., description="The algorithmic logic used for cooperation"
    )

    # The Brain (Mutable)
    cognitive_params: CognitiveParams
    utility_goals: list[UtilityGoal]

    # The Secret
    private_mandate: str = Field(
        ..., description="Hidden agenda visible only to a 'God Mode' and the Agent"
    )

    # Resource Bar
    political_capital: float = Field(
        default=100.0, description="Currency spent to vote/speak"
    )

    @field_validator("utility_goals")
    @classmethod
    def validate_weights(cls, v: list[UtilityGoal]) -> list[UtilityGoal]:
        """Ensure agent has at least one goal."""
        if not v:
            raise ValueError("Agent must have at least one utility goal")
        return v


class IntentBid(BaseModel):
    """Output of the Thinking Phase.

    The Orchestrator uses this to decide WHO speaks next.
    """

    agent_id: str
    urgency: float = Field(
        ...,
        ge=0.0,
        le=10.0,
        description="Calculated desire to interrupt (0-10)",
    )
    target_agent_id: str | None = Field(None, description="Who they want to address")
    proposed_move: Literal["cooperate", "defect", "stall"]
    reasoning_trace: str = Field(
        ..., description="Internal monologue explaining the bid"
    )


class NegotiationMove(BaseModel):
    """A formal logical move in the game theory graph."""

    move_type: Literal["proposal", "rejection", "acceptance", "concession", "threat"]
    numeric_proposal: dict[str, float] | None = Field(
        None, description="Proposed values for negotiation_issues"
    )
    details: dict[str, str] = Field(..., description="Structured details of the move")

    @field_validator("numeric_proposal")
    @classmethod
    def normalize_percentages(
        cls, v: dict[str, float] | None
    ) -> dict[str, float] | None:
        """Normalize any >1.0 values to decimals (assume percentages)."""
        if not v:
            return v
        return {k: (val / 100.0 if val > 1.0 else val) for k, val in v.items()}


class DiplomaticMessage(BaseModel):
    """Output of the Speaking Phase.

    This is what gets rendered in the Chat UI.
    """

    agent_id: str
    epoch: int
    content: str = Field(..., description="The actual dialogue text")

    # Meta-Data for Visualisation
    sentiment_delta: float = Field(
        ..., description="Shift in global tension (-1.0 to 1.0)"
    )
    game_move: NegotiationMove | None = None

    tool_calls: list[str] | None = Field(
        default=None, description="List of tool names invoked by the agent"
    )

    # Asymmetric Info Channel
    whisper_to: str | None = Field(
        default=None, description="If set, only this agent sees the message"
    )


class TreatyState(BaseModel):
    """Tracks the current agreed-upon values."""

    # Tracks specific number/value for each issue (eg: {'tax_rate': 0.15})
    issue_values: dict[str, float] = Field(default_factory=dict)

    # Text clauses generated by the LLM
    clauses: list[str] = Field(default_factory=list)
    last_updated_epoch: int = 0
    signatures: list[str] = Field(default_factory=list)


# Global state
class SimulationState(BaseModel):
    """The Single Source of Truth for the Frontend."""

    simulation_id: str
    current_epoch: int = 0
    global_tension: float = Field(default=0.5, description="0.0 = Utopia, 1.0 = War")
    volatility: float = Field(
        default=0.3, description="Probability of stochastic shocks"
    )
    nash_product: float = Field(
        default=0.0, description="The joint utility score (maximise this)"
    )
    status: str = Field(
        default="RUNNING",
        description="Simulation lifecycle: RUNNING, CONSENSUS_REACHED",
    )

    current_treaty: TreatyState = Field(default_factory=TreatyState)

    agents: dict[str, AgentProfile]
    chat_history: list[DiplomaticMessage] = []

    # The Graph Topology (For Force-Directed Graph)
    # List of tuples: [AgentA_ID, AgentB_ID, AgreementStrength_Float]
    active_alliances: list[list[str | float]] = []

    def get_last_n_turns(self, n: int) -> str:
        """Retrieve formatted history for RAG context.

        Args:
            n: Number of recent turns to retrieve

        Returns:
            String representation of the chat history
        """
        recent = self.chat_history[-n:]
        return "\n".join([f"{t.agent_id}: {t.content}" for t in recent])

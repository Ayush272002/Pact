"""LLM Service for handling interactions with Anthropic's Claude.

Provides methods for generating structured game theory moves and dialogue.
Includes logging, timeouts, and exponential backoff retry logic.
"""

import logging
import os

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from schemas import (
    AgentProfile,
    DiplomaticMessage,
    IntentBid,
    NegotiationMove,
    SimulationState,
)

# Load environment variables
load_dotenv()

# Constants
MODEL_NAME = "claude-haiku-4-5-20251001"
REQUEST_TIMEOUT = 30.0  # seconds
MAX_RETRIES = 3


class LLMService:
    """Service for LLM interactions using LangChain and Anthropic."""

    def __init__(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            logging.warning("ANTHROPIC_API_KEY not found. LLM calls will fail.")

        self.llm = ChatAnthropic(
            model=MODEL_NAME,
            api_key=api_key,
            temperature=0.7,
            timeout=REQUEST_TIMEOUT,
        )
        logging.info(
            "LLMService initialised with model=%s, timeout=%ss",
            MODEL_NAME,
            REQUEST_TIMEOUT,
        )

    def generate_intent_bid(
        self,
        agent: AgentProfile,
        state: SimulationState,
    ) -> IntentBid:
        """Generate an IntentBid for an agent based on current state."""
        parser = PydanticOutputParser(pydantic_object=IntentBid)

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", self._get_system_prompt(agent)),
                (
                    "user",
                    "Current Global Tension: {tension}\n\n"
                    "Recent History:\n{history}\n\n"
                    "Generate your IntentBid for the next turn.\n\n"
                    "URGENCY GUIDELINES (use 2 decimal places for precision):\n"
                    "- Realists: Higher urgency when resources/power are at stake\n"
                    "- Liberals: Higher urgency when cooperation is threatened\n"
                    "- Constructivists: Higher urgency when social norms are violated\n"
                    "- Offensive Realists: Higher urgency when "
                    "dominance opportunity exists\n\n"
                    "{format_instructions}",
                ),
            ]
        )

        chain = prompt | self.llm | parser
        history_text = state.get_last_n_turns(5)

        try:
            bid = self._invoke_with_retry(
                chain,
                {
                    "tension": state.global_tension,
                    "history": history_text,
                    "format_instructions": parser.get_format_instructions(),
                },
                context=f"IntentBid for {agent.name}",
            )
            # Ensure agent_id is correct relative to the simulation map
            bid.agent_id = agent.agent_id
            logging.info(
                "Generated bid for %s: urgency=%.1f",
                agent.name,
                bid.urgency,
            )
            return bid
        except Exception as e:  # pylint: disable=broad-except
            # Fallback for any LLM failure with safe default response
            logging.error("All retries failed for %s: %s", agent.name, e)
            return IntentBid(
                agent_id=agent.agent_id,
                urgency=5.0,
                target_agent_id=None,
                proposed_move="stall",
                reasoning_trace=f"Fallback due to LLM error: {str(e)}",
            )

    def generate_diplomatic_message(
        self,
        speaker_id: str,
        state: SimulationState,
    ) -> DiplomaticMessage:
        """Generate a diplomatic message/move for the selected speaker."""
        agent = state.agents[speaker_id]
        parser = PydanticOutputParser(pydantic_object=DiplomaticMessage)

        # Get negotiation issues for schema enforcement
        issues = (
            list(state.current_treaty.issue_values.keys())
            if state.current_treaty.issue_values
            else ["temperature", "cost_share"]
        )
        issues_str = ", ".join(issues)

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", self._get_system_prompt(agent)),
                (
                    "user",
                    "You have the floor. Current Global Tension: {tension}\n\n"
                    "Recent History:\n{history}\n\n"
                    "Generate your DiplomaticMessage. "
                    "Ensure 'agent_id' matches {agent_id} "
                    "and 'epoch' is {epoch}.\n\n"
                    "IMPORTANT RULES:\n"
                    "1. sentiment_delta: Use POSITIVE values "
                    "(+0.1 to +0.5) for cooperative/friendly moves, "
                    "NEGATIVE values (-0.1 to -0.5) for hostile/aggressive "
                    "moves.\n"
                    "2. numeric_proposal: You MUST use ONLY these keys: {issues_str}. "
                    "Do NOT invent new key names.\n\n"
                    "{format_instructions}",
                ),
            ]
        )

        chain = prompt | self.llm | parser
        history_text = state.get_last_n_turns(10)

        try:
            msg = self._invoke_with_retry(
                chain,
                {
                    "tension": state.global_tension,
                    "history": history_text,
                    "agent_id": speaker_id,
                    "epoch": state.current_epoch,
                    "issues_str": issues_str,
                    "format_instructions": parser.get_format_instructions(),
                },
                context=f"DiplomaticMessage for {agent.name}",
            )
            logging.info(
                "Generated message for %s: %s...",
                agent.name,
                msg.content[:100],
            )
            return msg
        except Exception as e:  # pylint: disable=broad-except
            # Fallback for any LLM failure with safe default response
            logging.error("All retries failed for %s: %s", agent.name, e)
            return DiplomaticMessage(
                agent_id=speaker_id,
                epoch=state.current_epoch,
                content="...",
                sentiment_delta=0.0,
                game_move=NegotiationMove(
                    move_type="concession",
                    details={"error": str(e)},
                    numeric_proposal=None,
                ),
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
        reraise=True,
    )
    def _invoke_with_retry(self, chain, inputs: dict, context: str):
        """Invoke LLM chain with exponential backoff retry."""
        logging.info("Starting LLM call: %s", context)
        try:
            result = chain.invoke(inputs)
            logging.info("LLM response preview (%s): %s...", context, str(result)[:200])
            return result
        except Exception as e:
            logging.warning(
                "LLM call failed (%s): %s: %s", context, type(e).__name__, e
            )
            raise

    def _get_system_prompt(self, agent: AgentProfile) -> str:
        """Construct the system prompt for an agent."""
        goals_str = "\n".join([f"- {g.topic}: {g.weight}" for g in agent.utility_goals])

        return (
            f"You are {agent.name}, acting as a {agent.archetype.value} diplomat.\n"
            f"Strategy: {agent.strategy.value}\n"
            f"Private Mandate: {agent.private_mandate}\n\n"
            f"Utility Goals:\n{goals_str}\n\n"
            "Cognitive Parameters:\n"
            f"- Shadow of Future: {agent.cognitive_params.shadow_of_future}\n"
            f"- BATNA Score: {agent.cognitive_params.batna_score}\n"
            f"- Audience Cost: {agent.cognitive_params.audience_cost}\n\n"
            "Act according to your archetype and parameters. "
            "Negotiate aggressively or cooperatively based on your strategy."
        )


# Global singleton
llm_service = LLMService()

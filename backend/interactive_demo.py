"""Interactive Simulation Demo: Roommate Thermostat War.

This script demonstrates a negotiation between roommates
with conflicting temperature preferences.
"""

import time

from core.constants import DIVIDER
from engine import engine
from schemas import (
    AgentProfile,
    CognitiveParams,
    IRArchetype,
    ScenarioConfig,
    SimulationState,
    StrategyType,
    UtilityGoal,
)


def setup_roommate_scenario() -> SimulationState:
    """Configure the simulation with a relatable roommate scenario."""
    config = ScenarioConfig(
        scenario_name="The Great Thermostat War",
        description=(
            "Roommates negotiation the apartment temperature setting for winter."
        ),
        negotiation_issues=["thermostat_temp", "utility_bill_split"],
        global_volatility=0.2,  # Low volatility, just domestic drama
    )

    # Initialize basic state
    state = engine.initialize_simulation(config)

    # Custom Agents
    phil = AgentProfile(
        agent_id="phil",
        name="Penny-Pinching Phil",
        archetype=IRArchetype.REALISM,  # Self-interest (money)
        strategy=StrategyType.ZD_EXTORT_2,  # Aggressive cost cutting
        cognitive_params=CognitiveParams(
            shadow_of_future=0.9,
            batna_score=0.6,  # Can move back to parents
            audience_cost=0.1,  # Shameless
        ),
        utility_goals=[
            UtilityGoal(topic="utility_bill_split", weight=1.0),
            UtilityGoal(topic="thermostat_temp", weight=0.8),
        ],
        private_mandate=(
            "Keep the heating OFF. Put on a sweater. "
            "If they want heat, they pay 80% of the bill."
        ),
    )

    tina = AgentProfile(
        agent_id="tina",
        name="Tropical Tina",
        archetype=IRArchetype.LIBERALISM,  # Cooperative but firm on needs
        strategy=StrategyType.TIT_FOR_TAT,
        cognitive_params=CognitiveParams(
            shadow_of_future=0.8,
            batna_score=0.5,
            audience_cost=0.7,
        ),
        utility_goals=[
            UtilityGoal(topic="thermostat_temp", weight=1.0),
            UtilityGoal(topic="comfort", weight=0.9),
        ],
        private_mandate=(
            "It's freezing! I need at least 22°C. "
            "I'm willing to split fair, but Phil is hoarding money."
        ),
    )

    pam = AgentProfile(
        agent_id="pam",
        name="Peacemaker Pam",
        archetype=IRArchetype.CONSTRUCTIVISM,  # Social harmony
        strategy=StrategyType.PAVLOV,
        cognitive_params=CognitiveParams(
            shadow_of_future=0.95,  # Lives here long term
            batna_score=0.3,  # Hate moving
            audience_cost=0.9,  # Wants chill vibes
        ),
        utility_goals=[
            UtilityGoal(topic="harmony", weight=1.0),
            UtilityGoal(topic="compromise", weight=0.8),
        ],
        private_mandate=(
            "Just stop the arguing. Find a middle ground (20°C?) "
            "so we can watch TV in peace."
        ),
    )

    # Overwrite agents in state
    state.agents = {
        "phil": phil,
        "tina": tina,
        "pam": pam,
    }

    return state


def print_separator() -> None:
    """Print visual separator line."""
    print(DIVIDER)


def main() -> None:
    """Run interactive roommate simulation demo."""
    print_separator()
    print("The Great Thermostat War (Roommate Simulation)")
    print_separator()

    state = setup_roommate_scenario()

    print(f"Scenario: {state.global_tension * 100:.0f}% Household Tension")
    print("Roommates:")
    for agent in state.agents.values():
        print(f"  • {agent.name} ({agent.archetype.value})")

    # Run for 10 turns automatically
    for turn in range(1, 11):
        print_separator()
        print(f"Turn {turn}/10")
        print("Thinking... (Agents deciding urgency)")
        time.sleep(1)  # Brief pause for readability

        try:
            # Run the simulation step
            new_state = engine.step()

            # Check for consensus
            if new_state.status == "CONSENSUS_REACHED":
                print("\nCONSENSUS REACHED! Simulation complete.")
                print(f"    Final Tension: {new_state.global_tension:.2f}")
                break

            # Get the new message
            last_msg = new_state.chat_history[-1]
            speaker = new_state.agents[last_msg.agent_id]

            print(f"\nSPEAKER: {speaker.name}")
            print(f'MESSAGE: "{last_msg.content}"')

            # Display stats
            print("\nStats:")
            print(f"    Tension: {new_state.global_tension:.2f}")
            if last_msg.game_move and last_msg.game_move.numeric_proposal:
                print(f"    Proposal: {last_msg.game_move.numeric_proposal}")

        except KeyboardInterrupt:
            print("\nExiting simulation.")
            break
        except Exception as e:  # pylint: disable=broad-except
            print(f"\nError: {e}")
            break


if __name__ == "__main__":
    main()

"""Project-wide constants and configuration values."""

from pathlib import Path

# Directory paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
BACKEND_DIR = Path(__file__).parent.parent

# Simulation defaults
DEFAULT_VOLATILITY = 0.3
DEFAULT_SHADOW_FUTURE = 0.9
DEFAULT_BATNA = 0.5
DEFAULT_MAX_EPOCHS = 10

# Recency penalty for bid-to-speak protocol
RECENCY_PENALTY_TURNS = 3
RECENCY_PENALTY_FACTOR = 2.0

# Console output divider
DIVIDER = "=" * 60

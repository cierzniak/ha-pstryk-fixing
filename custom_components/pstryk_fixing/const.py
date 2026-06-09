"""Constants for the Pstryk Fixing integration."""

from __future__ import annotations

from datetime import timedelta
from typing import Final

DOMAIN: Final = "pstryk_fixing"

CONF_OPERATOR: Final = "operator"
CONF_TARIFF: Final = "tariff"
CONF_INCLUDE_SELL: Final = "include_sell"

# The public API runs on a single fixed host; there is nothing to configure.
DEFAULT_BASE_URL: Final = "https://pstryk.gdansk.best"
DEFAULT_INCLUDE_SELL: Final = True

# Day-ahead prices change at most daily; tomorrow is published in the early
# afternoon. Polling every 30 min keeps the current-hour sensor fresh and picks
# up tomorrow's prices soon after they appear, without hammering the public API.
UPDATE_INTERVAL: Final = timedelta(minutes=30)

# Consumption advice values mirrored from the API (AdviceLevel).
ADVICE_USE: Final = "use"
ADVICE_NEUTRAL: Final = "neutral"
ADVICE_LIMIT: Final = "limit"
ADVICE_OPTIONS: Final = [ADVICE_USE, ADVICE_NEUTRAL, ADVICE_LIMIT]

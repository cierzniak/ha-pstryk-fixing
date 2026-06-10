"""Data update coordinator polling the Pstryk Fixing outlook endpoint."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .api import PstrykApiClient, PstrykApiError
from .const import (
    CONF_INCLUDE_SELL,
    CONF_OPERATOR,
    CONF_TARIFF,
    DOMAIN,
    UPDATE_INTERVAL,
)
from .outlook import extract_now_block, extract_today_summary, resolve_current_hour

_LOGGER = logging.getLogger(__name__)


class PstrykOutlookCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Fetches the outlook once per interval and exposes the current hour."""

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, client: PstrykApiClient
    ) -> None:
        self._client = client
        self.operator: str = entry.data[CONF_OPERATOR]
        self.tariff: str = entry.data[CONF_TARIFF]
        self.include_sell: bool = entry.data.get(CONF_INCLUDE_SELL, True)
        super().__init__(
            hass,
            logger=_LOGGER,
            name=f"{DOMAIN} {self.operator}/{self.tariff}",
            update_interval=UPDATE_INTERVAL,
        )

    async def _async_update_data(self) -> dict[str, Any]:
        try:
            return await self._client.async_get_outlook(
                self.operator, self.tariff, include_sell=self.include_sell
            )
        except PstrykApiError as err:
            raise UpdateFailed(str(err)) from err

    def now_block(self) -> dict[str, Any]:
        """Return the server-computed forward-looking 'now' block (may be empty)."""
        return extract_now_block(self.data)

    def today_summary(self) -> dict[str, Any]:
        """Return today's aggregate summary (cheapest/dearest hour, counts)."""
        return extract_today_summary(self.data)

    def current_hour(self) -> dict[str, Any] | None:
        """Return the hour row covering 'now' (server-preferred, client fallback)."""
        return resolve_current_hour(self.data, dt_util.utcnow())

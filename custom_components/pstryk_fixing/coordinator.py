"""Data update coordinator polling the Pstryk Fixing outlook endpoint."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .api import PstrykApiClient, PstrykApiError
from .const import (
    CONF_INCLUDE_SELL,
    CONF_OPERATOR,
    CONF_TARIFF,
    DEFAULT_BASE_URL,
    DOMAIN,
    UPDATE_INTERVAL,
)
from .outlook import extract_now_block, extract_today_summary, resolve_current_hour

if TYPE_CHECKING:
    from .load_scheduler import LoadScheduler

_LOGGER = logging.getLogger(__name__)


def load_device_info(
    coordinator: PstrykOutlookCoordinator, subentry_id: str, name: str
) -> dict[str, Any]:
    """Device descriptor for a load, linked to its parent tariff device."""
    return {
        "identifiers": {(DOMAIN, f"load_{subentry_id}")},
        "name": name,
        "manufacturer": "Pstryk Fixing",
        "model": "Load scheduler",
        "via_device": (DOMAIN, f"{coordinator.operator}_{coordinator.tariff}"),
    }


class PstrykOutlookCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Fetches the outlook once per interval and exposes the current hour."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        client: PstrykApiClient,
        integration_version: str | None = None,
    ) -> None:
        self._client = client
        self.operator: str = entry.data[CONF_OPERATOR]
        self.tariff: str = entry.data[CONF_TARIFF]
        self.include_sell: bool = entry.data.get(CONF_INCLUDE_SELL, True)
        self.integration_version = integration_version
        self.loads: dict[str, LoadScheduler] = {}
        super().__init__(
            hass,
            logger=_LOGGER,
            name=f"{DOMAIN} {self.operator}/{self.tariff}",
            update_interval=UPDATE_INTERVAL,
        )

    def device_info(self) -> dict[str, Any]:
        """Shared device descriptor for every entity of this config entry."""
        return {
            "identifiers": {(DOMAIN, f"{self.operator}_{self.tariff}")},
            "name": f"Pstryk {self.operator.upper()} {self.tariff.upper()}",
            "manufacturer": "Pstryk Fixing",
            "model": "Godzinowy fixing (RDN)",
            "sw_version": self.integration_version,
            "configuration_url": DEFAULT_BASE_URL,
        }

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

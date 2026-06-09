"""Data update coordinator polling the Pstryk Fixing outlook endpoint."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .api import PstrykApiClient, PstrykApiError
from .const import CONF_INCLUDE_SELL, CONF_OPERATOR, CONF_TARIFF, DOMAIN, UPDATE_INTERVAL

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

    def current_hour(self) -> dict[str, Any] | None:
        """Return the hour row covering 'now', matched by its absolute startsAt."""
        today = (self.data or {}).get("today") or {}
        hours = today.get("hours")
        if not isinstance(hours, list):
            return None

        now = dt_util.utcnow()
        for row in hours:
            if not isinstance(row, dict):
                continue
            start = self._parse(row.get("startsAt"))
            if start is not None and start <= now < start + timedelta(hours=1):
                return row
        return None

    @staticmethod
    def _parse(value: Any) -> datetime | None:
        if not isinstance(value, str):
            return None
        parsed = dt_util.parse_datetime(value)
        return None if parsed is None else dt_util.as_utc(parsed)

"""The Pstryk Fixing integration."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.typing import ConfigType

from .api import PstrykApiClient
from .const import DEFAULT_BASE_URL
from .coordinator import PstrykOutlookCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR, Platform.BINARY_SENSOR]

type PstrykConfigEntry = ConfigEntry[PstrykOutlookCoordinator]

# The bundled Lovelace card is served by the integration itself and registered as
# a frontend module, so installing the integration (manually or via HACS) makes
# custom:pstryk-fixing-card available without a manual resource step.
CARD_URL = "/pstryk_fixing/pstryk-fixing-card.js"
CARD_PATH = Path(__file__).parent / "frontend" / "pstryk-fixing-card.js"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve and register the bundled Lovelace card once, app-wide."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_PATH), False)]
    )
    frontend.add_extra_js_url(hass, CARD_URL)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: PstrykConfigEntry) -> bool:
    """Set up Pstryk Fixing from a config entry."""
    session = async_get_clientsession(hass)
    client = PstrykApiClient(DEFAULT_BASE_URL, session)
    coordinator = PstrykOutlookCoordinator(hass, entry, client)
    await coordinator.async_config_entry_first_refresh()

    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: PstrykConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

"""The Pstryk Fixing integration."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import PstrykApiClient
from .const import DEFAULT_BASE_URL
from .coordinator import PstrykOutlookCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR, Platform.BINARY_SENSOR]

type PstrykConfigEntry = ConfigEntry[PstrykOutlookCoordinator]


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

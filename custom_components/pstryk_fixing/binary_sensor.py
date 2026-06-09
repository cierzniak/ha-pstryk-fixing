"""Binary sensor exposing the 'sell now' advice for the current hour."""

from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import PstrykConfigEntry
from .const import DOMAIN
from .coordinator import PstrykOutlookCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: PstrykConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the 'sell now' binary sensor when sell data is enabled."""
    coordinator = entry.runtime_data
    if coordinator.include_sell:
        async_add_entities([PstrykSellNowBinarySensor(coordinator)])


class PstrykSellNowBinarySensor(
    CoordinatorEntity[PstrykOutlookCoordinator], BinarySensorEntity
):
    _attr_has_entity_name = True
    _attr_translation_key = "sell_now"
    _attr_icon = "mdi:battery-arrow-up"

    def __init__(self, coordinator: PstrykOutlookCoordinator) -> None:
        super().__init__(coordinator)
        device = f"{coordinator.operator}_{coordinator.tariff}"
        self._attr_unique_id = f"{device}_sell_now"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, device)},
            "name": f"Pstryk {coordinator.operator.upper()} {coordinator.tariff.upper()}",
            "manufacturer": "Pstryk Fixing",
            "entry_type": "service",
        }

    @property
    def is_on(self) -> bool | None:
        row = self.coordinator.current_hour()
        return None if row is None else bool(row.get("sell"))

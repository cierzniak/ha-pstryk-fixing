"""Sensor entities for the Pstryk Fixing integration."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import PstrykConfigEntry
from .const import ADVICE_OPTIONS, DOMAIN
from .coordinator import PstrykOutlookCoordinator

UNIT_PLN_KWH = "PLN/kWh"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: PstrykConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Pstryk Fixing sensors."""
    coordinator = entry.runtime_data
    entities: list[SensorEntity] = [
        PstrykCurrentPriceSensor(coordinator),
        PstrykCurrentAdviceSensor(coordinator),
    ]
    if coordinator.include_sell:
        entities.append(PstrykCurrentSellPriceSensor(coordinator))
    async_add_entities(entities)


class _PstrykSensorBase(CoordinatorEntity[PstrykOutlookCoordinator], SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator: PstrykOutlookCoordinator, key: str) -> None:
        super().__init__(coordinator)
        device = f"{coordinator.operator}_{coordinator.tariff}"
        self._attr_unique_id = f"{device}_{key}"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, device)},
            "name": f"Pstryk {coordinator.operator.upper()} {coordinator.tariff.upper()}",
            "manufacturer": "Pstryk Fixing",
            "entry_type": "service",
        }


class PstrykCurrentPriceSensor(_PstrykSensorBase):
    _attr_translation_key = "current_price"
    _attr_native_unit_of_measurement = UNIT_PLN_KWH
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 4

    def __init__(self, coordinator: PstrykOutlookCoordinator) -> None:
        super().__init__(coordinator, "current_price")

    @property
    def native_value(self) -> float | None:
        row = self.coordinator.current_hour()
        return None if row is None else row.get("buyGrossPlnPerKwh")

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        data = self.coordinator.data or {}
        today = data.get("today") or {}
        tomorrow = data.get("tomorrow")
        return {
            "operator": data.get("operator"),
            "tariff": data.get("tariff"),
            "thresholds": data.get("thresholds"),
            "today": today.get("hours"),
            "today_summary": today.get("summary"),
            "tomorrow": tomorrow.get("hours") if isinstance(tomorrow, dict) else None,
        }


class PstrykCurrentAdviceSensor(_PstrykSensorBase):
    _attr_translation_key = "current_advice"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = ADVICE_OPTIONS

    def __init__(self, coordinator: PstrykOutlookCoordinator) -> None:
        super().__init__(coordinator, "current_advice")

    @property
    def native_value(self) -> str | None:
        row = self.coordinator.current_hour()
        return None if row is None else row.get("consumption")


class PstrykCurrentSellPriceSensor(_PstrykSensorBase):
    _attr_translation_key = "current_sell_price"
    _attr_native_unit_of_measurement = UNIT_PLN_KWH
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 4

    def __init__(self, coordinator: PstrykOutlookCoordinator) -> None:
        super().__init__(coordinator, "current_sell_price")

    @property
    def native_value(self) -> float | None:
        row = self.coordinator.current_hour()
        return None if row is None else row.get("sellGrossPlnPerKwh")

"""Sensor entities for the Pstryk Fixing integration."""

from __future__ import annotations

from datetime import datetime
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
from .outlook import parse_iso

UNIT_PLN_KWH = "PLN/kWh"


def _parse_dt(value: Any) -> datetime | None:
    """Parse an ISO 8601 startsAt into a timezone-aware datetime, or None."""
    return parse_iso(value)


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
        PstrykNextCheapHourSensor(coordinator),
        PstrykCheapestHourTodaySensor(coordinator),
    ]
    if coordinator.include_sell:
        entities.append(PstrykCurrentSellPriceSensor(coordinator))
        entities.append(PstrykNextSellHourSensor(coordinator))
    async_add_entities(entities)


class _PstrykSensorBase(CoordinatorEntity[PstrykOutlookCoordinator], SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator: PstrykOutlookCoordinator, key: str) -> None:
        super().__init__(coordinator)
        device = f"{coordinator.operator}_{coordinator.tariff}"
        name = f"Pstryk {coordinator.operator.upper()} {coordinator.tariff.upper()}"
        self._attr_unique_id = f"{device}_{key}"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, device)},
            "name": name,
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
            "now": data.get("now"),
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

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        summary = self.coordinator.today_summary()
        return {
            "use_hours": summary.get("useHours"),
            "neutral_hours": summary.get("neutralHours"),
            "limit_hours": summary.get("limitHours"),
            "sell_hours": summary.get("sellHours"),
        }


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


class PstrykNextCheapHourSensor(_PstrykSensorBase):
    """Next upcoming 'use' hour (starting after now) - an automation trigger."""

    _attr_translation_key = "next_cheap_hour"
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:flash-outline"

    def __init__(self, coordinator: PstrykOutlookCoordinator) -> None:
        super().__init__(coordinator, "next_cheap_hour")

    def _ref(self) -> dict[str, Any] | None:
        ref = self.coordinator.now_block().get("nextCheapHour")
        return ref if isinstance(ref, dict) else None

    @property
    def native_value(self) -> datetime | None:
        ref = self._ref()
        return None if ref is None else _parse_dt(ref.get("startsAt"))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        ref = self._ref() or {}
        return {
            "hour": ref.get("hour"),
            "buy_gross_pln_per_kwh": ref.get("buyGrossPlnPerKwh"),
        }


class PstrykNextSellHourSensor(_PstrykSensorBase):
    """Next upcoming hour (starting after now) worth selling/discharging into."""

    _attr_translation_key = "next_sell_hour"
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:battery-arrow-up-outline"

    def __init__(self, coordinator: PstrykOutlookCoordinator) -> None:
        super().__init__(coordinator, "next_sell_hour")

    def _ref(self) -> dict[str, Any] | None:
        ref = self.coordinator.now_block().get("nextSellHour")
        return ref if isinstance(ref, dict) else None

    @property
    def native_value(self) -> datetime | None:
        ref = self._ref()
        return None if ref is None else _parse_dt(ref.get("startsAt"))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        ref = self._ref() or {}
        return {
            "hour": ref.get("hour"),
            "sell_gross_pln_per_kwh": ref.get("sellGrossPlnPerKwh"),
        }


class PstrykCheapestHourTodaySensor(_PstrykSensorBase):
    """Start of today's cheapest hour - schedule deferrable loads against it."""

    _attr_translation_key = "cheapest_hour_today"
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:cash-clock"

    def __init__(self, coordinator: PstrykOutlookCoordinator) -> None:
        super().__init__(coordinator, "cheapest_hour_today")

    def _ref(self) -> dict[str, Any] | None:
        ref = self.coordinator.today_summary().get("cheapestHour")
        return ref if isinstance(ref, dict) else None

    @property
    def native_value(self) -> datetime | None:
        ref = self._ref()
        return None if ref is None else _parse_dt(ref.get("startsAt"))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        ref = self._ref() or {}
        return {
            "hour": ref.get("hour"),
            "buy_gross_pln_per_kwh": ref.get("buyGrossPlnPerKwh"),
        }

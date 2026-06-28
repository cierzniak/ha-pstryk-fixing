"""Per-subentry runtime that turns outlook prices + load params into a plan.

One LoadScheduler exists per ``load`` config subentry. It holds the load's live
parameters (set by the input entities), recomputes the run plan on three events
(hour boundary, price refresh, parameter change), and notifies the output
entities through a dispatcher signal. All scheduling maths is delegated to the
pure ``scheduler`` module.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from .const import DEFAULT_DURATION, DEFAULT_MODE, SIGNAL_LOAD
from .coordinator import PstrykOutlookCoordinator
from .scheduler import ScheduleResult, merge_hours, plan_run


class LoadScheduler:
    """Holds one load's parameters and recomputes its run plan."""

    def __init__(
        self,
        hass: HomeAssistant,
        coordinator: PstrykOutlookCoordinator,
        subentry_id: str,
        data: dict[str, Any],
    ) -> None:
        self.hass = hass
        self.coordinator = coordinator
        self.subentry_id = subentry_id
        self.signal = f"{SIGNAL_LOAD}_{subentry_id}"
        self.enabled: bool = True
        self.mode: str = data.get("mode", DEFAULT_MODE)
        self.ready_by: time | None = None
        self.start_at: time | None = None
        self.stop_at: time | None = None
        self.duration_h: int = DEFAULT_DURATION
        self.price_ceiling: float | None = None
        self.result: ScheduleResult = ScheduleResult()

    def async_start(self) -> Callable[[], None]:
        """Subscribe to price refreshes and the hour boundary; return an unsub."""
        unsub_coord = self.coordinator.async_add_listener(self.recompute)
        unsub_tick = async_track_time_change(self.hass, self._tick, minute=0, second=10)
        self.recompute()

        def _unsub() -> None:
            unsub_coord()
            unsub_tick()

        return _unsub

    def _tick(self, _now: Any) -> None:
        self.recompute()

    def set_param(self, name: str, value: Any) -> None:
        """Set a parameter from an input entity and recompute."""
        setattr(self, name, value)
        self.recompute()

    def recompute(self) -> None:
        """Recompute the plan and notify the load's entities."""
        if not self.enabled:
            self.result = ScheduleResult()
        else:
            self.result = plan_run(
                mode=self.mode,
                now=dt_util.now(),
                hours=merge_hours(self.coordinator.data),
                ready_by=self.ready_by,
                start_at=self.start_at,
                stop_at=self.stop_at,
                duration_h=self.duration_h,
                price_ceiling=self.price_ceiling,
            )
        async_dispatcher_send(self.hass, self.signal)

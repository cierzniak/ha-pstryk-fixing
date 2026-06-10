"""Pure helpers for reading the Pstryk outlook payload.

Deliberately free of any Home Assistant import so the parsing/selection logic
can be unit-tested without spinning up a hass instance - the HA-coupled glue
(coordinator, entities) delegates here.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any


def parse_iso(value: Any) -> datetime | None:
    """Parse an ISO 8601 ``startsAt`` into a timezone-aware datetime, or None."""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def extract_now_block(data: dict[str, Any] | None) -> dict[str, Any]:
    """Return the server-computed forward-looking ``now`` block (may be empty)."""
    block = (data or {}).get("now")
    return block if isinstance(block, dict) else {}


def extract_today_summary(data: dict[str, Any] | None) -> dict[str, Any]:
    """Return today's aggregate summary (cheapest/dearest hour, counts)."""
    today = (data or {}).get("today") or {}
    summary = today.get("summary")
    return summary if isinstance(summary, dict) else {}


def resolve_current_hour(
    data: dict[str, Any] | None, now: datetime
) -> dict[str, Any] | None:
    """Return the hour row covering ``now``.

    Prefer the server-computed ``now.hour`` (single source of truth); fall back
    to a client-side scan so the integration still works against an older API
    build that predates the ``now`` block.
    """
    server = extract_now_block(data).get("hour")
    if isinstance(server, dict):
        return server

    today = (data or {}).get("today") or {}
    hours = today.get("hours")
    if not isinstance(hours, list):
        return None

    for row in hours:
        if not isinstance(row, dict):
            continue
        start = parse_iso(row.get("startsAt"))
        if start is not None and start <= now < start + timedelta(hours=1):
            return row
    return None

"""Unit tests for the dependency-free outlook helpers."""

from datetime import UTC, datetime

from outlook import (
    extract_now_block,
    extract_today_summary,
    parse_iso,
    resolve_current_hour,
)


def _hour(hour: int, advice: str = "use") -> dict:
    return {
        "hour": hour,
        "startsAt": f"2026-06-10T{hour:02d}:00:00+02:00",
        "buyGrossPlnPerKwh": round(0.1 * hour, 4),
        "consumption": advice,
        "sell": False,
    }


def test_parse_iso_keeps_offset() -> None:
    parsed = parse_iso("2026-06-10T14:00:00+02:00")
    assert parsed is not None
    assert parsed.utcoffset() is not None
    assert parsed.utcoffset().total_seconds() == 7200


def test_parse_iso_assumes_utc_when_naive() -> None:
    parsed = parse_iso("2026-06-10T14:00:00")
    assert parsed is not None
    assert parsed.tzinfo is UTC


def test_parse_iso_rejects_garbage() -> None:
    assert parse_iso("not-a-date") is None
    assert parse_iso(None) is None
    assert parse_iso(123) is None


def test_extract_now_block_defaults() -> None:
    assert extract_now_block(None) == {}
    assert extract_now_block({"now": "oops"}) == {}
    assert extract_now_block({"now": {"hour": {}}}) == {"hour": {}}


def test_extract_today_summary_defaults() -> None:
    assert extract_today_summary(None) == {}
    assert extract_today_summary({"today": {}}) == {}
    assert extract_today_summary({"today": {"summary": {"useHours": 5}}}) == {
        "useHours": 5
    }


def test_resolve_current_hour_prefers_server_now() -> None:
    data = {
        "now": {"hour": {"hour": 14, "marker": "server"}},
        "today": {"hours": [_hour(0)]},
    }
    now = datetime(2026, 6, 10, 23, tzinfo=UTC)
    assert resolve_current_hour(data, now) == {"hour": 14, "marker": "server"}


def test_resolve_current_hour_falls_back_to_client_scan() -> None:
    data = {"today": {"hours": [_hour(11), _hour(12), _hour(13)]}}
    # 12:00+02:00 starts at 10:00 UTC; 10:30 UTC lands inside hour 12.
    now = datetime(2026, 6, 10, 10, 30, tzinfo=UTC)
    row = resolve_current_hour(data, now)
    assert row is not None
    assert row["hour"] == 12


def test_resolve_current_hour_returns_none_without_match() -> None:
    now = datetime(2026, 6, 10, 23, tzinfo=UTC)
    assert resolve_current_hour({"today": {"hours": [_hour(0)]}}, now) is None
    assert resolve_current_hour(None, now) is None
    assert resolve_current_hour({"today": {}}, now) is None

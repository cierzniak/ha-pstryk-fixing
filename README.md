# Pstryk Fixing - Home Assistant

Home Assistant integration **and** a Lovelace card for the
[Pstryk Fixing](https://pstryk.gdansk.best) hourly electricity prices, exposing a
ready-to-automate **use / limit / sell** recommendation per hour.

It consumes the public Pstryk Fixing API (`GET /api/v1/outlook/{operator}/{tariff}`)
and turns it into sensors you can drive automations from - when to run appliances
or charge a battery (cheap hours), when to hold back (expensive hours), and when to
discharge / sell back (high buy-back price).

> Status: `0.1.0`, early release. Verified against a live Home Assistant instance
> (the integration sets up and its entities populate from the API). Review before
> relying on it for critical automations. Requires a Pstryk Fixing API that exposes
> `GET /api/v1/outlook` (live on `pstryk.gdansk.best`).

## Requirements

- Home Assistant `2024.8` or newer.
- Network access to `https://pstryk.gdansk.best` (the public API; no account, no key).

## Installation (HACS)

1. HACS -> Integrations -> ⋮ -> **Custom repositories**.
2. Add `https://github.com/cierzniak/ha-pstryk-fixing` with category **Integration**.
3. Install **Pstryk Fixing**, then restart Home Assistant.

The Lovelace card (`custom:pstryk-fixing-card`) is bundled **inside** the integration
and registered automatically on startup - one repo, no separate HACS plugin, no manual
Lovelace resource step.

## Installation (manual)

1. Copy `custom_components/pstryk_fixing/` into your HA `config/custom_components/`
   (the Lovelace card travels inside it).
2. Restart Home Assistant.

## Configuration

Settings -> Devices & Services -> **Add Integration** -> *Pstryk Fixing*:

1. Pick your **distribution operator** (fetched from the API).
2. Pick your **tariff** and whether to fetch **sell (buy-back) prices**.

The API host is fixed (`pstryk.gdansk.best`) - there is nothing else to configure.
Add the integration multiple times for several operator/tariff combinations.

## Entities

Per configured operator/tariff (a device named `Pstryk <OPERATOR> <TARIFF>`):

| Entity | Description |
|---|---|
| `sensor...._current_price` | Current hour gross **buy** price (PLN/kWh). Carries `now`, `today` / `tomorrow` hour arrays, `thresholds` and `today_summary` as attributes. |
| `sensor...._advice` | Current hour consumption recommendation - `use` / `neutral` / `limit` (enum). Attributes carry the day's `use` / `neutral` / `limit` / `sell` hour counts. |
| `sensor...._next_cheap_hour` | Timestamp of the next upcoming `use` hour (starts after now) - a ready automation trigger. Attributes: `hour`, `buy_gross_pln_per_kwh`. |
| `sensor...._cheapest_hour_today` | Timestamp of today's cheapest hour, for scheduling deferrable loads. |
| `sensor...._current_sell_price` | Current hour gross **sell** price (only when sell mode is on). |
| `sensor...._next_sell_hour` | Timestamp of the next upcoming hour worth selling/discharging into (only when sell mode is on). |
| `binary_sensor...._sell_now` | `on` when the current hour is worth discharging / selling (only when sell mode is on). |

## Lovelace card

The card is registered by the integration, so once installed just add it to a
dashboard (no resource setup):

```yaml
type: custom:pstryk-fixing-card
entity: sensor.pstryk_energa_g11f_current_price
title: Pstryk - wskazówki na dziś
```

Renders the 24 hours coloured by advice (use / neutral / limit), a sell badge, and a
highlight on the current hour, plus a header summarising now / next cheap / next sell.
It reads the `today`, `now` and `today_summary` attributes of the price sensor and
tracks the active Home Assistant light/dark theme.

## Automation examples

Run a socket during cheap hours:

```yaml
automation:
  - alias: Boiler on when energy is cheap
    trigger:
      - platform: state
        entity_id: sensor.pstryk_energa_g11f_advice
        to: "use"
    action:
      - action: switch.turn_on
        target: { entity_id: switch.boiler }
```

Discharge / sell from a battery when buy-back is high:

```yaml
automation:
  - alias: Battery discharge when selling pays
    trigger:
      - platform: state
        entity_id: binary_sensor.pstryk_energa_g11f_sell_now
        to: "on"
    action:
      - action: select.select_option
        target: { entity_id: select.battery_mode }
        data: { option: "Export" }
```

## How it fits together

This is cycle 2 of the Pstryk Fixing Home Assistant support. Cycle 1 (the backend)
computes the per-hour advice server-side and exposes it via `/api/v1/outlook`; this
repo is a thin consumer. The classification thresholds are tuned centrally in the
Pstryk admin panel, so every consumer (web + HA) stays in sync.

## License

MIT - see [LICENSE](LICENSE).

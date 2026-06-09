# Pstryk Fixing - Home Assistant

Home Assistant integration **and** a Lovelace card for the
[Pstryk Fixing](https://pstryk.gdansk.best) hourly electricity prices, exposing a
ready-to-automate **use / limit / sell** recommendation per hour.

It consumes the public Pstryk Fixing API (`GET /api/v1/outlook/{operator}/{tariff}`)
and turns it into sensors you can drive automations from - when to run appliances
or charge a battery (cheap hours), when to hold back (expensive hours), and when to
discharge / sell back (high buy-back price).

> Status: `0.1.0`, scaffold. The code follows current HA conventions but has **not
> yet been exercised against a live Home Assistant** - install on your instance and
> verify before relying on it for automations.

## Requirements

- Home Assistant `2024.8` or newer.
- Network access to `https://pstryk.gdansk.best` (the public API; no account, no key).

## Installation (manual)

1. Copy `custom_components/pstryk_fixing/` into your HA `config/custom_components/`.
2. Copy `www/pstryk-fixing-card.js` into your HA `config/www/`.
3. Register the card as a Lovelace resource (Settings -> Dashboards -> ⋮ -> Resources):
   - URL `/local/pstryk-fixing-card.js`, type **JavaScript Module**.
4. Restart Home Assistant.

(For HACS distribution the integration and the card would live in two separate
repositories - one per HACS category. This single repo is convenient for a manual /
personal install.)

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
| `sensor...._current_price` | Current hour gross **buy** price (PLN/kWh). Carries `today` / `tomorrow` hour arrays, `thresholds` and `today_summary` as attributes. |
| `sensor...._advice` | Current hour consumption recommendation - `use` / `neutral` / `limit` (enum). |
| `sensor...._current_sell_price` | Current hour gross **sell** price (only when sell mode is on). |
| `binary_sensor...._sell_now` | `on` when the current hour is worth discharging / selling (only when sell mode is on). |

## Lovelace card

```yaml
type: custom:pstryk-fixing-card
entity: sensor.pstryk_energa_g11f_current_price
title: Pstryk - wskazówki na dziś
```

Renders the 24 hours coloured by advice (use / neutral / limit), a sell badge, and a
highlight on the current hour. It reads the `today` attribute of the price sensor.

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

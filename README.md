# Pstryk Fixing - Home Assistant

Integracja Home Assistant **wraz z** kartą Lovelace dla godzinowych cen prądu
[Pstryk Fixing](https://pstryk.gdansk.best). Wystawia gotową pod automatyzacje
rekomendację na każdą godzinę: **używaj / ogranicz / sprzedaj**.

Korzysta z publicznego API Pstryk Fixing (`GET /api/v1/outlook/{operator}/{tariff}`)
i zamienia je na sensory, na których oprzesz automatyzacje - kiedy włączyć urządzenia
albo ładować magazyn (tanie godziny), kiedy ograniczyć pobór (drogie godziny), a kiedy
rozładować / sprzedać do sieci (wysoka cena odkupu).

> Status: `0.1.0`, wczesne wydanie. Zweryfikowane na żywej instancji Home Assistant
> (integracja się konfiguruje, encje wypełniają się z API). Przejrzyj zanim oprzesz
> na tym krytyczne automatyzacje. Wymaga API Pstryk Fixing z endpointem
> `GET /api/v1/outlook` (działa na `pstryk.gdansk.best`).

## Wymagania

- Home Assistant `2024.8` lub nowszy.
- Dostęp sieciowy do `https://pstryk.gdansk.best` (publiczne API; bez konta, bez klucza).

## Instalacja (HACS)

1. HACS -> Integracje -> ⋮ -> **Własne repozytoria** (Custom repositories).
2. Dodaj `https://github.com/cierzniak/ha-pstryk-fixing` z kategorią **Integration**.
3. Zainstaluj **Pstryk Fixing**, potem zrestartuj Home Assistant.

Karta Lovelace (`custom:pstryk-fixing-card`) jest spakowana **wewnątrz** integracji i
rejestruje się automatycznie przy starcie - jedno repo, bez osobnego pluginu HACS, bez
ręcznego dodawania zasobu (resource) Lovelace.

## Instalacja (ręczna)

1. Skopiuj `custom_components/pstryk_fixing/` do `config/custom_components/` w swoim HA
   (karta Lovelace jedzie razem w środku).
2. Zrestartuj Home Assistant.

## Konfiguracja

Ustawienia -> Urządzenia i usługi -> **Dodaj integrację** -> *Pstryk Fixing*:

1. Wybierz swojego **operatora dystrybucji** (pobierany z API).
2. Wybierz **taryfę** oraz czy pobierać **ceny sprzedaży (odkupu)**.

Adres API jest stały (`pstryk.gdansk.best`) - nie ma nic więcej do ustawiania. Możesz
dodać integrację wiele razy, dla kilku kombinacji operator/taryfa.

## Encje

Na każdą skonfigurowaną parę operator/taryfa (urządzenie `Pstryk <OPERATOR> <TARYFA>`):

| Encja | Opis |
|---|---|
| `sensor...._current_price` | Cena **kupna** brutto bieżącej godziny (PLN/kWh). W atrybutach niesie `now`, tablice godzin `today` / `tomorrow`, `thresholds` oraz `today_summary`. |
| `sensor...._advice` | Rekomendacja zużycia na bieżącą godzinę - `use` / `neutral` / `limit` (enum). W atrybutach liczniki godzin dnia: `use` / `neutral` / `limit` / `sell`. |
| `sensor...._next_cheap_hour` | Znacznik czasu najbliższej nadchodzącej godziny `use` (zaczynającej się po teraz) - gotowy wyzwalacz automatyzacji. Atrybuty: `hour`, `buy_gross_pln_per_kwh`. |
| `sensor...._cheapest_hour_today` | Znacznik czasu najtańszej godziny dziś - do planowania odraczalnych odbiorników. |
| `sensor...._current_sell_price` | Cena **sprzedaży** brutto bieżącej godziny (tylko gdy tryb sprzedaży włączony). |
| `sensor...._next_sell_hour` | Znacznik czasu najbliższej nadchodzącej godziny wartej sprzedaży/rozładowania (tylko gdy tryb sprzedaży włączony). |
| `binary_sensor...._sell_now` | `on`, gdy bieżąca godzina jest warta rozładowania / sprzedaży (tylko gdy tryb sprzedaży włączony). |

## Karta Lovelace

Karta jest rejestrowana przez integrację, więc po instalacji wystarczy dodać ją na
dashboard (bez konfiguracji zasobu):

```yaml
type: custom:pstryk-fixing-card
entity: sensor.pstryk_energa_g11f_current_price
title: Pstryk - wskazówki na dziś
```

Rysuje 24 godziny pokolorowane wg rekomendacji (używaj / neutralnie / ogranicz), badge
sprzedaży i wyróżnienie bieżącej godziny, plus nagłówek z podsumowaniem: teraz / następna
tania / następna sprzedaż. Czyta atrybuty `today`, `now` i `today_summary` sensora ceny
i podąża za aktywnym motywem Home Assistant (jasny/ciemny).

## Przykłady automatyzacji

Włącz gniazdko w tanich godzinach:

```yaml
automation:
  - alias: Bojler gdy prąd tani
    trigger:
      - platform: state
        entity_id: sensor.pstryk_energa_g11f_advice
        to: "use"
    action:
      - action: switch.turn_on
        target: { entity_id: switch.boiler }
```

Rozładuj / sprzedaj z magazynu, gdy odkup się opłaca:

```yaml
automation:
  - alias: Rozładowanie magazynu gdy sprzedaż się opłaca
    trigger:
      - platform: state
        entity_id: binary_sensor.pstryk_energa_g11f_sell_now
        to: "on"
    action:
      - action: select.select_option
        target: { entity_id: select.battery_mode }
        data: { option: "Export" }
```

## Jak to się składa w całość

To cykl 2 wsparcia Pstryk Fixing dla Home Assistant. Cykl 1 (backend) liczy
rekomendację per godzina po stronie serwera i wystawia ją przez `/api/v1/outlook`;
to repo jest cienkim konsumentem. Progi klasyfikacji stroi się centralnie w panelu
admina Pstryk, więc każdy konsument (web + HA) trzyma się tych samych wartości.

## Licencja

MIT - zobacz [LICENSE](LICENSE).

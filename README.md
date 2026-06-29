# Pstryk Fixing - Home Assistant

Integracja Home Assistant **wraz z** kartą Lovelace dla godzinowych cen prądu
[Pstryk Fixing](https://pstryk.gdansk.best). Wystawia gotową pod automatyzacje
rekomendację na każdą godzinę: **używaj / ogranicz / sprzedaj**, a od `0.2.0` także
**harmonogramy odbiorników** (EV, bojler, ...), które same wybierają najtańsze godziny.

Korzysta z publicznego API Pstryk Fixing (`GET /api/v1/outlook/{operator}/{tariff}`)
i zamienia je na sensory, na których oprzesz automatyzacje - kiedy włączyć urządzenia
albo ładować magazyn (tanie godziny), kiedy ograniczyć pobór (drogie godziny), a kiedy
rozładować / sprzedać do sieci (wysoka cena odkupu).

> Status: `0.2.0`, wczesne wydanie. Zweryfikowane na żywej instancji Home Assistant
> (integracja się konfiguruje, encje wypełniają się z API). Przejrzyj zanim oprzesz
> na tym krytyczne automatyzacje. Wymaga API Pstryk Fixing z endpointem
> `GET /api/v1/outlook` (działa na `pstryk.gdansk.best`).

## Wymagania

- Home Assistant `2024.8` lub nowszy.
- Dostęp sieciowy do `https://pstryk.gdansk.best` (publiczne API; bez konta, bez klucza).

## Instalacja (HACS)

[![Otwórz swoją instancję Home Assistant i dodaj to repozytorium do HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=cierzniak&repository=ha-pstryk-fixing&category=integration)

Kliknij badge powyżej, żeby dodać repozytorium do HACS jednym kliknięciem, albo ręcznie:

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
| `sensor.*_current_price` | Cena **kupna** brutto bieżącej godziny (PLN/kWh). W atrybutach niesie `now`, tablice godzin `today` / `tomorrow`, `thresholds` oraz `today_summary`. |
| `sensor.*_advice` | Rekomendacja zużycia na bieżącą godzinę - `use` / `neutral` / `limit` (enum). W atrybutach liczniki godzin dnia: `use` / `neutral` / `limit` / `sell`. |
| `sensor.*_next_cheap_hour` | Znacznik czasu najbliższej nadchodzącej godziny `use` (zaczynającej się po teraz) - gotowy wyzwalacz automatyzacji. Atrybuty: `hour`, `buy_gross_pln_per_kwh`. |
| `sensor.*_cheapest_hour_today` | Znacznik czasu najtańszej godziny dziś - do planowania odraczalnych odbiorników. |
| `sensor.*_current_sell_price` | Cena **sprzedaży** brutto bieżącej godziny (tylko gdy tryb sprzedaży włączony). |
| `sensor.*_next_sell_hour` | Znacznik czasu najbliższej nadchodzącej godziny wartej sprzedaży/rozładowania (tylko gdy tryb sprzedaży włączony). |
| `binary_sensor.*_sell_now` | `on`, gdy bieżąca godzina jest warta rozładowania / sprzedaży (tylko gdy tryb sprzedaży włączony). |

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

Jeśli zaraz po instalacji widzisz `Custom element doesn't exist: pstryk-fixing-card`,
zrestartuj Home Assistant, a następnie odśwież frontend (twardy reload, a w razie potrzeby
wyczyść dane strony / Service Worker w przeglądarce lub cache aplikacji mobilnej) -- to
jednorazowy efekt cache PWA, nie błąd integracji.

## Harmonogram odbiorników (EV, bojler, ...)

Poza sensorami informacyjnymi możesz dodać **harmonogramy odbiorników** - sterowalnych
urządzeń (ładowarka EV, bojler, pralka), które mają ruszać w dobrych (tanich) godzinach.
Każdy odbiornik to **podwpis (subentry)** na wpisie taryfy:

Ustawienia -> Urządzenia i usługi -> wpis `Pstryk <OPERATOR> <TARYFA>` ->
**Dodaj odbiornik** -> podaj nazwę i tryb.

Integracja zostaje cienka: nie steruje urządzeniem bezpośrednio, tylko wystawia sygnał
`uruchom teraz` (binary_sensor) oraz `zaplanowany start` (znacznik czasu). Faktycznym
włączeniem urządzenia zajmuje się Twoja automatyzacja (jest gotowy blueprint, niżej).

> Podwpisy (subentries) wymagają **Home Assistant 2025.3** lub nowszego.

### Tryby

| Tryb | Co robi | Parametry |
|---|---|---|
| `cheapest_window` (Najtańsze okno) | Wybiera N najtańszych godzin w oknie do "gotowe do" | `Gotowe do`, `Czas pracy`, opcjonalnie `Stop` |
| `fixed` (Sztywny start) | Blok pracy od "start o" (do "stop o", jeśli ustawione - inaczej jedna godzina) | `Start o`, opcjonalnie `Stop o` |
| `price_below` (Poniżej progu ceny) | Każda nadchodząca godzina z ceną kupna `<=` próg | `Próg ceny`, opcjonalnie `Stop` |
| `advice_use` (Godziny zalecane) | Godziny z serwerową rekomendacją `use` | opcjonalnie `Stop` |

Czasy liczone są w lokalnej strefie Home Assistant. `Stop` wcześniejszy niż `Start`
oznacza okno przez północ (np. `22:00 -> 06:00`). Plan na noc zależy od cen jutra
(publikowane wczesnym popołudniem) - wcześniej bywa prowizoryczny.

### Encje odbiornika

Każdy odbiornik to osobne urządzenie. Nazwy encji pochodzą od nazwy odbiornika
(np. `Ładowarka` -> `..._ladowarka_...`):

| Encja | Rola |
|---|---|
| `switch.<odbiornik>_harmonogram` | Włącz/wyłącz harmonogram |
| `select.<odbiornik>_tryb` | Tryb (jeden z czterech powyżej) |
| `time.<odbiornik>_gotowe_do` | Deadline "gotowe do" (tryb okna) |
| `time.<odbiornik>_start_o` | Sztywny start (tryb fixed) |
| `time.<odbiornik>_stop_o` | Twardy stop (opcjonalny, działa we wszystkich trybach) |
| `number.<odbiornik>_czas_pracy_godziny` | Ile godzin pracy (tryb okna) |
| `number.<odbiornik>_prog_ceny` | Próg PLN/kWh (tryb progu) |
| `binary_sensor.<odbiornik>_uruchom_teraz` | **Sygnał startu** - tu wpinasz automatyzację |
| `sensor.<odbiornik>_zaplanowany_start` | Najbliższy zaplanowany start. Atrybuty: `selected_hours`, `selected_count`, `total_price`, `avg_price`, `mode`, `enabled` |

### Karta harmonogramu

```yaml
type: custom:pstryk-fixing-scheduler-card
entity: sensor.ladowarka_zaplanowany_start
```

`entity` to **dowolna encja odbiornika** - karta sama wykryje urządzenie, dociągnie resztę
kontrolek oraz sensor cen rodzica do siatki godzin (zamiast `entity` możesz podać `device`
z ID urządzenia odbiornika). Karta pokazuje siatkę godzin z podświetlonymi wybranymi
godzinami, przełącznik trybu, kontrolki zależne od trybu, włącznik harmonogramu i
podsumowanie planu. Jedzie w tym samym pliku co `pstryk-fixing-card`, więc nie wymaga
dodatkowego zasobu Lovelace.

### Wpięcie urządzenia (blueprint)

Sygnał `uruchom teraz` wepnij w urządzenie - najprościej gotowym blueprintem
`blueprints/automation/pstryk_fixing/run_load.yaml` (wskazujesz sensor `uruchom teraz`
oraz akcje startu i stopu). Albo ręcznie:

```yaml
automation:
  - alias: Ładowarka wg planu Pstryk
    trigger:
      - platform: state
        entity_id: binary_sensor.ladowarka_uruchom_teraz
        to: "on"
    action:
      - action: switch.turn_on
        target: { entity_id: switch.wallbox }
  - alias: Ładowarka stop wg planu Pstryk
    trigger:
      - platform: state
        entity_id: binary_sensor.ladowarka_uruchom_teraz
        to: "off"
    action:
      - action: switch.turn_off
        target: { entity_id: switch.wallbox }
```

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

Domknij okno - wyłącz bojler, gdy godzina przestaje być tania:

```yaml
automation:
  - alias: Bojler wyłącz gdy prąd przestaje być tani
    trigger:
      - platform: state
        entity_id: sensor.pstryk_energa_g11f_advice
        from: "use"
    action:
      - action: switch.turn_off
        target: { entity_id: switch.boiler }
```

I zakończ sprzedaż, gdy odkup przestaje się opłacać:

```yaml
automation:
  - alias: Magazyn wróć do trybu auto gdy sprzedaż przestaje się opłacać
    trigger:
      - platform: state
        entity_id: binary_sensor.pstryk_energa_g11f_sell_now
        to: "off"
    action:
      - action: select.select_option
        target: { entity_id: select.battery_mode }
        data: { option: "Auto" }
```

## Jak to się składa w całość

To cykl 2 wsparcia Pstryk Fixing dla Home Assistant. Cykl 1 (backend) liczy
rekomendację per godzina po stronie serwera i wystawia ją przez `/api/v1/outlook`;
to repo jest cienkim konsumentem. Progi klasyfikacji stroi się centralnie w panelu
admina Pstryk, więc każdy konsument (web + HA) trzyma się tych samych wartości.

## Licencja

MIT - zobacz [LICENSE](LICENSE).

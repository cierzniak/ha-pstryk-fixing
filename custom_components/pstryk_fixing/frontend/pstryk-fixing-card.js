/**
 * Pstryk Fixing Lovelace card.
 *
 * A dependency-free custom card that renders the 24-hour usage hints exposed by
 * the Pstryk Fixing integration's "current price" sensor (its `today` attribute:
 * a list of { hour, startsAt, buyGrossPlnPerKwh, sellGrossPlnPerKwh, consumption,
 * sell }). Each hour is coloured by its consumption advice (use / neutral /
 * limit) with a badge for sell hours; the current hour is highlighted.
 *
 * A header summarises the live state from the same sensor's `now` block
 * (current advice, next cheap/sell hour) and `today_summary` (cheap/expensive
 * hour counts), so the card answers "what now / what next" at a glance.
 *
 * Usage (Lovelace YAML):
 *   type: custom:pstryk-fixing-card
 *   entity: sensor.pstryk_energa_g11f_current_price
 *   title: Pstryk - wskazówki na dziś
 */

const CARD_VERSION = "0.2.0";

const LABELS = { use: "Używaj", neutral: "Neutralnie", limit: "Ogranicz" };

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape a value before interpolating it into an HTML string (XSS guard). */
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPE[c]);

class PstrykFixingCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("Podaj 'entity' (sensor 'cena bieżąca' z Pstryk Fixing).");
    }
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig() {
    return { entity: "" };
  }

  _currentIndex(hours) {
    const now = Date.now();
    for (let i = 0; i < hours.length; i++) {
      const start = Date.parse(hours[i].startsAt);
      if (!Number.isNaN(start) && start <= now && now < start + 3600000) {
        return i;
      }
    }
    return -1;
  }

  _fmtHour(ref) {
    const h = ref ? Number.parseInt(ref.hour, 10) : NaN;
    return Number.isFinite(h) ? `${String(h).padStart(2, "0")}:00` : "-";
  }

  _price(value) {
    return Number.isFinite(value) ? Number(value).toFixed(2) : null;
  }

  _stat(cssClass, label, value) {
    return `<div class="pf-stat ${cssClass}">
        <span class="pf-stat-k">${esc(label)}</span>
        <span class="pf-stat-v">${esc(value)}</span>
      </div>`;
  }

  _header(nowBlock, summary, hours, nowIndex) {
    const cur =
      (nowBlock && nowBlock.hour) || (nowIndex >= 0 ? hours[nowIndex] : null);
    const chips = [];

    if (cur) {
      const advice = LABELS[cur.consumption] ? cur.consumption : "neutral";
      const price = this._price(cur.buyGrossPlnPerKwh);
      const value = `${LABELS[advice]}${price ? ` · ${price} zł` : ""}`;
      chips.push(this._stat(`pf-${advice}`, "Teraz", value));
    }

    const nextCheap = nowBlock && nowBlock.nextCheapHour;
    if (nextCheap) {
      const price = this._price(nextCheap.buyGrossPlnPerKwh);
      const value = `${this._fmtHour(nextCheap)}${price ? ` · ${price} zł` : ""}`;
      chips.push(this._stat("pf-use", "Tania od", value));
    }

    const nextSell = nowBlock && nowBlock.nextSellHour;
    if (nextSell) {
      const price = this._price(nextSell.sellGrossPlnPerKwh);
      const value = `${this._fmtHour(nextSell)}${price ? ` · ${price} zł` : ""}`;
      chips.push(this._stat("pf-sellstat", "Sprzedaj od", value));
    }

    let counts = "";
    if (summary) {
      const parts = [];
      const use = Number.parseInt(summary.useHours, 10);
      const limit = Number.parseInt(summary.limitHours, 10);
      if (Number.isFinite(use)) parts.push(`${use} tanich`);
      if (Number.isFinite(limit)) parts.push(`${limit} drogich`);
      if (parts.length) {
        counts = `<div class="pf-counts">${esc(`${parts.join(" · ")} godz. dziś`)}</div>`;
      }
    }

    if (chips.length === 0 && !counts) return "";
    return `<div class="pf-head">${chips.join("")}</div>${counts}`;
  }

  _render() {
    if (!this._hass || !this._config) return;
    const stateObj = this._hass.states[this._config.entity];
    const title = esc(this._config.title || "Pstryk Fixing");

    if (!stateObj) {
      this.innerHTML = `<ha-card header="${title}"><div style="padding:16px">Brak encji <code>${esc(this._config.entity)}</code>.</div></ha-card>`;
      return;
    }

    const hours = Array.isArray(stateObj.attributes.today)
      ? stateObj.attributes.today
      : [];

    if (hours.length === 0) {
      this.innerHTML = `<ha-card header="${title}"><div style="padding:16px">Oczekiwanie na dane fixingu...</div></ha-card>`;
      return;
    }

    const nowIndex = this._currentIndex(hours);
    const nowBlock =
      stateObj.attributes.now && typeof stateObj.attributes.now === "object"
        ? stateObj.attributes.now
        : null;
    const summary =
      stateObj.attributes.today_summary &&
      typeof stateObj.attributes.today_summary === "object"
        ? stateObj.attributes.today_summary
        : null;
    const header = this._header(nowBlock, summary, hours, nowIndex);
    const cells = hours
      .map((h, i) => {
        // Coerce/validate every value before it reaches the HTML string.
        const advice = LABELS[h.consumption] ? h.consumption : "neutral";
        const hour = String(Number.parseInt(h.hour, 10) || 0).padStart(2, "0");
        const price = Number.isFinite(h.buyGrossPlnPerKwh)
          ? Number(h.buyGrossPlnPerKwh).toFixed(2)
          : "";
        const sell = h.sell === true;
        const classes = [
          "pf-cell",
          `pf-${advice}`,
          sell ? "pf-sell" : "",
          i === nowIndex ? "pf-now" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const tip = esc(
          `${hour}:00 - ${LABELS[advice]}${sell ? " · Sprzedaj" : ""}${price ? ` (${price} zł/kWh)` : ""}`,
        );
        return `<div class="${classes}" title="${tip}">
            <span class="pf-hr">${hour}</span>
            <span class="pf-px">${price}</span>
          </div>`;
      })
      .join("");

    this.innerHTML = `
      <ha-card header="${title}">
        <style>
          /* Colours come from Home Assistant theme variables so the card tracks
             the active light/dark theme; the --rgb-* fallbacks keep it readable
             if a theme omits one. Each advice class sets --pf/--pf-rgb, reused
             for the cell tint, hour colour, legend swatch and header chips. */
          /* 4 columns everywhere (6h per column). */
          .pf-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; padding:0 16px 16px; }
          .pf-cell { display:flex; flex-direction:column; align-items:center; border-radius:6px; padding:5px 2px; font-size:.82rem; border:2px solid transparent; background:rgba(var(--pf-rgb, 144,144,144), .15); color:var(--primary-text-color); }
          .pf-hr { font-weight:700; font-size:.92rem; font-variant-numeric:tabular-nums; color:var(--pf, var(--primary-text-color)); }
          .pf-px { font-size:.72rem; font-variant-numeric:tabular-nums; color:var(--secondary-text-color); }
          .pf-use { --pf:var(--success-color, #43a047); --pf-rgb:var(--rgb-success-color, 67,160,71); }
          .pf-neutral { --pf:var(--secondary-text-color, #9e9e9e); --pf-rgb:144,144,144; }
          .pf-limit { --pf:var(--error-color, #e53935); --pf-rgb:var(--rgb-error-color, 229,57,53); }
          .pf-sell { box-shadow:inset 0 -3px 0 var(--info-color, #2196f3); }
          .pf-now { border-color:var(--primary-color, var(--primary-text-color)); }
          .pf-legend { display:flex; flex-wrap:wrap; gap:.7rem; padding:8px 16px 0; font-size:.84rem; color:var(--primary-text-color); }
          .pf-sw { width:.85rem; height:.85rem; border-radius:3px; display:inline-block; vertical-align:middle; margin-right:.25rem; background:var(--pf, #888); }
          .pf-sellsw { background:var(--card-background-color, transparent); box-shadow:inset 0 -3px 0 var(--info-color, #2196f3); }
          .pf-head { display:flex; flex-wrap:wrap; gap:.5rem; padding:8px 16px 0; }
          .pf-stat { display:flex; flex-direction:column; border-radius:8px; padding:6px 10px; min-width:5.5rem; background:rgba(var(--pf-rgb, 144,144,144), .15); color:var(--primary-text-color); }
          .pf-stat-k { font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:var(--secondary-text-color); }
          .pf-stat-v { font-weight:700; font-variant-numeric:tabular-nums; font-size:.98rem; }
          .pf-sellstat { --pf:var(--info-color, #2196f3); --pf-rgb:var(--rgb-info-color, 33,150,243); box-shadow:inset 0 -3px 0 var(--info-color, #2196f3); }
          .pf-counts { padding:6px 16px 0; font-size:.82rem; color:var(--secondary-text-color); }
        </style>
        ${header}
        <div class="pf-legend">
          <span><span class="pf-sw pf-use"></span>Używaj</span>
          <span><span class="pf-sw pf-neutral"></span>Neutralnie</span>
          <span><span class="pf-sw pf-limit"></span>Ogranicz</span>
          <span><span class="pf-sw pf-sellsw"></span>Sprzedaj</span>
        </div>
        <div class="pf-strip">${cells}</div>
      </ha-card>`;
  }
}

// Guard against a double load (e.g. a stray manual resource alongside the one the
// integration registers): defining the same element twice throws and would abort
// the second module, leaving the card broken.
if (!customElements.get("pstryk-fixing-card")) {
  customElements.define("pstryk-fixing-card", PstrykFixingCard);

  console.info(
    `%c PSTRYK-FIXING-CARD %c v${CARD_VERSION} `,
    "color:#fff;background:#0a8f5b;font-weight:600;padding:2px 6px;border-radius:3px 0 0 3px",
    "color:#0a8f5b;background:#04231a;font-weight:600;padding:2px 6px;border-radius:0 3px 3px 0",
  );

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "pstryk-fixing-card",
    name: "Pstryk Fixing Card",
    description: "Godzinowe wskazówki use / limit / sell z Pstryk Fixing.",
  });
}

/**
 * Pstryk Fixing scheduler card.
 *
 * Interactive companion that drives one "load" (EV charger, boiler, ...): pick a
 * mode and its parameters, toggle the schedule, and see the planned hours
 * highlighted on the price grid. It resolves the load's helper entities from the
 * device registry (config `entity:` = any entity of the load, or `device:` = the
 * load device) and reads the parent tariff's "current price" sensor for the grid.
 *
 * Usage (Lovelace YAML):
 *   type: custom:pstryk-fixing-scheduler-card
 *   entity: sensor.pstryk_ladowarka_planned_start   # any entity of the load
 */

const SCHED_MODES = {
  cheapest_window: "Najtańsze okno",
  fixed: "Sztywny start",
  price_below: "Poniżej progu ceny",
  advice_use: "Godziny zalecane",
};

const UNAVAIL = ["unknown", "unavailable", ""];

class PstrykFixingSchedulerCard extends HTMLElement {
  setConfig(config) {
    if (!config || (!config.entity && !config.device)) {
      throw new Error(
        "Podaj 'entity' (dowolna encja odbiornika) albo 'device' (urządzenie odbiornika).",
      );
    }
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    // Avoid clobbering a field the user is actively editing.
    const a = document.activeElement;
    if (this.contains(a) && /INPUT|SELECT/.test(a.tagName)) return;
    this._render();
  }

  getCardSize() {
    return 5;
  }

  static getStubConfig() {
    return { entity: "" };
  }

  _resolve(hass) {
    const cfg = this._config;
    let deviceId = cfg.device;
    if (!deviceId && cfg.entity && hass.entities && hass.entities[cfg.entity]) {
      deviceId = hass.entities[cfg.entity].device_id;
    }
    const ents = hass.entities ? Object.values(hass.entities) : [];
    const onDevice = deviceId
      ? ents.filter((e) => e.device_id === deviceId)
      : [];
    const find = (domain, suffix) => {
      const hit = onDevice.find(
        (e) =>
          e.entity_id.startsWith(`${domain}.`) &&
          e.entity_id.endsWith(suffix),
      );
      return hit ? hit.entity_id : null;
    };
    return {
      deviceId,
      schedule: cfg.schedule_entity || find("switch", "_schedule"),
      mode: cfg.mode_entity || find("select", "_mode"),
      ready_by: find("time", "_ready_by"),
      start_at: find("time", "_start_at"),
      stop_at: find("time", "_stop_at"),
      duration: find("number", "_duration"),
      price_ceiling: find("number", "_price_ceiling"),
      run_now: find("binary_sensor", "_run_now"),
      planned_start: cfg.planned_entity || find("sensor", "_planned_start"),
      price: cfg.price_entity || this._findPrice(hass, deviceId),
    };
  }

  _findPrice(hass, deviceId) {
    const ents = hass.entities ? Object.values(hass.entities) : [];
    const dev = hass.devices && deviceId ? hass.devices[deviceId] : null;
    const parentId = dev && dev.via_device_id;
    if (parentId) {
      const hit = ents.find(
        (e) =>
          e.device_id === parentId &&
          e.entity_id.endsWith("_current_price"),
      );
      if (hit) return hit.entity_id;
    }
    for (const id of Object.keys(hass.states)) {
      if (!id.startsWith("sensor.")) continue;
      const att = hass.states[id].attributes;
      if (att && Array.isArray(att.today) && att.thresholds) return id;
    }
    return null;
  }

  _state(entity) {
    return entity ? this._hass.states[entity] : null;
  }

  _timeVal(entity) {
    const s = this._state(entity);
    return s && !UNAVAIL.includes(s.state) ? s.state.slice(0, 5) : "";
  }

  _numVal(entity) {
    const s = this._state(entity);
    return s && Number.isFinite(Number(s.state)) ? s.state : "";
  }

  _fmtPlanned(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "-";
    return new Date(t).toLocaleString([], {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  _timeCtl(label, entity) {
    if (!entity) return "";
    return `<label class="pf-ctl"><span>${esc(label)}</span>
      <input class="pf-input" type="time" data-entity="${esc(entity)}" data-kind="time" value="${esc(this._timeVal(entity))}"></label>`;
  }

  _numCtl(label, entity, step, min, max, unit) {
    if (!entity) return "";
    return `<label class="pf-ctl"><span>${esc(label)}</span>
      <input class="pf-input" type="number" step="${esc(step)}" min="${esc(min)}" max="${esc(max)}" data-entity="${esc(entity)}" data-kind="number" value="${esc(this._numVal(entity))}"><small>${esc(unit || "")}</small></label>`;
  }

  _controls(mode, r) {
    if (mode === "cheapest_window") {
      return (
        this._timeCtl("Gotowe do", r.ready_by) +
        this._numCtl("Czas", r.duration, 1, 1, 12, "h") +
        this._timeCtl("Stop (opc.)", r.stop_at)
      );
    }
    if (mode === "fixed") {
      return this._timeCtl("Start o", r.start_at) + this._timeCtl("Stop o", r.stop_at);
    }
    if (mode === "price_below") {
      return (
        this._numCtl("Próg", r.price_ceiling, 0.05, 0, 5, "zł/kWh") +
        this._timeCtl("Stop (opc.)", r.stop_at)
      );
    }
    return this._timeCtl("Stop (opc.)", r.stop_at);
  }

  _grid(r, planned) {
    const priceObj = this._state(r.price);
    const today =
      priceObj && Array.isArray(priceObj.attributes.today)
        ? priceObj.attributes.today
        : [];
    const tomorrow =
      priceObj && Array.isArray(priceObj.attributes.tomorrow)
        ? priceObj.attributes.tomorrow
        : [];
    const allHours = today.concat(tomorrow);
    if (allHours.length === 0) {
      return `<div class="pf-counts">Czeka na ceny fixingu...</div>`;
    }
    const sel = new Set(
      (planned && Array.isArray(planned.attributes.selected_hours)
        ? planned.attributes.selected_hours
        : []
      )
        .map((s) => Date.parse(s))
        .filter((n) => !Number.isNaN(n)),
    );
    const now = Date.now();
    const cells = allHours
      .map((h) => {
        const advice = LABELS[h.consumption] ? h.consumption : "neutral";
        const startMs = Date.parse(h.startsAt);
        const hour = String(Number.parseInt(h.hour, 10) || 0).padStart(2, "0");
        const price = Number.isFinite(h.buyGrossPlnPerKwh)
          ? Number(h.buyGrossPlnPerKwh).toFixed(2)
          : "";
        const picked = sel.has(startMs);
        const isNow =
          !Number.isNaN(startMs) && startMs <= now && now < startMs + 3600000;
        const cls = [
          "pf-cell",
          `pf-${advice}`,
          picked ? "pf-picked" : "",
          isNow ? "pf-now" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<div class="${cls}"><span class="pf-hr">${hour}</span><span class="pf-px">${price}</span></div>`;
      })
      .join("");
    return `<div class="pf-strip">${cells}</div>`;
  }

  _render() {
    if (!this._hass || !this._config) return;
    const hass = this._hass;
    const r = this._resolve(hass);
    const title = esc(
      this._config.title ||
        (hass.devices && r.deviceId && hass.devices[r.deviceId]
          ? hass.devices[r.deviceId].name_by_user ||
            hass.devices[r.deviceId].name
          : "Pstryk - odbiornik"),
    );

    if (!r.deviceId || !r.mode) {
      this.innerHTML = `<ha-card header="${title}"><div style="padding:16px">Nie znaleziono encji odbiornika. Wskaż <code>entity</code> (np. sensor zaplanowanego startu) albo <code>device</code>.</div></ha-card>`;
      return;
    }

    const modeState = this._state(r.mode);
    const mode =
      modeState && SCHED_MODES[modeState.state]
        ? modeState.state
        : "cheapest_window";
    const enabled = r.schedule
      ? this._state(r.schedule) && this._state(r.schedule).state === "on"
      : true;
    const planned = this._state(r.planned_start);
    const runNow = this._state(r.run_now);
    const running = enabled && runNow && runNow.state === "on";

    const plannedTxt =
      planned && !UNAVAIL.includes(planned.state)
        ? this._fmtPlanned(planned.state)
        : "-";
    const badge = !enabled ? "Wyłączony" : running ? "Działa teraz" : "Bezczynny";
    const badgeCls = running ? "pf-run" : "pf-idle";

    const modeOptions = Object.keys(SCHED_MODES)
      .map(
        (m) =>
          `<option value="${m}"${m === mode ? " selected" : ""}>${esc(SCHED_MODES[m])}</option>`,
      )
      .join("");
    const modeCtl = `<label class="pf-ctl"><span>Tryb</span>
        <select class="pf-input" data-entity="${esc(r.mode)}" data-kind="mode">${modeOptions}</select></label>`;
    const enableCtl = r.schedule
      ? `<label class="pf-ctl pf-enable"><input type="checkbox" data-entity="${esc(r.schedule)}" data-kind="enable"${enabled ? " checked" : ""}><span>Harmonogram</span></label>`
      : "";

    this.innerHTML = `
      <ha-card header="${title}">
        <style>
          .pf-head { display:flex; flex-wrap:wrap; gap:.5rem; padding:8px 16px 0; align-items:center; }
          .pf-stat { display:flex; flex-direction:column; border-radius:8px; padding:6px 10px; min-width:6rem; background:rgba(var(--pf-rgb, 144,144,144), .15); color:var(--primary-text-color); }
          .pf-stat-k { font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:var(--secondary-text-color); }
          .pf-stat-v { font-weight:700; font-variant-numeric:tabular-nums; font-size:.98rem; }
          .pf-badge { margin-left:auto; font-weight:700; font-size:.82rem; padding:5px 10px; border-radius:999px; }
          .pf-run { color:#fff; background:var(--success-color, #43a047); }
          .pf-idle { color:var(--secondary-text-color); background:rgba(var(--rgb-primary-text-color,120,120,120),.12); }
          .pf-sched { padding:10px 16px 2px; display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
          .pf-ctl { display:flex; flex-direction:column; gap:3px; font-size:.72rem; color:var(--secondary-text-color); }
          .pf-ctl > span { text-transform:uppercase; letter-spacing:.03em; }
          .pf-ctl small { color:var(--secondary-text-color); font-size:.66rem; }
          .pf-input { font:inherit; padding:4px 6px; border-radius:6px; border:1px solid var(--divider-color, #ccc); background:var(--card-background-color); color:var(--primary-text-color); }
          .pf-enable { flex-direction:row; align-items:center; gap:6px; }
          .pf-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; padding:8px 16px 16px; }
          .pf-cell { display:flex; flex-direction:column; align-items:center; border-radius:6px; padding:5px 2px; font-size:.82rem; border:2px solid transparent; background:rgba(var(--pf-rgb, 144,144,144), .15); color:var(--primary-text-color); }
          .pf-hr { font-weight:700; font-size:.92rem; font-variant-numeric:tabular-nums; color:var(--pf, var(--primary-text-color)); }
          .pf-px { font-size:.72rem; font-variant-numeric:tabular-nums; color:var(--secondary-text-color); }
          .pf-use { --pf:var(--success-color, #43a047); --pf-rgb:var(--rgb-success-color, 67,160,71); }
          .pf-neutral { --pf:var(--secondary-text-color, #9e9e9e); --pf-rgb:144,144,144; }
          .pf-limit { --pf:var(--error-color, #e53935); --pf-rgb:var(--rgb-error-color, 229,57,53); }
          .pf-now { border-color:var(--primary-color, var(--primary-text-color)); }
          .pf-picked { border-color:var(--primary-color); box-shadow:0 0 0 2px var(--primary-color) inset; }
          .pf-counts { padding:10px 16px; font-size:.84rem; color:var(--secondary-text-color); }
        </style>
        <div class="pf-head">
          <div class="pf-stat"><span class="pf-stat-k">Zaplanowany start</span><span class="pf-stat-v">${esc(plannedTxt)}</span></div>
          <span class="pf-badge ${badgeCls}">${esc(badge)}</span>
        </div>
        <div class="pf-sched">${modeCtl}${this._controls(mode, r)}${enableCtl}</div>
        ${this._grid(r, planned)}
      </ha-card>`;

    this.querySelectorAll("[data-entity]").forEach((el) => {
      el.addEventListener("change", () => this._onChange(el));
    });
  }

  _onChange(el) {
    const entity = el.dataset.entity;
    const kind = el.dataset.kind;
    const hass = this._hass;
    if (kind === "mode") {
      hass.callService("select", "select_option", {
        entity_id: entity,
        option: el.value,
      });
    } else if (kind === "enable") {
      hass.callService("switch", el.checked ? "turn_on" : "turn_off", {
        entity_id: entity,
      });
    } else if (kind === "time") {
      if (!el.value) return;
      const time = el.value.length === 5 ? `${el.value}:00` : el.value;
      hass.callService("time", "set_value", { entity_id: entity, time });
    } else if (kind === "number") {
      hass.callService("number", "set_value", {
        entity_id: entity,
        value: Number(el.value),
      });
    }
  }
}

if (!customElements.get("pstryk-fixing-scheduler-card")) {
  customElements.define("pstryk-fixing-scheduler-card", PstrykFixingSchedulerCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "pstryk-fixing-scheduler-card",
    name: "Pstryk Fixing Scheduler Card",
    description:
      "Harmonogram odbiornika (EV, bojler) sterowany cenami Pstryk Fixing.",
  });
}

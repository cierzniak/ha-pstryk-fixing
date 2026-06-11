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
          /* Mobile: 6 columns × 4h. Desktop (>=600px): 4 columns × 6h. */
          .pf-strip { display:grid; grid-template-columns:repeat(6,1fr); gap:4px; padding:0 16px 16px; }
          @media (min-width:600px) { .pf-strip { grid-template-columns:repeat(4,1fr); } }
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

customElements.define("pstryk-fixing-card", PstrykFixingCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "pstryk-fixing-card",
  name: "Pstryk Fixing Card",
  description: "Godzinowe wskazówki use / limit / sell z Pstryk Fixing.",
});

/**
 * Pstryk Fixing Lovelace card.
 *
 * A dependency-free custom card that renders the 24-hour usage hints exposed by
 * the Pstryk Fixing integration's "current price" sensor (its `today` attribute:
 * a list of { hour, startsAt, buyGrossPlnPerKwh, sellGrossPlnPerKwh, consumption,
 * sell }). Each hour is coloured by its consumption advice (use / neutral /
 * limit) with a badge for sell hours; the current hour is highlighted.
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
          .pf-strip { display:grid; grid-template-columns:repeat(auto-fill,minmax(2.4rem,1fr)); gap:3px; padding:0 16px 16px; }
          .pf-cell { display:flex; flex-direction:column; align-items:center; border-radius:6px; padding:4px 2px; font-size:.72rem; border:2px solid transparent; }
          .pf-hr { font-weight:600; font-variant-numeric:tabular-nums; }
          .pf-px { opacity:.8; font-size:.64rem; }
          .pf-use { background:#e6f4ea; color:#11432a; }
          .pf-neutral { background:#eef0f2; color:#2b2f33; }
          .pf-limit { background:#fbe9e7; color:#7a1f1a; }
          .pf-sell { box-shadow:inset 0 -3px 0 #1455a3; }
          .pf-now { border-color:#000; }
          .pf-legend { display:flex; flex-wrap:wrap; gap:.6rem; padding:8px 16px 0; font-size:.74rem; }
          .pf-sw { width:.8rem; height:.8rem; border-radius:3px; display:inline-block; vertical-align:middle; margin-right:.2rem; }
        </style>
        <div class="pf-legend">
          <span><span class="pf-sw pf-use"></span>Używaj</span>
          <span><span class="pf-sw pf-neutral"></span>Neutralnie</span>
          <span><span class="pf-sw pf-limit"></span>Ogranicz</span>
          <span><span class="pf-sw" style="box-shadow:inset 0 -3px 0 #1455a3;background:#fff;"></span>Sprzedaj</span>
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

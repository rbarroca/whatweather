(() => {
  "use strict";

  const FALLBACK = { lat: 38.7223, lon: -9.1393, name: "Lisbon" };
  const MIN_YEAR = 1960;
  const CURRENT_YEAR = new Date().getFullYear();
  const MAX_HISTORY_YEAR = CURRENT_YEAR - 1;

  const els = {
    placeName: document.getElementById("placeName"),
    todayMax: document.getElementById("todayMax"),
    todayMin: document.getElementById("todayMin"),
    todayNotice: document.getElementById("todayNotice"),
    historyMax: document.getElementById("historyMax"),
    historyMin: document.getElementById("historyMin"),
    historyNotice: document.getElementById("historyNotice"),
    historyBody: document.getElementById("historyTemp"),
    yearValue: document.getElementById("yearValue"),
    yearSelect: document.getElementById("yearSelect"),
    yearButton: document.getElementById("yearButton"),
    yearPrev: document.getElementById("yearPrev"),
    yearNext: document.getElementById("yearNext"),
    randomYear: document.getElementById("randomYear"),
    badge: document.getElementById("diffBadge"),
    diffValue: document.getElementById("diffValue"),
  };

  const state = {
    lat: null,
    lon: null,
    mm: null,
    dd: null,
    todayMax: null,
    year: randomYear(),
  };

  function randomYear() {
    return MIN_YEAR + Math.floor(Math.random() * (MAX_HISTORY_YEAR - MIN_YEAR + 1));
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function round(n) {
    return Math.round(n);
  }

  function setNotice(el, message) {
    if (!message) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = "";
    if (typeof message === "string") {
      el.textContent = message;
    } else {
      el.appendChild(message);
    }
  }

  function retryButton(label, handler) {
    const wrap = document.createElement("span");
    wrap.textContent = label + " ";
    const btn = document.createElement("button");
    btn.className = "link-btn";
    btn.type = "button";
    btn.textContent = "Try again";
    btn.addEventListener("click", handler);
    wrap.appendChild(btn);
    return wrap;
  }

  function populateYearSelect() {
    els.yearSelect.innerHTML = "";
    for (let y = MAX_HISTORY_YEAR; y >= MIN_YEAR; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      els.yearSelect.appendChild(opt);
    }
  }

  function syncYearUI() {
    els.yearValue.textContent = String(state.year);
    els.yearSelect.value = String(state.year);
    els.yearPrev.disabled = state.year <= MIN_YEAR;
    els.yearNext.disabled = state.year >= MAX_HISTORY_YEAR;
  }

  function updateBadge(historyMax) {
    if (state.todayMax === null || historyMax === null || historyMax === undefined) {
      els.badge.hidden = true;
      return;
    }
    const diff = round(state.todayMax) - round(historyMax);
    els.badge.hidden = false;
    els.badge.classList.remove("badge--cold", "badge--neutral");

    let text;
    if (diff > 0) {
      text = `+${diff}°`;
    } else if (diff < 0) {
      text = `−${Math.abs(diff)}°`;
      els.badge.classList.add("badge--cold");
    } else {
      text = "0°";
      els.badge.classList.add("badge--neutral");
    }
    els.diffValue.textContent = text;
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }

  function locate() {
    setNotice(els.todayNotice, null);
    els.placeName.textContent = "Locating…";

    if (!("geolocation" in navigator)) {
      useFallback("Location unavailable.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(3));
        const lon = Number(pos.coords.longitude.toFixed(3));
        state.lat = lat;
        state.lon = lon;
        resolvePlaceName(lat, lon);
        loadToday();
        loadHistory();
      },
      () => {
        useFallback("Location denied.");
      },
      { timeout: 8000 }
    );
  }

  function useFallback(reason) {
    state.lat = FALLBACK.lat;
    state.lon = FALLBACK.lon;
    els.placeName.textContent = FALLBACK.name;
    setNotice(els.todayNotice, `${reason} Using ${FALLBACK.name}.`);
    loadToday();
    loadHistory();
  }

  async function resolvePlaceName(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`;
      const data = await fetchJSON(url);
      const addr = data.address || {};
      const name =
        addr.city || addr.town || addr.village || addr.municipality || addr.county ||
        (data.display_name ? data.display_name.split(",")[0] : null) ||
        "your location";
      els.placeName.textContent = name;
    } catch (e) {
      els.placeName.textContent = "your location";
    }
  }

  async function loadToday() {
    els.todayMax.textContent = "...";
    els.todayMin.innerHTML = "&nbsp;";
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
      const data = await fetchJSON(url);
      const max = data.daily.temperature_2m_max[0];
      const min = data.daily.temperature_2m_min[0];
      const now = new Date();
      state.mm = pad(now.getMonth() + 1);
      state.dd = pad(now.getDate());

      if (max === null || max === undefined) {
        throw new Error("no data");
      }

      state.todayMax = max;
      els.todayMax.textContent = String(round(max));
      els.todayMin.textContent = `min ${round(min)}°`;
      updateBadge(currentHistoryMax());
    } catch (e) {
      els.todayMax.textContent = "—";
      els.todayMin.innerHTML = "&nbsp;";
      setNotice(els.todayNotice, retryButton("Couldn't load today's weather.", () => {
        loadToday();
      }));
      els.badge.hidden = true;
    }
  }

  let lastHistoryMax = null;
  function currentHistoryMax() {
    return lastHistoryMax;
  }

  async function loadHistory() {
    if (state.mm === null) {
      const now = new Date();
      state.mm = pad(now.getMonth() + 1);
      state.dd = pad(now.getDate());
    }

    els.historyBody.classList.add("is-loading");
    els.historyMax.textContent = "...";
    els.historyMin.innerHTML = "&nbsp;";
    setNotice(els.historyNotice, null);
    els.badge.hidden = true;

    const dateStr = `${state.year}-${state.mm}-${state.dd}`;

    try {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${state.lat}&longitude=${state.lon}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
      const data = await fetchJSON(url);
      const max = data.daily.temperature_2m_max[0];
      const min = data.daily.temperature_2m_min[0];

      if (max === null || max === undefined) {
        lastHistoryMax = null;
        els.historyMax.textContent = "—";
        els.historyMin.innerHTML = "&nbsp;";
        setNotice(els.historyNotice, "No record for this day.");
        els.badge.hidden = true;
      } else {
        lastHistoryMax = max;
        els.historyMax.textContent = String(round(max));
        els.historyMin.textContent = `min ${round(min)}°`;
        updateBadge(max);
      }
    } catch (e) {
      lastHistoryMax = null;
      els.historyMax.textContent = "—";
      els.historyMin.innerHTML = "&nbsp;";
      setNotice(els.historyNotice, retryButton("Couldn't load history.", () => {
        loadHistory();
      }));
      els.badge.hidden = true;
    } finally {
      els.historyBody.classList.remove("is-loading");
    }
  }

  function changeYear(newYear) {
    const clamped = Math.min(MAX_HISTORY_YEAR, Math.max(MIN_YEAR, newYear));
    if (clamped === state.year) return;
    state.year = clamped;
    syncYearUI();
    loadHistory();
  }

  function initYearControls() {
    populateYearSelect();
    syncYearUI();

    els.yearPrev.addEventListener("click", () => changeYear(state.year - 1));
    els.yearNext.addEventListener("click", () => changeYear(state.year + 1));

    els.yearButton.addEventListener("click", () => {
      els.yearSelect.focus();
      if (typeof els.yearSelect.showPicker === "function") {
        try {
          els.yearSelect.showPicker();
          return;
        } catch (e) {
          /* fall through to click */
        }
      }
      els.yearSelect.click();
    });

    els.yearSelect.addEventListener("change", (e) => {
      changeYear(Number(e.target.value));
    });

    els.randomYear.addEventListener("click", () => {
      let next = randomYear();
      if (MAX_HISTORY_YEAR > MIN_YEAR) {
        while (next === state.year) {
          next = randomYear();
        }
      }
      changeYear(next);
    });
  }

  initYearControls();
  locate();
})();

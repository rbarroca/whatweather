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
    shareBtn: document.getElementById("shareBtn"),
    shareStoryBtn: document.getElementById("shareStoryBtn"),
    shareNotice: document.getElementById("shareNotice"),
  };

  const state = {
    lat: null,
    lon: null,
    mm: null,
    dd: null,
    todayMax: null,
    todayMin: null,
    historyMin: null,
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

  function computeDiff(todayMax, historyMax) {
    if (todayMax === null || todayMax === undefined || historyMax === null || historyMax === undefined) {
      return null;
    }
    const diff = round(todayMax) - round(historyMax);
    if (diff > 0) return { diff, text: `+${diff}°`, cls: null, color: "#EE4D1E" };
    if (diff < 0) return { diff, text: `−${Math.abs(diff)}°`, cls: "badge--cold", color: "#2E7FB8" };
    return { diff, text: "0°", cls: "badge--neutral", color: "#8A8A8A" };
  }

  function updateBadge(historyMax) {
    const result = computeDiff(state.todayMax, historyMax);
    els.badge.classList.remove("badge--cold", "badge--neutral");

    if (!result) {
      els.badge.hidden = true;
      return;
    }

    els.badge.hidden = false;
    if (result.cls) els.badge.classList.add(result.cls);
    els.diffValue.textContent = result.text;
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
      (err) => {
        let reason = "Location unavailable.";
        if (err && err.code === 1) reason = "Location blocked in browser settings.";
        else if (err && err.code === 3) reason = "Location request timed out.";
        useFallback(reason);
      },
      { timeout: 8000 }
    );
  }

  function useFallback(reason) {
    state.lat = FALLBACK.lat;
    state.lon = FALLBACK.lon;
    els.placeName.textContent = FALLBACK.name;
    setNotice(els.todayNotice, retryButton(`${reason} Using ${FALLBACK.name}.`, () => {
      locate();
    }));
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
      state.todayMin = min;
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
        state.historyMin = null;
        els.historyMax.textContent = "—";
        els.historyMin.innerHTML = "&nbsp;";
        setNotice(els.historyNotice, "No record for this day.");
        els.badge.hidden = true;
      } else {
        lastHistoryMax = max;
        state.historyMin = min;
        els.historyMax.textContent = String(round(max));
        els.historyMin.textContent = `min ${round(min)}°`;
        updateBadge(max);
      }
    } catch (e) {
      lastHistoryMax = null;
      state.historyMin = null;
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

  // --- Share card generation ---

  const CARD_FONT = '"Google Sans Flex", "Google Sans Code", "Inter", system-ui, sans-serif';
  const CARD_FORMATS = {
    post: { w: 1080, h: 1350 },
    story: { w: 1080, h: 1920 },
  };

  async function ensureCardFontsLoaded() {
    if (!("fonts" in document)) return;
    try {
      await Promise.all([
        document.fonts.load(`700 96px ${CARD_FONT}`),
        document.fonts.load(`400 96px ${CARD_FONT}`),
      ]);
      await document.fonts.ready;
    } catch (e) {
      /* fall back to default font if loading fails */
    }
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCardHalf(ctx, opts) {
    const { top, height, w, marginX, bg, fg, mutedColor, label, corner, bigText, minText } = opts;

    ctx.fillStyle = bg;
    ctx.fillRect(0, top, w, height);

    const headerBaseline = top + 78;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = fg;
    ctx.font = `700 32px ${CARD_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(label, marginX, headerBaseline);

    ctx.font = `400 32px ${CARD_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(corner, w - marginX, headerBaseline);

    const numberSize = 380;
    const minSize = 30;
    const numberToMinGap = 44;
    const blockHeight = numberSize + numberToMinGap + minSize;
    const areaTop = top + 150;
    const areaBottom = top + height - 40;
    const blockTop = areaTop + Math.max(0, (areaBottom - areaTop - blockHeight) / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = fg;
    ctx.font = `700 ${numberSize}px ${CARD_FONT}`;
    ctx.fillText(bigText, marginX, blockTop);
    const numW = ctx.measureText(bigText).width;

    ctx.font = `400 ${numberSize}px ${CARD_FONT}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText("°", marginX + numW + 6, blockTop);
    ctx.globalAlpha = 1;

    if (minText) {
      ctx.font = `400 ${minSize}px ${CARD_FONT}`;
      ctx.fillStyle = mutedColor;
      ctx.fillText(minText, marginX, blockTop + numberSize + numberToMinGap);
    }
  }

  function drawCardBadge(ctx, cx, cy, diffResult) {
    if (!diffResult) return;
    ctx.font = `700 34px ${CARD_FONT}`;
    const textW = ctx.measureText(diffResult.text).width;
    const padX = 34;
    const pillH = 96;
    const pillW = textW + padX * 2;
    const x = cx - pillW / 2;
    const y = cy - pillH / 2;

    ctx.fillStyle = diffResult.color;
    drawRoundedRect(ctx, x, y, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(diffResult.text, cx, cy + 2);
  }

  async function generateShareCard(format) {
    const size = CARD_FORMATS[format] || CARD_FORMATS.post;
    await ensureCardFontsLoaded();

    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    const halfH = size.h / 2;
    const marginX = 90;

    const place = els.placeName.textContent && els.placeName.textContent !== "—"
      ? els.placeName.textContent
      : "your location";

    drawCardHalf(ctx, {
      top: 0,
      height: halfH,
      w: size.w,
      marginX,
      bg: "#FFFFFF",
      fg: "#0A0A0A",
      mutedColor: "rgba(0,0,0,.55)",
      label: "Today",
      corner: place,
      bigText: state.todayMax !== null ? String(round(state.todayMax)) : "—",
      minText: state.todayMin !== null ? `min ${round(state.todayMin)}°` : "",
    });

    drawCardHalf(ctx, {
      top: halfH,
      height: halfH,
      w: size.w,
      marginX,
      bg: "#0A0A0A",
      fg: "#FFFFFF",
      mutedColor: "rgba(255,255,255,.55)",
      label: "Same day",
      corner: String(state.year),
      bigText: lastHistoryMax !== null ? String(round(lastHistoryMax)) : "—",
      minText: state.historyMin !== null ? `min ${round(state.historyMin)}°` : "",
    });

    const diffResult = computeDiff(state.todayMax, lastHistoryMax);
    drawCardBadge(ctx, size.w / 2, halfH, diffResult);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = `400 26px ${CARD_FONT}`;
    ctx.fillText("whatweather.xyz", size.w / 2, size.h - 50);

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  function slugify(text) {
    return (text || "location")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "location";
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setShareBusy(busy) {
    els.shareBtn.disabled = busy;
    els.shareStoryBtn.disabled = busy;
    els.shareBtn.textContent = busy ? "…" : "↗ share";
  }

  async function handleShare(format) {
    if (state.todayMax === null) return;

    setShareBusy(true);
    setNotice(els.shareNotice, null);

    try {
      const blob = await generateShareCard(format);
      const place = els.placeName.textContent || "location";
      const fileName = `whatweather-${slugify(place)}-${state.year}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      const todayText = state.todayMax !== null ? `${round(state.todayMax)}°` : "—";
      const historyText = lastHistoryMax !== null && lastHistoryMax !== undefined ? `${round(lastHistoryMax)}°` : "—";
      const shareText = `${todayText} today vs ${historyText} on this day in ${state.year} — whatweather.xyz`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "what.weather",
            text: shareText,
            url: "https://whatweather.xyz",
          });
        } catch (err) {
          if (err && err.name !== "AbortError") {
            downloadBlob(blob, fileName);
          }
        }
      } else {
        downloadBlob(blob, fileName);
      }
    } catch (e) {
      setNotice(els.shareNotice, "Couldn't generate the share image.");
    } finally {
      setShareBusy(false);
    }
  }

  function initShare() {
    els.shareBtn.addEventListener("click", () => handleShare("post"));
    els.shareStoryBtn.addEventListener("click", () => handleShare("story"));
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
  initShare();
  locate();
})();

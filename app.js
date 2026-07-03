(() => {
  "use strict";

  const FALLBACK = { lat: 38.7223, lon: -9.1393, name: "Lisbon" };
  const MIN_YEAR = 1960;
  const CURRENT_YEAR = new Date().getFullYear();
  const MAX_HISTORY_YEAR = CURRENT_YEAR - 1;
  const LOCATION_STORAGE_KEY = "ww_saved_city";

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
    shareControl: document.getElementById("shareControl"),
    shareBtn: document.getElementById("shareBtn"),
    sharePanel: document.getElementById("sharePanel"),
    shareFormats: document.getElementById("shareFormats"),
    shareFormatPost: document.getElementById("shareFormatPost"),
    shareFormatStory: document.getElementById("shareFormatStory"),
    shareActions: document.getElementById("shareActions"),
    saveImageBtn: document.getElementById("saveImageBtn"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    sharePanelStatus: document.getElementById("sharePanelStatus"),
    shareNotice: document.getElementById("shareNotice"),
    placeControl: document.getElementById("placeControl"),
    placeButton: document.getElementById("placeButton"),
    placePanel: document.getElementById("placePanel"),
    placeInput: document.getElementById("placeInput"),
    placeResults: document.getElementById("placeResults"),
    placeStatus: document.getElementById("placeStatus"),
    useLocationBtn: document.getElementById("useLocationBtn"),
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

  // --- Location: saved city, GPS/IP cascade, and staleness guarding ---
  //
  // Multiple async paths can resolve a location (GPS, two IP providers,
  // Lisbon, or the user manually picking a city mid-cascade). Each attempt
  // captures the token active when it started and checks it's still current
  // before writing to state/DOM, so a slow GPS fix can't clobber a location
  // the user already picked in the meantime.
  let activeLocationToken = 0;

  function beginLocationUpdate() {
    activeLocationToken += 1;
    return activeLocationToken;
  }

  function isStale(token) {
    return token !== activeLocationToken;
  }

  function setPlaceName(name, approximate) {
    els.placeName.textContent = approximate ? `~ ${name}` : name;
  }

  function displayedPlaceName() {
    return (els.placeName.textContent || "").replace(/^~\s*/, "");
  }

  function getSavedCity() {
    try {
      const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === "string" && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) {
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function saveCity(loc) {
    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
    } catch (e) {
      /* localStorage unavailable (private mode, sandboxed embeds, etc.) */
    }
  }

  function clearSavedCity() {
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function locate() {
    const token = beginLocationUpdate();
    setNotice(els.todayNotice, null);

    const saved = getSavedCity();
    if (saved) {
      useSavedCity(saved);
      return;
    }

    els.placeName.textContent = "Locating…";

    if (!("geolocation" in navigator)) {
      tryIpLocation(token);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (isStale(token)) return;
        const lat = Number(pos.coords.latitude.toFixed(3));
        const lon = Number(pos.coords.longitude.toFixed(3));
        state.lat = lat;
        state.lon = lon;
        resolvePlaceName(lat, lon, token);
        loadToday();
        loadHistory();
      },
      () => {
        // Desktop browsers often can't get a GPS/Wi-Fi fix in time (or the user
        // declined). Either way, an approximate IP-based location beats Lisbon.
        tryIpLocation(token);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 600000 }
    );
  }

  async function fetchIpLocation(url, extract) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`IP lookup failed: ${res.status}`);
    const data = await res.json();
    const loc = extract(data);
    if (!loc) throw new Error("IP lookup returned no usable location");
    return loc;
  }

  async function tryIpLocation(token) {
    try {
      const loc = await fetchIpLocation("https://ipwho.is/", (d) =>
        d && d.success === true && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
          ? { lat: d.latitude, lon: d.longitude, city: d.city }
          : null
      );
      if (isStale(token)) return;
      useIpLocation(loc);
      return;
    } catch (e) {
      /* try the secondary IP provider before giving up */
    }

    try {
      const loc = await fetchIpLocation("https://ipapi.co/json/", (d) =>
        d && !d.error && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
          ? { lat: d.latitude, lon: d.longitude, city: d.city }
          : null
      );
      if (isStale(token)) return;
      useIpLocation(loc);
      return;
    } catch (e) {
      /* both IP providers failed */
    }

    if (isStale(token)) return;
    useFallback("Couldn't detect your location.");
  }

  function useIpLocation(loc) {
    state.lat = Number(loc.lat.toFixed(3));
    state.lon = Number(loc.lon.toFixed(3));
    setPlaceName(loc.city || "your location", true);
    loadToday();
    loadHistory();
  }

  function useSavedCity(loc) {
    state.lat = loc.lat;
    state.lon = loc.lon;
    setPlaceName(loc.name, false);
    loadToday();
    loadHistory();
  }

  function useFallback(reason) {
    state.lat = FALLBACK.lat;
    state.lon = FALLBACK.lon;
    setPlaceName(FALLBACK.name, false);
    setNotice(els.todayNotice, retryButton(`${reason} Using ${FALLBACK.name} (approximate).`, () => {
      locate();
    }));
    loadToday();
    loadHistory();
  }

  async function resolvePlaceName(lat, lon, token) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`;
      const data = await fetchJSON(url);
      if (isStale(token)) return;
      const addr = data.address || {};
      const name =
        addr.city || addr.town || addr.village || addr.municipality || addr.county ||
        (data.display_name ? data.display_name.split(",")[0] : null) ||
        "your location";
      setPlaceName(name, false);
    } catch (e) {
      if (isStale(token)) return;
      setPlaceName("your location", false);
    }
  }

  // --- City search (manual correction) ---

  async function searchCities(query) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const data = await fetchJSON(url);
    return Array.isArray(data.results) ? data.results : [];
  }

  function selectCity(result) {
    beginLocationUpdate(); // invalidate any auto-detect cascade still in flight
    const lat = Number(result.latitude.toFixed(3));
    const lon = Number(result.longitude.toFixed(3));
    state.lat = lat;
    state.lon = lon;
    setPlaceName(result.name, false);
    saveCity({ name: result.name, lat, lon, country: result.country || "" });
    closePlacePanel();
    els.placeButton.focus();
    loadToday();
    loadHistory();
  }

  function useMyLocation() {
    clearSavedCity();
    closePlacePanel();
    els.placeButton.focus();
    locate();
  }

  let placeSearchResults = [];
  let placeActiveResultIndex = -1;
  let placeSearchTimer = null;
  let placeSearchSeq = 0;

  function setPlaceStatus(text) {
    els.placeStatus.textContent = text || "";
  }

  function renderPlaceResults(results) {
    placeSearchResults = results;
    placeActiveResultIndex = -1;
    els.placeInput.removeAttribute("aria-activedescendant");
    els.placeResults.innerHTML = "";
    results.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "place-result";
      li.id = `place-result-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.textContent = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectCity(r);
      });
      els.placeResults.appendChild(li);
    });
  }

  function setActivePlaceResult(index) {
    const items = els.placeResults.querySelectorAll(".place-result");
    items.forEach((el, i) => {
      const active = i === index;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-selected", active ? "true" : "false");
    });
    placeActiveResultIndex = index;
    if (index >= 0 && items[index]) {
      els.placeInput.setAttribute("aria-activedescendant", items[index].id);
      items[index].scrollIntoView({ block: "nearest" });
    } else {
      els.placeInput.removeAttribute("aria-activedescendant");
    }
  }

  function openPlacePanel() {
    els.placePanel.hidden = false;
    els.placeButton.setAttribute("aria-expanded", "true");
    els.placeInput.value = "";
    renderPlaceResults([]);
    setPlaceStatus("");
    els.placeInput.focus();
    document.addEventListener("pointerdown", handlePlaceOutsideClick, true);
  }

  function closePlacePanel() {
    if (els.placePanel.hidden) return;
    els.placePanel.hidden = true;
    els.placeButton.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", handlePlaceOutsideClick, true);
    if (placeSearchTimer) clearTimeout(placeSearchTimer);
  }

  function handlePlaceOutsideClick(e) {
    if (!els.placeControl.contains(e.target)) {
      closePlacePanel();
    }
  }

  function handlePlaceInput() {
    const query = els.placeInput.value.trim();
    if (placeSearchTimer) clearTimeout(placeSearchTimer);

    if (query.length < 2) {
      renderPlaceResults([]);
      setPlaceStatus("");
      return;
    }

    setPlaceStatus("Searching…");
    placeSearchTimer = setTimeout(async () => {
      const seq = ++placeSearchSeq;
      try {
        const results = await searchCities(query);
        if (seq !== placeSearchSeq) return;
        if (results.length === 0) {
          setPlaceStatus("No city found.");
          renderPlaceResults([]);
        } else {
          setPlaceStatus("");
          renderPlaceResults(results);
        }
      } catch (e) {
        if (seq !== placeSearchSeq) return;
        setPlaceStatus("Couldn't search right now.");
        renderPlaceResults([]);
      }
    }, 300);
  }

  function handlePlaceInputKeydown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (placeSearchResults.length === 0) return;
      setActivePlaceResult(Math.min(placeActiveResultIndex + 1, placeSearchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (placeSearchResults.length === 0) return;
      setActivePlaceResult(Math.max(placeActiveResultIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = placeActiveResultIndex >= 0 ? placeActiveResultIndex : 0;
      if (placeSearchResults[idx]) selectCity(placeSearchResults[idx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePlacePanel();
      els.placeButton.focus();
    }
  }

  function initPlaceSearch() {
    els.placeButton.addEventListener("click", () => {
      if (els.placePanel.hidden) openPlacePanel();
      else closePlacePanel();
    });

    els.placeInput.addEventListener("input", handlePlaceInput);
    els.placeInput.addEventListener("keydown", handlePlaceInputKeydown);
    els.useLocationBtn.addEventListener("click", useMyLocation);
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

    const cleanPlace = displayedPlaceName();
    const place = cleanPlace && cleanPlace !== "—" ? cleanPlace : "your location";

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

  // --- Unified share flow: pick format, then deliver by platform ---
  //
  // "share" opens a tiny popover with post/story. Once a format is picked,
  // file-sharing support (navigator.canShare with an actual File, not UA
  // sniffing) decides the path: mobile hands the PNG straight to the native
  // share sheet; desktop reveals "save image" (download) + "copy link"
  // (clipboard) in the same popover.

  let pendingShareBlob = null;
  let pendingShareFileName = null;

  function supportsFileShare() {
    if (!navigator.canShare) return false;
    try {
      const testFile = new File(["x"], "test.png", { type: "image/png" });
      return navigator.canShare({ files: [testFile] });
    } catch (e) {
      return false;
    }
  }

  function buildShareText() {
    const todayText = state.todayMax !== null ? `${round(state.todayMax)}°` : "—";
    const historyText = lastHistoryMax !== null && lastHistoryMax !== undefined ? `${round(lastHistoryMax)}°` : "—";
    const place = displayedPlaceName().trim();
    const placePrefix = place ? `${place} ` : "";
    return `${placePrefix}${todayText} today vs ${historyText} on this day in ${state.year}. whatweather.xyz`;
  }

  function setSharePanelStatus(text) {
    els.sharePanelStatus.textContent = text || "";
  }

  function showShareFormats() {
    els.shareFormats.hidden = false;
    els.shareActions.hidden = true;
    els.shareFormatPost.disabled = false;
    els.shareFormatStory.disabled = false;
  }

  function showShareActions() {
    els.shareFormats.hidden = true;
    els.shareActions.hidden = false;
  }

  function openSharePanel() {
    if (state.todayMax === null) return;
    els.sharePanel.hidden = false;
    els.shareBtn.setAttribute("aria-expanded", "true");
    pendingShareBlob = null;
    pendingShareFileName = null;
    setSharePanelStatus("");
    showShareFormats();
    document.addEventListener("pointerdown", handleShareOutsideClick, true);
    document.addEventListener("keydown", handleShareKeydown, true);
  }

  function closeSharePanel() {
    if (els.sharePanel.hidden) return;
    els.sharePanel.hidden = true;
    els.shareBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", handleShareOutsideClick, true);
    document.removeEventListener("keydown", handleShareKeydown, true);
    pendingShareBlob = null;
    pendingShareFileName = null;
  }

  function handleShareOutsideClick(e) {
    if (!els.shareControl.contains(e.target)) closeSharePanel();
  }

  function handleShareKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSharePanel();
      els.shareBtn.focus();
    }
  }

  async function chooseShareFormat(format) {
    setNotice(els.shareNotice, null);
    els.shareFormatPost.disabled = true;
    els.shareFormatStory.disabled = true;
    setSharePanelStatus("Generating…");

    try {
      const blob = await generateShareCard(format);
      const place = displayedPlaceName() || "location";
      const fileName = `whatweather-${slugify(place)}-${state.year}.png`;

      if (supportsFileShare()) {
        const file = new File([blob], fileName, { type: "image/png" });
        closeSharePanel();
        try {
          await navigator.share({
            files: [file],
            title: "what weather",
            text: buildShareText(),
          });
        } catch (err) {
          if (err && err.name !== "AbortError") {
            downloadBlob(blob, fileName);
          }
        }
      } else {
        pendingShareBlob = blob;
        pendingShareFileName = fileName;
        setSharePanelStatus("");
        showShareActions();
      }
    } catch (e) {
      setSharePanelStatus("Couldn't generate the share image.");
      showShareFormats();
    }
  }

  function saveGeneratedImage() {
    if (!pendingShareBlob) return;
    downloadBlob(pendingShareBlob, pendingShareFileName);
    closeSharePanel();
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText("https://whatweather.xyz");
      setSharePanelStatus("copied");
      setTimeout(() => setSharePanelStatus(""), 1500);
    } catch (e) {
      setSharePanelStatus("Couldn't copy.");
    }
  }

  function initShare() {
    els.shareBtn.addEventListener("click", () => {
      if (els.sharePanel.hidden) openSharePanel();
      else closeSharePanel();
    });
    els.shareFormatPost.addEventListener("click", () => chooseShareFormat("post"));
    els.shareFormatStory.addEventListener("click", () => chooseShareFormat("story"));
    els.saveImageBtn.addEventListener("click", saveGeneratedImage);
    els.copyLinkBtn.addEventListener("click", copyShareLink);
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
  initPlaceSearch();
  locate();
})();

// Qibla-Kompass: Richtung zur Kaaba aus dem Standort (GPS oder Stadt) – alles auf dem Gerät berechnet, funktioniert offline.
(function(){
"use strict";
const KAABA = {lat: 21.4225, lon: 39.8262};
const STORE = "kik-qibla-ort";
const TOLERANZ = 4;
const host = location.hostname;
const IN_APP = location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host.endsWith("github.io");
const APP_URL = "https://ektmedien.github.io/koran-im-kontext/";

const STAEDTE = [
 ["Deutschland", [["Aachen",50.776,6.084],["Augsburg",48.366,10.898],["Berlin",52.520,13.405],["Bielefeld",52.030,8.532],["Bochum",51.482,7.216],["Bonn",50.737,7.098],["Bremen",53.079,8.802],["Dortmund",51.514,7.468],["Dresden",51.050,13.738],["Duisburg",51.434,6.762],["Düsseldorf",51.227,6.774],["Essen",51.456,7.012],["Frankfurt am Main",50.110,8.682],["Freiburg",47.999,7.842],["Gelsenkirchen",51.518,7.086],["Hagen",51.367,7.463],["Hamburg",53.551,9.994],["Hannover",52.376,9.732],["Heilbronn",49.142,9.219],["Karlsruhe",49.007,8.404],["Kassel",51.312,9.479],["Kiel",54.323,10.123],["Köln",50.938,6.960],["Leipzig",51.340,12.375],["Leverkusen",51.046,6.984],["Mainz",49.993,8.247],["Mannheim",49.487,8.466],["Mönchengladbach",51.180,6.443],["München",48.137,11.575],["Münster",51.960,7.626],["Nürnberg",49.452,11.077],["Offenbach",50.096,8.776],["Saarbrücken",49.240,6.997],["Stuttgart",48.776,9.183],["Ulm",48.401,9.988],["Wiesbaden",50.078,8.240],["Wuppertal",51.256,7.150]]],
 ["Österreich & Schweiz", [["Basel",47.560,7.589],["Bern",46.948,7.447],["Genf",46.204,6.143],["Graz",47.071,15.440],["Innsbruck",47.269,11.404],["Linz",48.306,14.286],["Salzburg",47.809,13.055],["Wien",48.208,16.373],["Zürich",47.377,8.540]]],
 ["Türkei", [["Adana",37.000,35.321],["Ankara",39.933,32.860],["Antalya",36.897,30.713],["Bursa",40.188,29.061],["Diyarbakır",37.925,40.211],["Gaziantep",37.066,37.383],["Istanbul",41.008,28.978],["Izmir",38.423,27.143],["Kayseri",38.734,35.467],["Konya",37.871,32.485],["Samsun",41.286,36.330],["Trabzon",41.003,39.717]]],
 ["Balkan", [["Priština",42.663,21.165],["Sarajevo",43.856,18.413],["Skopje",41.998,21.425],["Tirana",41.328,19.819]]],
 ["Weitere", [["Amsterdam",52.368,4.904],["Brüssel",50.850,4.352],["Dubai",25.205,55.271],["Jerusalem",31.778,35.235],["Kairo",30.044,31.236],["Kopenhagen",55.676,12.568],["London",51.507,-0.128],["Madrid",40.417,-3.704],["Medina",24.467,39.611],["Paris",48.857,2.352],["Rom",41.903,12.496],["Stockholm",59.329,18.069]]],
];

const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const norm360 = a => ((a % 360) + 360) % 360;
const norm180 = a => { a = norm360(a); return a > 180 ? a - 360 : a; };
function qiblaRichtung(lat, lon){
  const p1 = rad(lat), p2 = rad(KAABA.lat), dl = rad(KAABA.lon - lon);
  return norm360(deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))));
}
function entfernungKm(lat, lon){
  const p1 = rad(lat), p2 = rad(KAABA.lat), dp = p2 - p1, dl = rad(KAABA.lon - lon);
  const a = Math.sin(dp/2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function himmelsrichtung(b){
  return ["Norden","Nordnordost","Nordost","Ostnordost","Osten","Ostsüdost","Südost","Südsüdost","Süden","Südsüdwest","Südwest","Westsüdwest","Westen","Westnordwest","Nordwest","Nordnordwest"][Math.round(b / 22.5) % 16];
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ───────── Zustand ───────── */
let ort = null;            // {lat, lon, name, quelle, zeit}
let heading = null;        // geglättete Blickrichtung in Grad
let anzeigeDrehung = 0;    // fortlaufender Drehwinkel für weiche Animation
let kompassStatus = "aus"; // aus | wartet | aktiv | keiner | verweigert
let listener = null, keinKompassTimer = null, warAusgerichtet = false;

function ladeOrt(){ try { const o = JSON.parse(localStorage.getItem(STORE) || "null"); if (o && isFinite(o.lat) && isFinite(o.lon)) ort = o; } catch (e) {} }
function speichereOrt(o){ ort = o; try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} }

/* ───────── Kompass-Sensor ───────── */
function bildschirmWinkel(){
  return (screen.orientation && typeof screen.orientation.angle === "number") ? screen.orientation.angle : (window.orientation || 0);
}
function neuerWert(h){
  h = norm360(h + bildschirmWinkel());
  heading = heading === null ? h : norm360(heading + norm180(h - heading) * 0.25);
  if (kompassStatus !== "aktiv") { kompassStatus = "aktiv"; zeichneStatus(); }
  aktualisiere();
}
// iPhone liefert webkitCompassHeading im Ereignis „deviceorientation“; Android/Chrome liefert absolute Werte
// über „deviceorientationabsolute“ (alpha gegen den Uhrzeigersinn) – beide Quellen werden angehört.
function onOrientierung(e){
  if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) neuerWert(e.webkitCompassHeading);
  else if (e.absolute && e.alpha !== null && e.alpha !== undefined) neuerWert(360 - e.alpha);
}
function onAbsolut(e){ if (e.alpha !== null && e.alpha !== undefined) neuerWert(360 - e.alpha); }

async function starteKompass(){
  stoppeKompass();
  kompassStatus = "wartet"; zeichneStatus();
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== "granted") { kompassStatus = "verweigert"; zeichneStatus(); return; }
    }
    listener = [["deviceorientation", onOrientierung]];
    if ("ondeviceorientationabsolute" in window) listener.push(["deviceorientationabsolute", onAbsolut]);
    listener.forEach(([typ, fn]) => window.addEventListener(typ, fn));
  } catch (e) { kompassStatus = "keiner"; zeichneStatus(); return; }
  keinKompassTimer = setTimeout(() => { if (kompassStatus === "wartet") { kompassStatus = "keiner"; zeichneStatus(); } }, 3000);
}
function stoppeKompass(){
  if (listener) listener.forEach(([typ, fn]) => window.removeEventListener(typ, fn));
  listener = null; clearTimeout(keinKompassTimer); heading = null;
  if (kompassStatus === "aktiv" || kompassStatus === "wartet") kompassStatus = "aus";
}

/* ───────── Standort ───────── */
function bestimmeStandort(){
  const st = document.getElementById("q-ort-status");
  if (!("geolocation" in navigator)) { if (st) st.textContent = "Dieses Gerät kann den Standort nicht bestimmen. Wähle unten deine Stadt."; return; }
  if (st) st.textContent = "Standort wird bestimmt … (GPS funktioniert auch ohne Internet, braucht aber freie Sicht zum Himmel)";
  navigator.geolocation.getCurrentPosition(p => {
    speichereOrt({lat: p.coords.latitude, lon: p.coords.longitude, name: "Mein Standort (GPS)", quelle: "gps", genau: Math.round(p.coords.accuracy), zeit: Date.now()});
    neuZeichnen();
  }, err => {
    if (st) st.textContent = err.code === 1
      ? "Standortzugriff wurde nicht erlaubt. Erlaube ihn in den Einstellungen (iPhone: Einstellungen → Datenschutz → Ortungsdienste → Safari-Websites) oder wähle unten deine Stadt."
      : "Der Standort konnte gerade nicht bestimmt werden. Versuch es draußen noch einmal oder wähle unten deine Stadt.";
  }, {enableHighAccuracy: true, timeout: 20000, maximumAge: 10 * 60 * 1000});
}

/* ───────── Gebetszeiten (Köln, Diyanet/DITIB) ───────── */
const GEBETE = [["Fadschr","الفجر"],["Sonnenaufgang","الشروق"],["Ẓuhr","الظهر"],["ʿAṣr","العصر"],["Maghrib","المغرب"],["ʿIschāʾ","العشاء"]];
const pad2 = n => String(n).padStart(2, "0");
const tagKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const minOf = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
let uhr = null, angezeigterTag = null;
function naechstes(){
  const Z = window.GEBETSZEITEN; if (!Z) return null;
  const now = new Date(), t = Z.tage[tagKey(now)]; if (!t) return null;
  const jetzt = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  for (let i = 0; i < 6; i++) {
    const m = minOf(t[i + 1]);
    if (m > jetzt) return {i, morgen: false, zeit: t[i + 1], bis: m - jetzt, aktuell: i === 0 ? 5 : i - 1};
  }
  const mo = new Date(now); mo.setDate(mo.getDate() + 1);
  const t2 = Z.tage[tagKey(mo)];
  return t2 ? {i: 0, morgen: true, zeit: t2[1], bis: 24 * 60 - jetzt + minOf(t2[1]), aktuell: 5} : {i: -1, aktuell: 5};
}
function dauer(min){
  min = Math.ceil(min);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} Std. ${m} Min.` : `${m} Min.`;
}
function naechstesText(n){
  if (!n || n.i < 0) return "";
  return `Nächstes: <b>${GEBETE[n.i][0]}${n.morgen ? " (morgen)" : ""}</b> um ${n.zeit} Uhr · in ${dauer(n.bis)}`;
}
function gebetHtml(){
  const Z = window.GEBETSZEITEN; if (!Z) return "";
  const now = new Date(), k = tagKey(now), t = Z.tage[k];
  angezeigterTag = k;
  if (!t) return `<div class="card g-card"><div class="block-label">Gebetszeiten Köln</div>
    <p>Für heute sind keine Zeiten gespeichert (gespeichert: ${Z.von} bis ${Z.bis}). Bitte öffne die App einmal mit Internet, damit sie sich aktualisiert.</p></div>`;
  const n = naechstes(), ber = (Z.berechnet || []).includes(k);
  const datum = now.toLocaleDateString("de-DE", {weekday: "long", day: "numeric", month: "long", year: "numeric"});
  let html = `<div class="card g-card">
    <div class="g-kopf"><div><div class="block-label">Gebetszeiten Köln · DITIB / Diyanet</div>
      <p class="g-datum">${datum}${t[0] ? ` · ${esc(t[0])}` : ""}</p></div>
      <p class="g-next" id="g-next">${naechstesText(n)}</p></div>
    <div class="g-liste" id="g-liste">${GEBETE.map((g, i) => `<div class="g-row${n && !n.morgen && n.i === i ? " next" : ""}${n && n.aktuell === i ? " jetzt" : ""}" data-g="${i}">
      <span class="g-name">${g[0]} <span class="g-ar">${g[1]}</span></span><span class="g-zeit">${t[i + 1]}</span></div>`).join("")}</div>
    <p class="audio-note">ʿAṣr nach Imam Abū Ḥanīfa (doppelte Schattenlänge): ≈ ${t[7]} Uhr · berechnet, ±2 Min.</p>
    ${ber ? `<p class="audio-note">Die Zeiten für diesen Tag fehlen auf der Diyanet-Seite und sind nach der Diyanet-Methode berechnet (Abweichung höchstens 2 Minuten).</p>` : ""}`;
  const monat = k.slice(0, 7), tage = Object.keys(Z.tage).filter(x => x.startsWith(monat));
  const mname = now.toLocaleDateString("de-DE", {month: "long", year: "numeric"});
  html += `<details class="g-monat"><summary>Monatsübersicht ${mname}</summary><div class="g-tabelle"><table>
    <thead><tr><th>Tag</th>${GEBETE.map(g => `<th>${g[0]}</th>`).join("")}</tr></thead><tbody>${tage.map(x => {
      const d = new Date(x + "T12:00:00"), z = Z.tage[x], b = (Z.berechnet || []).includes(x);
      return `<tr${x === k ? ' class="heute"' : ""}><td>${d.toLocaleDateString("de-DE", {weekday: "short", day: "numeric"})}${b ? "*" : ""}</td>${z.slice(1, 7).map(v => `<td>${v}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table></div>
    ${tage.some(x => (Z.berechnet || []).includes(x)) ? `<p class="audio-note">* berechnet nach der Diyanet-Methode (±2 Min.), weil diese Tage auf der Diyanet-Seite fehlen.</p>` : ""}</details>
    <p class="audio-note" style="margin-bottom:0">Quelle: ${esc(Z.quelle)}. Gespeichert bis ${new Date(Z.bis + "T12:00:00").toLocaleDateString("de-DE")} – funktioniert ohne Internet. Die Zeiten gelten für Köln.</p>
  </div>`;
  return html;
}
function tickUhr(){
  if (angezeigterTag && angezeigterTag !== tagKey(new Date())) { neuZeichnen(); return; }
  const n = naechstes(), el = document.getElementById("g-next"); if (!el) return;
  el.innerHTML = naechstesText(n);
  document.querySelectorAll("#g-liste .g-row").forEach(r => {
    const i = +r.dataset.g;
    r.classList.toggle("next", !!n && !n.morgen && n.i === i);
    r.classList.toggle("jetzt", !!n && n.aktuell === i);
  });
}

/* ───────── Darstellung ───────── */
function zifferblatt(){
  let ticks = "";
  for (let a = 0; a < 360; a += 10) {
    const lang = a % 30 === 0, r1 = lang ? 118 : 123;
    const x1 = 150 + r1 * Math.sin(rad(a)), y1 = 150 - r1 * Math.cos(rad(a));
    const x2 = 150 + 130 * Math.sin(rad(a)), y2 = 150 - 130 * Math.cos(rad(a));
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="q-tick${lang ? " lang" : ""}"/>`;
  }
  const lbl = (t, a, cls) => { const x = 150 + 102 * Math.sin(rad(a)), y = 150 - 102 * Math.cos(rad(a)) + 7; return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="q-lbl ${cls || ""}" text-anchor="middle">${t}</text>`; };
  const b = ort ? qiblaRichtung(ort.lat, ort.lon) : 0;
  return `<svg viewBox="0 0 300 300" class="q-svg" role="img" aria-label="Qibla-Kompass">
    <polygon points="150,2 141,20 159,20" class="q-zeiger"/>
    <g id="q-dial" style="transform:rotate(${-anzeigeDrehung}deg)">
      <circle cx="150" cy="150" r="134" class="q-ring" id="q-ring"/>
      ${ticks}
      ${lbl("N", 0, "nord")}${lbl("O", 90)}${lbl("S", 180)}${lbl("W", 270)}
      ${ort ? `<g transform="rotate(${b.toFixed(2)} 150 150)">
        <line x1="150" y1="150" x2="150" y2="62" class="q-nadel"/>
        <rect x="137" y="34" width="26" height="26" rx="2" class="q-kaaba"/>
        <rect x="137" y="40" width="26" height="4" class="q-kaaba-band"/>
      </g>` : ""}
      <circle cx="150" cy="150" r="6" class="q-mitte"/>
    </g>
  </svg>`;
}
function zeichneStatus(){
  const el = document.getElementById("q-kompass-status"); if (!el) return;
  const t = {
    aus: "",
    wartet: "Kompass startet … Halte das Handy flach vor dich.",
    aktiv: "",
    keiner: "Dieses Gerät liefert keine Kompassdaten (z. B. Mac oder Laptop). Richte dich mit der Gradzahl unten aus: Norden ist oben auf der Scheibe.",
    verweigert: "Der Zugriff auf den Kompass wurde nicht erlaubt. Tippe noch einmal auf „Kompass starten“ und erlaube „Bewegung und Ausrichtung“."
  }[kompassStatus];
  el.textContent = t;
  el.hidden = !t;
  const btn = document.getElementById("q-start");
  if (btn) btn.textContent = kompassStatus === "aktiv" ? "Kompass läuft" : "Kompass starten";
}
function aktualisiere(){
  const dial = document.getElementById("q-dial"); if (!dial) return;
  if (heading !== null) {
    anzeigeDrehung += norm180(heading - norm360(anzeigeDrehung));
    dial.style.transform = `rotate(${-anzeigeDrehung}deg)`;
  }
  const hinweis = document.getElementById("q-hinweis"), box = document.getElementById("q-box");
  if (!ort || !hinweis) return;
  const b = qiblaRichtung(ort.lat, ort.lon);
  if (heading === null) { hinweis.textContent = `Qibla: ${Math.round(b)}° von Norden (${himmelsrichtung(b)})`; return; }
  const diff = norm180(b - heading);
  const ok = Math.abs(diff) <= TOLERANZ;
  box.classList.toggle("ok", ok);
  hinweis.textContent = ok ? "✓ Du schaust Richtung Qibla"
    : diff > 0 ? `Dreh dich nach rechts – noch ${Math.round(diff)}°` : `Dreh dich nach links – noch ${Math.round(-diff)}°`;
  if (ok && !warAusgerichtet && navigator.vibrate) navigator.vibrate(60);
  warAusgerichtet = ok;
}

function view(){
  ladeOrt();
  const b = ort ? qiblaRichtung(ort.lat, ort.lon) : null;
  const optionen = STAEDTE.map(([land, liste]) => `<optgroup label="${esc(land)}">${liste.map(([n, la, lo]) =>
    `<option value="${la},${lo},${esc(n)}" ${ort && ort.name === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>`).join("");
  let html = `<div class="view"><h2 class="sec">Gebet &amp; Qibla</h2>
    ${gebetHtml()}
    <h3 id="qibla-kompass">Qibla – die Gebetsrichtung</h3>
    <p class="lead">Der Kompass zeigt dir die Richtung zur Kaaba in Mekka. Er funktioniert ohne Internet: Die Richtung wird auf deinem Gerät berechnet, der Standort kommt vom GPS oder aus der Städteliste.</p>`;
  if (!IN_APP) {
    html += `<div class="app-banner" style="margin:0 0 16px"><p>Den <b>Live-Kompass</b> mit GPS gibt es nur in der Koran-App (claude.ai erlaubt keinen Zugriff auf Sensoren). Hier kannst du die Richtung für deine Stadt nachschlagen.</p>
      <a class="audio-btn" href="${APP_URL}#qibla" target="_blank" rel="noopener">Kompass in der App öffnen</a></div>`;
  }
  html += `<div class="q-wrap">
    <div class="q-box" id="q-box">
      ${zifferblatt()}
      <p class="q-hinweis" id="q-hinweis">${ort ? `Qibla: ${Math.round(b)}° von Norden (${himmelsrichtung(b)})` : "Bestimme zuerst deinen Standort."}</p>
      <p class="audio-note" id="q-kompass-status" hidden></p>
      ${IN_APP ? `<div class="q-actions"><button type="button" class="audio-btn" id="q-start">Kompass starten</button>
        <button type="button" class="audio-btn ghost" id="q-gps">Standort per GPS bestimmen</button></div>` : ""}
    </div>
    <div class="q-info card">
      <div class="block-label">Dein Standort</div>
      <p id="q-ort">${ort ? `<b>${esc(ort.name)}</b><br><span class="audio-note">${Math.abs(ort.lat).toFixed(3)}° ${ort.lat >= 0 ? "N" : "S"}, ${Math.abs(ort.lon).toFixed(3)}° ${ort.lon >= 0 ? "O" : "W"}${ort.genau ? ` · Genauigkeit ± ${ort.genau} m` : ""}</span>` : "Noch kein Standort gewählt."}</p>
      <p class="audio-note" id="q-ort-status"></p>
      <label class="q-label" for="q-stadt">Oder Stadt wählen (funktioniert immer, auch offline):</label>
      <select id="q-stadt"><option value="">– Stadt auswählen –</option>${optionen}</select>
      ${ort ? `<div class="q-werte">
        <div><span class="q-zahl">${Math.round(b)}°</span><span class="audio-note">Qibla von Norden, im Uhrzeigersinn</span></div>
        <div><span class="q-zahl">${himmelsrichtung(b)}</span><span class="audio-note">Himmelsrichtung</span></div>
        <div><span class="q-zahl">${Math.round(entfernungKm(ort.lat, ort.lon)).toLocaleString("de-DE")} km</span><span class="audio-note">bis zur Kaaba</span></div>
      </div>` : ""}
    </div>
  </div>
  <h3>So benutzt du den Kompass</h3>
  <div class="card"><ul class="todo" style="margin:0">
    <li>Tippe auf „Kompass starten“ und erlaube auf dem iPhone den Zugriff auf „Bewegung und Ausrichtung“.</li>
    <li>Halte das Handy <b>flach</b> vor dich und dreh dich langsam, bis die Kaaba oben am Pfeil steht und „✓ Du schaust Richtung Qibla“ erscheint.</li>
    <li>Halte Abstand zu Metall, Lautsprechern und Magnet-Hüllen – sie lenken den Kompass ab. Springt die Anzeige, bewege das Handy einige Male in Form einer liegenden Acht (Kalibrieren).</li>
    <li>Am Mac oder Laptop gibt es keinen Kompass: Nutze die Gradzahl (z. B. 130° = etwas mehr als Südost) zusammen mit einem bekannten Bezug wie dem Sonnenstand.</li>
  </ul></div>
  <div class="hanafibox" style="margin-top:16px"><div class="block-label">Hanafitischer Hinweis</div>
    <p style="margin:0">Wer die Kaaba nicht sieht, muss sich nach hanafitischer Schule auf ihre <b>Richtung (dschiha)</b> ausrichten, nicht auf den exakten Punkt. Kleine Abweichungen machen das Gebet nicht ungültig; die hanafitischen Gelehrten erlauben einen Spielraum, solange man noch zur Seite der Kaaba hin gewandt ist. Der Prophet ﷺ sagte zu den Leuten Medinas: „Was zwischen Osten und Westen liegt, ist Qibla“ (at-Tirmidhī, Nr. 342; hasan) – für Medina liegt Mekka im Süden. Ein Kompass, der ein paar Grad abweicht, ist also kein Problem. Hast du dich nach bestem Bemühen (taḥarrī) ausgerichtet und stellst später einen Fehler fest, ist dein Gebet gültig.</p></div>
  </div>`;
  return html;
}
function neuZeichnen(){
  if (typeof window.render === "function") { const y = window.scrollY; window.render(); window.scrollTo(0, y); }
}
function bind(root){
  zeichneStatus();
  const s = root.querySelector("#q-start"); if (s) s.onclick = () => { starteKompass(); if (!ort) bestimmeStandort(); };
  const g = root.querySelector("#q-gps"); if (g) g.onclick = bestimmeStandort;
  const sel = root.querySelector("#q-stadt");
  if (sel) sel.onchange = () => {
    if (!sel.value) return;
    const [la, lo, ...n] = sel.value.split(",");
    speichereOrt({lat: +la, lon: +lo, name: n.join(","), quelle: "stadt", zeit: Date.now()});
    neuZeichnen();
  };
  aktualisiere();
  clearInterval(uhr); uhr = setInterval(tickUhr, 20000);
}
function leave(){ stoppeKompass(); kompassStatus = "aus"; clearInterval(uhr); uhr = null; }

window.KIK_QIBLA = {view, bind, leave, qiblaRichtung, entfernungKm, naechstes, isActive: () => !!listener};
})();

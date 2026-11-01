// Rezitation Vers für Vers (Mishary Alafasy, everyayah.com), Duʿā-Aufnahmen (Ḥiṣn al-Muslim, hisnmuslim.com)
// und Offline-Speicher. Auf claude.ai blockiert die Plattform fremdes Audio – dort führen die Knöpfe in die Web-App.
(function(){
"use strict";
const RECITER_NAME = "Mishary Alafasy";
const PAGES_URL = "https://ektmedien.github.io/koran-im-kontext/";
const BASE = "https://everyayah.com/data/Alafasy_64kbps/";
const HISN_BASE = "https://www.hisnmuslim.com/audio/ar/";
const CACHE = "kik-audio-alafasy64-v1";
const BYTES_PER_CHAR = 1207;
const DUA_MB = 80;
const host = location.hostname;
const AUDIO_OK = location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host.endsWith("github.io");
const OFFLINE_OK = AUDIO_OK && location.protocol.startsWith("http") && "caches" in window;

const pad = n => String(n).padStart(3, "0");
const urlFor = (s, v) => BASE + pad(s) + pad(v) + ".mp3";
const hisnUrl = id => HISN_BASE + id + ".mp3";
const itemUrl = it => it.url || urlFor(it.s, it.v);
const quranCom = (s, v) => "https://quran.com/" + s + (v ? "/" + v : "");
const sure = s => window.SUREN.find(x => x.n === s) || {v: 0, name: "Sure " + s};
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function suraUrls(s){
  const out = [];
  if (s !== 1 && s !== 9) out.push(urlFor(1, 1));
  for (let v = 1; v <= sure(s).v; v++) out.push(urlFor(s, v));
  return out;
}
function koranUrls(){ const all = []; for (let s = 1; s <= 114; s++) all.push(...suraUrls(s)); return [...new Set(all)]; }
function parseRef(ref){
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(ref || ""); if (!m) return null;
  return {s: +m[1], a: +m[2], b: +(m[3] || m[2])};
}
function duaUrls(){
  const out = [];
  ((window.DUAS || {}).kategorien || []).forEach(k => k.items.forEach(d => {
    if (d.hisn) out.push(hisnUrl(d.hisn));
    const r = parseRef(d.ref); if (r) for (let v = r.a; v <= r.b; v++) out.push(urlFor(r.s, v));
  }));
  return [...new Set(out)];
}
function suraMB(s){
  const t = (window.SURATEXT || {})[s];
  if (!t) return 0;
  return t.reduce((a, v) => a + v.a.length, 0) * BYTES_PER_CHAR / 1e6;
}
function koranMB(){ let t = 0; for (let s = 1; s <= 114; s++) t += suraMB(s); return t; }
function fmtMB(mb){ return mb >= 1000 ? (mb/1000).toFixed(1).replace(".", ",") + " GB" : (mb < 1 ? "<1" : Math.round(mb)) + " MB"; }

/* ───────── Cache-Status ───────── */
let cachedSet = new Set();
let cacheLoaded = false;
async function loadCached(){
  if (!OFFLINE_OK) { cacheLoaded = true; return cachedSet; }
  try {
    const c = await caches.open(CACHE);
    cachedSet = new Set((await c.keys()).map(r => r.url));
  } catch (e) { cachedSet = new Set(); }
  cacheLoaded = true;
  return cachedSet;
}
function suraSaved(s){ return suraUrls(s).every(u => cachedSet.has(u)); }
function savedSuraCount(){ let n = 0; for (let s = 1; s <= 114; s++) if (suraSaved(s)) n++; return n; }
function savedCount(urls){ return urls.filter(u => cachedSet.has(u)).length; }

/* ───────── Player ───────── */
const audio = new Audio();
audio.preload = "auto";
let queue = [], qi = -1, blobUrl = null, repeatOne = false, playing = false;

async function srcFor(url){
  if (OFFLINE_OK && cachedSet.has(url)) {
    try {
      const r = await (await caches.open(CACHE)).match(url);
      if (r) {
        const b = await r.blob();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = URL.createObjectURL(b);
        return blobUrl;
      }
    } catch (e) {}
  }
  return url;
}
async function playIndex(i){
  if (i < 0 || i >= queue.length) { stop(); return; }
  qi = i;
  audio.src = await srcFor(itemUrl(queue[i]));
  try { await audio.play(); playing = true; }
  catch (e) { playing = false; toast("Wiedergabe nicht möglich. Tippe noch einmal auf ▶."); }
  updateUI(true);
}
audio.addEventListener("ended", () => {
  if (repeatOne) { audio.currentTime = 0; audio.play().catch(()=>{}); return; }
  if (qi < queue.length - 1) playIndex(qi + 1); else stop();
});
audio.addEventListener("error", () => {
  if (!audio.src) return;
  toast(navigator.onLine === false
    ? "Du bist offline und diese Aufnahme ist noch nicht gespeichert. Speichere sie vorher unter „Offline & Audio“."
    : "Die Aufnahme konnte nicht geladen werden. Prüfe deine Internetverbindung.");
  playing = false; updateUI(false);
});
audio.addEventListener("pause", () => { playing = false; updateUI(false); });
audio.addEventListener("play", () => { playing = true; updateUI(false); });

function playVerses(list, start){ queue = list; playIndex(start || 0); }
function playSura(s, fromV){
  fromV = fromV || 1;
  const list = [];
  if (fromV === 1 && s !== 1 && s !== 9) list.push({s: 1, v: 1, basmalaFor: s});
  for (let v = fromV; v <= sure(s).v; v++) list.push({s, v});
  const d = document.querySelector(`details.sura-text[data-sura="${s}"]`);
  if (d) d.open = true;
  playVerses(list, 0);
}
function playOne(s, v){ queue = [{s, v}]; playIndex(0); }
function findDua(id){
  for (const k of ((window.DUAS || {}).kategorien || [])) for (const d of k.items) if (d.id === id) return d;
  return null;
}
function playDua(id){
  const d = findDua(id); if (!d) return;
  const list = [];
  if (d.hisn) list.push({url: hisnUrl(d.hisn), label: d.titel, dua: d.id, sub: "Aufnahme: Ḥiṣn al-Muslim"});
  else { const r = parseRef(d.ref); if (r) for (let v = r.a; v <= r.b; v++) list.push({s: r.s, v, label: d.titel, dua: d.id}); }
  if (list.length) playVerses(list, 0);
}
function toggle(){
  if (!queue.length) return;
  if (audio.paused) audio.play().catch(()=>{}); else audio.pause();
}
function stop(){
  audio.pause(); audio.removeAttribute("src"); audio.load();
  queue = []; qi = -1; playing = false;
  if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
  updateUI(false);
}
function next(){ if (qi < queue.length - 1) playIndex(qi + 1); }
function prev(){ if (qi > 0) playIndex(qi - 1); else if (qi === 0) { audio.currentTime = 0; } }

/* ───────── Mini-Player & Toast ───────── */
let player, toastEl, toastTimer;
function ensurePlayer(){
  if (player) return;
  player = document.createElement("div");
  player.id = "kik-player";
  player.hidden = true;
  player.innerHTML = `<div class="kp-info"><span class="kp-title"></span><span class="kp-sub"></span></div>
    <div class="kp-ctrl">
      <button type="button" data-kp="prev" aria-label="Zurück">⏮</button>
      <button type="button" data-kp="toggle" aria-label="Pause oder Weiter" class="kp-main">⏸</button>
      <button type="button" data-kp="next" aria-label="Weiter">⏭</button>
      <button type="button" data-kp="repeat" aria-label="Wiederholen" class="kp-repeat">🔁</button>
      <button type="button" data-kp="stop" aria-label="Stoppen">✕</button>
    </div>`;
  document.body.appendChild(player);
  player.addEventListener("click", e => {
    const b = e.target.closest("[data-kp]"); if (!b) return;
    const k = b.dataset.kp;
    if (k === "prev") prev(); else if (k === "next") next(); else if (k === "toggle") toggle();
    else if (k === "stop") stop();
    else if (k === "repeat") { repeatOne = !repeatOne; updateUI(false); toast(repeatOne ? "Wird wiederholt – ideal zum Auswendiglernen." : "Wiederholen aus."); }
  });
  toastEl = document.createElement("div");
  toastEl.id = "kik-toast"; toastEl.hidden = true; toastEl.setAttribute("role", "status");
  document.body.appendChild(toastEl);
}
function toast(msg){
  ensurePlayer();
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
}
function updateUI(scroll){
  ensurePlayer();
  document.querySelectorAll(".verse-item.playing, .dua-card.playing").forEach(x => x.classList.remove("playing"));
  const it = queue[qi];
  if (!it) { player.hidden = true; document.body.classList.remove("kp-open"); return; }
  player.hidden = false; document.body.classList.add("kp-open");
  let title;
  if (it.label) title = it.label + (it.url ? "" : ` · ${it.s}:${it.v}`);
  else if (it.basmalaFor) title = sure(it.basmalaFor).name + " · Basmala";
  else title = sure(it.s).name + " " + it.s + ":" + it.v;
  player.querySelector(".kp-title").textContent = title;
  player.querySelector(".kp-sub").textContent = (it.sub || RECITER_NAME) + (queue.length > 1 ? ` · ${qi + 1}/${queue.length}` : "") + (cachedSet.has(itemUrl(it)) ? " · offline" : "");
  player.querySelector(".kp-main").textContent = playing ? "⏸" : "▶";
  player.querySelector(".kp-repeat").classList.toggle("on", repeatOne);
  let target = null;
  if (it.dua) target = document.getElementById("dua-" + it.dua);
  else if (!it.basmalaFor) target = document.querySelector(`[data-vk="${it.s}:${it.v}"]`);
  if (target) {
    target.classList.add("playing");
    if (scroll && queue.length > 1 && !it.dua) target.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center"});
  }
}

/* ───────── Offline speichern ───────── */
let job = null;
async function saveUrls(urls, onProgress){
  const c = await caches.open(CACHE);
  if (!cacheLoaded) await loadCached();
  const todo = urls.filter(u => !cachedSet.has(u));
  let done = urls.length - todo.length, failed = 0, i = 0;
  onProgress(done, urls.length);
  async function worker(){
    while (i < todo.length) {
      if (job && job.cancel) return;
      const u = todo[i++];
      try {
        const r = await fetch(u, {mode: "cors"});
        if (r.ok) { await c.put(u, r); cachedSet.add(u); } else failed++;
      } catch (e) { failed++; }
      done++; onProgress(done, urls.length);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return failed;
}
async function askPersist(){
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
}
async function saveSura(s){
  if (!OFFLINE_OK || job) return;
  job = {s, cancel: false};
  await askPersist();
  const failed = await saveUrls(suraUrls(s), (d, t) => setSuraState(s, `Speichert … ${d}/${t}`));
  job = null;
  setSuraState(s);
  if (failed) toast(`${failed} Verse konnten nicht gespeichert werden. Versuch es mit stabiler Verbindung noch einmal.`);
  else toast(`${sure(s).name} ist jetzt offline verfügbar.`);
  rerender();
}
const SETS = {
  koran: {urls: koranUrls, name: "Koran", done: "Der ganze Koran ist offline gespeichert. Māschāʾ Allāh!"},
  duas: {urls: duaUrls, name: "Duʿās", done: "Alle Duʿā-Aufnahmen sind offline gespeichert."},
};
async function saveSet(kind){
  if (!OFFLINE_OK || job) return;
  job = {s: kind, cancel: false};
  rerender();
  await askPersist();
  const failed = await saveUrls(SETS[kind].urls(), (d, t) => setSetState(kind, d, t));
  const cancelled = job && job.cancel;
  job = null;
  rerender();
  if (cancelled) toast("Speichern angehalten. Bereits Gespeichertes bleibt erhalten.");
  else if (failed) toast(`${failed} Aufnahmen fehlen noch – tippe erneut auf den Knopf, dann werden nur die fehlenden geladen.`);
  else toast(SETS[kind].done);
}
function cancelJob(){ if (job) job.cancel = true; }
async function deleteAll(){
  if (!OFFLINE_OK) return;
  await caches.delete(CACHE);
  cachedSet = new Set();
  rerender();
  toast("Gespeicherte Aufnahmen wurden gelöscht.");
}
function setSuraState(s, text){
  document.querySelectorAll(`[data-sura-state="${s}"]`).forEach(x => {
    x.textContent = text || (suraSaved(s) ? "✓ offline gespeichert" : "");
  });
  document.querySelectorAll(`[data-save-sura="${s}"]`).forEach(b => {
    b.hidden = !text && suraSaved(s);
    b.disabled = !!text;
  });
}
function setSetState(kind, d, t){
  const pct = Math.round(100 * d / t);
  document.querySelectorAll(`[data-set-bar="${kind}"]`).forEach(b => b.style.width = pct + "%");
  document.querySelectorAll(`[data-set-progress="${kind}"]`).forEach(x => x.textContent = `Speichert … ${d} von ${t} Aufnahmen (${pct} %) – bitte die App geöffnet lassen.`);
}
function rerender(){
  if (typeof window.render === "function") { const y = window.scrollY; window.render(); window.scrollTo(0, y); }
}

/* ───────── HTML-Bausteine für index.html ───────── */
function offlineWidget(kind){
  if (!OFFLINE_OK) return "";
  const urls = SETS[kind].urls();
  const n = savedCount(urls), all = n === urls.length, running = job && job.s === kind;
  const label = kind === "koran" ? `⬇ Ganzen Koran offline speichern (≈ ${fmtMB(koranMB())})` : `⬇ Alle Duʿā-Aufnahmen offline speichern (≈ ${DUA_MB} MB)`;
  const status = kind === "koran" ? `${savedSuraCount()} von 114 Suren offline gespeichert` : `${n} von ${urls.length} Duʿā-Aufnahmen offline gespeichert`;
  return `<div class="off-widget">
    <p class="off-status">${all ? "✓ " : ""}${status}</p>
    <div class="progress"><div data-set-bar="${kind}" style="width:${Math.round(100 * n / Math.max(1, urls.length))}%"></div></div>
    <p class="audio-note" data-set-progress="${kind}">${running ? "Speichert …" : ""}</p>
    ${running ? `<button type="button" class="audio-btn ghost" data-off="cancel">Anhalten</button>`
      : all ? "" : `<button type="button" class="audio-btn" data-off="${kind}" ${job ? "disabled" : ""}>${label}</button>`}
  </div>`;
}
function startCard(){
  if (!AUDIO_OK) return "";
  if (!OFFLINE_OK) return "";
  return `<div class="card start-off"><p style="margin-top:0"><b>Offline nutzen:</b> Speichere die Rezitation des ganzen Korans und alle Duʿā-Aufnahmen mit einem Klick – danach funktioniert alles ohne Internet. Am besten im WLAN.</p>
    ${offlineWidget("koran")}${offlineWidget("duas")}</div>`;
}
function suraToolbar(s){
  if (!AUDIO_OK) {
    return `<div class="audio-bar"><a class="audio-btn" href="${PAGES_URL}#l-${s}" target="_blank" rel="noopener">▶ In der App anhören</a>
      <span class="audio-note">Öffnet diese Lektion in der Koran-App, wo du Vers für Vers hören und offline speichern kannst.</span></div>`;
  }
  return `<div class="audio-bar">
    <button type="button" class="audio-btn" data-play-sura="${s}">▶ Ganze Sure anhören</button>
    ${OFFLINE_OK ? `<button type="button" class="audio-btn ghost" data-save-sura="${s}">⬇ Offline speichern (≈ ${fmtMB(suraMB(s))})</button>` : ""}
    <span class="audio-note" data-sura-state="${s}"></span>
    <span class="audio-note">Rezitation: ${RECITER_NAME}</span></div>`;
}
function verseActions(s, v){
  if (!AUDIO_OK) return `<div class="v-actions"><a class="v-play" href="${PAGES_URL}#l-${s}" target="_blank" rel="noopener">▶ in der App</a></div>`;
  return `<div class="v-actions"><button type="button" class="v-play" data-play-v="${s}:${v}" aria-label="Vers ${s}:${v} anhören">▶ Anhören</button><a class="v-link" href="${quranCom(s, v)}" target="_blank" rel="noopener">quran.com ↗</a></div>`;
}
function duaActions(d){
  const hasAudio = !!(d.hisn || parseRef(d.ref));
  if (!hasAudio) return `<span class="audio-note">Für diese Duʿā gibt es keine Aufnahme.</span>`;
  if (!AUDIO_OK) return `<a class="v-play" href="${PAGES_URL}#dua-${d.id}" target="_blank" rel="noopener">▶ In der App anhören</a>`;
  const label = d.hisn ? "▶ Aussprache anhören" : "▶ Rezitation anhören";
  const r = parseRef(d.ref);
  return `<span class="v-actions"><button type="button" class="v-play" data-play-dua="${d.id}">${label}</button>${r ? `<a class="v-link" href="${quranCom(r.s, r.a)}" target="_blank" rel="noopener">quran.com ↗</a>` : ""}${d.audio_voll ? `<span class="audio-note">Die Aufnahme enthält den vollständigen Text aus dem Ḥiṣn al-Muslim.</span>` : ""}</span>`;
}
function verseRangeActions(ref, duaId){
  const d = duaId && findDua(duaId);
  return d ? duaActions(d) : "";
}
function banner(){
  if (AUDIO_OK) return "";
  return `<div class="app-banner"><p><b>Hinweis:</b> Dies ist die Lese-Vorschau auf claude.ai. Hier kann nichts abgespielt und nichts offline gespeichert werden.
    Zum <b>Hören</b> (Verse und Duʿās) und für die <b>Offline-Nutzung</b> auf iPhone und Mac öffne die Koran-App:</p>
    <a class="audio-btn" href="${PAGES_URL}" target="_blank" rel="noopener">Koran-App öffnen</a>
    <span class="audio-note copy-url"><code>${PAGES_URL}</code></span></div>`;
}
function bind(root){
  ensurePlayer();
  root.querySelectorAll("[data-play-sura]").forEach(b => b.onclick = () => playSura(+b.dataset.playSura));
  root.querySelectorAll("[data-play-v]").forEach(b => b.onclick = () => { const [s, v] = b.dataset.playV.split(":").map(Number); playOne(s, v); });
  root.querySelectorAll("[data-play-dua]").forEach(b => b.onclick = () => playDua(b.dataset.playDua));
  root.querySelectorAll("[data-save-sura]").forEach(b => b.onclick = () => saveSura(+b.dataset.saveSura));
  const after = () => root.querySelectorAll("[data-sura-state]").forEach(x => setSuraState(+x.dataset.suraState, job && job.s === +x.dataset.suraState ? "Speichert …" : ""));
  if (cacheLoaded) after(); else loadCached().then(() => { after(); if (root.querySelector(".off-widget")) rerender(); });
  updateUI(false);
  root.querySelectorAll("[data-off]").forEach(b => b.onclick = () => {
    const k = b.dataset.off;
    if (k === "koran" || k === "duas") saveSet(k);
    else if (k === "cancel") cancelJob();
    else if (k === "delete") {
      if (b.dataset.confirm === "1") deleteAll();
      else { b.dataset.confirm = "1"; b.textContent = "Wirklich löschen? Nochmal tippen"; setTimeout(() => { b.dataset.confirm = ""; b.textContent = "Alle gespeicherten Aufnahmen löschen"; }, 4000); }
    }
  });
  const st = root.querySelector("#off-storage");
  if (st && navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(e => {
      if (e && e.usage != null) st.textContent = `Belegter Speicher dieser App: ${fmtMB(e.usage / 1e6)}` + (e.quota ? ` · verfügbar: ${fmtMB(e.quota / 1e6)}` : "");
    }).catch(() => {});
  }
}

/* ───────── Ansicht „Offline & Audio“ ───────── */
function viewOffline(){
  if (!AUDIO_OK) {
    return `<div class="view"><h2 class="sec">Offline &amp; Audio</h2>
      <p class="lead">Diese claude.ai-Vorschau kann technisch weder Audio abspielen noch offline laufen. Beides kann die Koran-App:</p>
      <div class="card"><p style="margin-top:0"><a class="audio-btn" href="${PAGES_URL}" target="_blank" rel="noopener">Koran-App öffnen</a></p>
      <p class="copy-url"><code>${PAGES_URL}</code></p>
      <p><b>iPhone:</b> Adresse in Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“. Danach immer über das neue Symbol starten.</p>
      <p style="margin-bottom:0"><b>Mac:</b> Adresse in Safari öffnen → Menü „Ablage“ → „Zum Dock hinzufügen“.</p></div></div>`;
  }
  let html = `<div class="view"><h2 class="sec">Offline &amp; Audio</h2>
    <p class="lead">Die Koran-Rezitation von <b>${RECITER_NAME}</b> läuft Vers für Vers, die Duʿās haben Original-Aufnahmen aus dem Ḥiṣn al-Muslim. Online wird direkt abgespielt; Gespeichertes spielt auch ohne Internet – im Flugzeug, in der Moschee, unterwegs.</p>`;
  if (!OFFLINE_OK) {
    html += `<div class="hinweis">Offline-Speichern funktioniert nur, wenn die App über ihre Web-Adresse geöffnet wird (nicht als lokale Datei).</div></div>`;
    return html;
  }
  html += `<div class="card off-card">
      <h3 style="margin-top:0">Ganzer Koran</h3>${offlineWidget("koran")}
      <h3>Alle Duʿās</h3>${offlineWidget("duas")}
      <p class="audio-note" id="off-storage"></p>
      <div class="off-actions"><button type="button" class="audio-btn ghost" data-off="delete">Alle gespeicherten Aufnahmen löschen</button></div>
      <p class="audio-note">Tipp: Speichere im WLAN und lass die App dabei geöffnet. Der ganze Koran dauert je nach Verbindung 20–60 Minuten. Abgebrochenes Speichern setzt beim nächsten Tippen dort fort, wo es aufgehört hat.</p>
    </div>
    <h3>Einzelne Suren speichern</h3>
    <div class="card off-list">`;
  for (let s = 1; s <= 114; s++) {
    html += `<div class="off-row"><span class="off-name">${s}. ${esc(sure(s).name)}</span>
      <span class="audio-note" data-sura-state="${s}"></span>
      <button type="button" class="audio-btn ghost small" data-save-sura="${s}">⬇ ${fmtMB(suraMB(s))}</button></div>`;
  }
  html += `</div>
    <h3>So nutzt du die App offline</h3>
    <div class="card"><p style="margin-top:0"><b>iPhone:</b> Öffne die App in Safari → Teilen-Symbol → „Zum Home-Bildschirm“. Starte sie dann immer über das neue Symbol und speichere dort (gespeicherte Daten gehören zu diesem Symbol, nicht zu Safari).</p>
    <p style="margin-bottom:0"><b>Mac:</b> Öffne die App in Safari → Menü „Ablage“ → „Zum Dock hinzufügen“ (oder in Chrome: Installieren-Symbol in der Adresszeile). Danach startet sie wie ein Programm, auch ohne Internet.</p></div>
  </div>`;
  return html;
}

window.KIK_AUDIO = {AUDIO_OK, OFFLINE_OK, PAGES_URL, suraToolbar, verseActions, verseRangeActions, duaActions, offlineWidget, startCard, banner, bind, viewOffline, playSura, stop};
})();

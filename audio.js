// Rezitation Vers für Vers (Mishary Alafasy, everyayah.com) und Offline-Speicher.
// Auf claude.ai blockiert die Plattform fremdes Audio – dort gibt es nur quran.com-Links.
(function(){
"use strict";
const RECITER_NAME = "Mishary Alafasy";
const BASE = "https://everyayah.com/data/Alafasy_64kbps/";
const CACHE = "kik-audio-alafasy64-v1";
const BYTES_PER_CHAR = 1207;
const host = location.hostname;
const AUDIO_OK = location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host.endsWith("github.io");
const OFFLINE_OK = AUDIO_OK && location.protocol.startsWith("http") && "caches" in window;

const pad = n => String(n).padStart(3, "0");
const urlFor = (s, v) => BASE + pad(s) + pad(v) + ".mp3";
const quranCom = (s, v) => "https://quran.com/" + s + (v ? "/" + v : "");
const sure = s => window.SUREN.find(x => x.n === s) || {v: 0, name: "Sure " + s};
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function suraUrls(s){
  const out = [];
  if (s !== 1 && s !== 9) out.push(urlFor(1, 1));
  for (let v = 1; v <= sure(s).v; v++) out.push(urlFor(s, v));
  return out;
}
function suraMB(s){
  const t = (window.SURATEXT || {})[s];
  if (!t) return 0;
  return t.reduce((a, v) => a + v.a.length, 0) * BYTES_PER_CHAR / 1e6;
}
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
  const it = queue[i];
  audio.src = await srcFor(urlFor(it.s, it.v));
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
    ? "Du bist offline und diese Sure ist noch nicht gespeichert. Speichere sie vorher unter „Offline & Audio“."
    : "Die Rezitation konnte nicht geladen werden. Prüfe deine Internetverbindung.");
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
function playOne(s, v){
  queue = [{s, v}]; playIndex(0);
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
      <button type="button" data-kp="prev" aria-label="Vorheriger Vers">⏮</button>
      <button type="button" data-kp="toggle" aria-label="Pause oder Weiter" class="kp-main">⏸</button>
      <button type="button" data-kp="next" aria-label="Nächster Vers">⏭</button>
      <button type="button" data-kp="repeat" aria-label="Vers wiederholen" class="kp-repeat">🔁</button>
      <button type="button" data-kp="stop" aria-label="Stoppen">✕</button>
    </div>`;
  document.body.appendChild(player);
  player.addEventListener("click", e => {
    const b = e.target.closest("[data-kp]"); if (!b) return;
    const k = b.dataset.kp;
    if (k === "prev") prev(); else if (k === "next") next(); else if (k === "toggle") toggle();
    else if (k === "stop") stop();
    else if (k === "repeat") { repeatOne = !repeatOne; updateUI(false); toast(repeatOne ? "Vers wird wiederholt – ideal zum Auswendiglernen." : "Wiederholen aus."); }
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
  const S = sure(it.basmalaFor || it.s);
  player.querySelector(".kp-title").textContent = it.basmalaFor ? S.name + " · Basmala" : sure(it.s).name + " " + it.s + ":" + it.v;
  player.querySelector(".kp-sub").textContent = RECITER_NAME + (queue.length > 1 ? ` · ${qi + 1}/${queue.length}` : "") + (cachedSet.has(urlFor(it.s, it.v)) ? " · offline" : "");
  player.querySelector(".kp-main").textContent = playing ? "⏸" : "▶";
  player.querySelector(".kp-repeat").classList.toggle("on", repeatOne);
  if (!it.basmalaFor) {
    const v = document.querySelector(`[data-vk="${it.s}:${it.v}"]`);
    if (v) {
      v.classList.add("playing");
      if (scroll && queue.length > 1) v.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center"});
    }
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
  refreshOfflineView();
}
async function saveAll(){
  if (!OFFLINE_OK || job) return;
  job = {s: "all", cancel: false};
  refreshOfflineView();
  await askPersist();
  const all = [];
  for (let s = 1; s <= 114; s++) all.push(...suraUrls(s));
  const uniq = [...new Set(all)];
  let failed = await saveUrls(uniq, (d, t) => setAllState(d, t));
  const cancelled = job && job.cancel;
  job = null;
  refreshOfflineView();
  if (cancelled) toast("Speichern angehalten. Bereits gespeicherte Verse bleiben erhalten.");
  else if (failed) toast(`${failed} Verse fehlen noch – tippe erneut auf „Alles speichern“, um nur die fehlenden zu laden.`);
  else toast("Alle 114 Suren sind offline gespeichert. Māschāʾ Allāh!");
}
function cancelJob(){ if (job) job.cancel = true; }
async function deleteAll(){
  if (!OFFLINE_OK) return;
  await caches.delete(CACHE);
  cachedSet = new Set();
  refreshOfflineView();
  document.querySelectorAll("[data-sura-state]").forEach(x => setSuraState(+x.dataset.suraState));
  toast("Gespeicherte Rezitationen wurden gelöscht.");
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
function setAllState(d, t){
  const bar = document.getElementById("off-bar"), txt = document.getElementById("off-progress");
  if (bar) bar.style.width = Math.round(100 * d / t) + "%";
  if (txt) txt.textContent = `Speichert … ${d} von ${t} Versen (${Math.round(100 * d / t)} %)`;
}

/* ───────── HTML-Bausteine für index.html ───────── */
function suraToolbar(s){
  if (!AUDIO_OK) {
    return `<div class="audio-bar"><a class="audio-btn" href="${quranCom(s)}" target="_blank" rel="noopener">▶ Auf quran.com anhören ↗</a>
      <span class="audio-note">Vers für Vers hören und offline speichern kannst du in der Web-App-Version (siehe „Offline &amp; Audio“).</span></div>`;
  }
  return `<div class="audio-bar">
    <button type="button" class="audio-btn" data-play-sura="${s}">▶ Ganze Sure anhören</button>
    ${OFFLINE_OK ? `<button type="button" class="audio-btn ghost" data-save-sura="${s}">⬇ Offline speichern (≈ ${fmtMB(suraMB(s))})</button>` : ""}
    <span class="audio-note" data-sura-state="${s}"></span>
    <span class="audio-note">Rezitation: ${RECITER_NAME}</span></div>`;
}
function verseActions(s, v){
  return `<div class="v-actions">${AUDIO_OK ? `<button type="button" class="v-play" data-play-v="${s}:${v}" aria-label="Vers ${s}:${v} anhören">▶</button>` : ""}<a class="v-link" href="${quranCom(s, v)}" target="_blank" rel="noopener">quran.com ↗</a></div>`;
}
function verseRangeActions(ref){
  // ref: "2:201" oder "2:285-286"
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(ref || ""); if (!m) return "";
  const s = +m[1], a = +m[2], b = +(m[3] || m[2]);
  return `<div class="v-actions">${AUDIO_OK ? `<button type="button" class="v-play" data-play-range="${s}:${a}-${b}" aria-label="Koranvers ${esc(ref)} anhören">▶ Rezitation</button>` : ""}<a class="v-link" href="${quranCom(s, a)}" target="_blank" rel="noopener">quran.com ↗</a></div>`;
}
function bind(root){
  ensurePlayer();
  root.querySelectorAll("[data-play-sura]").forEach(b => b.onclick = () => playSura(+b.dataset.playSura));
  root.querySelectorAll("[data-play-v]").forEach(b => b.onclick = () => { const [s, v] = b.dataset.playV.split(":").map(Number); playOne(s, v); });
  root.querySelectorAll("[data-play-range]").forEach(b => b.onclick = () => {
    const [s, r] = b.dataset.playRange.split(":"); const [a, z] = r.split("-").map(Number);
    const list = []; for (let v = a; v <= z; v++) list.push({s: +s, v}); playVerses(list, 0);
  });
  root.querySelectorAll("[data-save-sura]").forEach(b => b.onclick = () => saveSura(+b.dataset.saveSura));
  const after = () => root.querySelectorAll("[data-sura-state]").forEach(x => setSuraState(+x.dataset.suraState, job && job.s === +x.dataset.suraState ? "Speichert …" : ""));
  if (cacheLoaded) after(); else loadCached().then(after);
  updateUI(false);
  bindOffline(root);
}

/* ───────── Ansicht „Offline & Audio“ ───────── */
function viewOffline(){
  const PAGES_URL = "https://ektmedien.github.io/koran-im-kontext/";
  if (!AUDIO_OK) {
    return `<div class="view"><h2 class="sec">Offline &amp; Audio</h2>
      <p class="lead">In dieser Version (claude.ai) lassen sich keine fremden Audiodateien abspielen. Jeder Vers hat deshalb einen Link zu quran.com, dort hörst du ihn sofort.</p>
      <div class="card"><p style="margin-top:0"><b>Vers für Vers hören und alles offline nutzen</b> – auf Mac und iPhone – kannst du in der Web-App-Version:</p>
      <p class="copy-url"><code>${PAGES_URL}</code></p>
      <p style="margin-bottom:0">Öffne die Adresse in Safari. Auf dem iPhone: Teilen → „Zum Home-Bildschirm“. Auf dem Mac: Ablage → „Zum Dock hinzufügen“. Danach lädt die App auch ohne Internet.</p></div></div>`;
  }
  const used = OFFLINE_OK ? savedSuraCount() : 0;
  const total = Array.from({length: 114}, (_, i) => suraMB(i + 1)).reduce((a, b) => a + b, 0);
  let html = `<div class="view"><h2 class="sec">Offline &amp; Audio</h2>
    <p class="lead">Die Rezitation von <b>${RECITER_NAME}</b> läuft Vers für Vers. Online wird sie direkt gestreamt; gespeicherte Suren spielen auch ohne Internet – im Flugzeug, in der Moschee, unterwegs.</p>`;
  if (!OFFLINE_OK) {
    html += `<div class="hinweis">Offline-Speichern funktioniert nur, wenn die App über ihre Web-Adresse geöffnet wird (nicht als lokale Datei).</div></div>`;
    return html;
  }
  html += `<div class="card off-card">
      <p style="margin-top:0"><b>${used} von 114 Suren</b> offline gespeichert.</p>
      <div class="progress"><div id="off-bar" style="width:${Math.round(100 * used / 114)}%"></div></div>
      <p class="audio-note" id="off-progress">${job && job.s === "all" ? "Speichert …" : ""}</p>
      <p class="audio-note" id="off-storage"></p>
      <div class="off-actions">
        ${job && job.s === "all"
          ? `<button type="button" class="audio-btn ghost" data-off="cancel">Anhalten</button>`
          : `<button type="button" class="audio-btn" data-off="all">⬇ Alle 114 Suren speichern (≈ ${fmtMB(total)})</button>`}
        <button type="button" class="audio-btn ghost" data-off="delete">Gespeicherte Rezitationen löschen</button>
      </div>
      <p class="audio-note">Tipp: Speichere im WLAN. Das Speichern kann je nach Verbindung 20–60 Minuten dauern; lass die App dabei geöffnet. Abgebrochenes Speichern setzt beim nächsten Mal dort fort, wo es aufgehört hat.</p>
    </div>
    <h3>Einzelne Suren speichern</h3>
    <div class="card off-list">`;
  for (let s = 1; s <= 114; s++) {
    const S = sure(s);
    html += `<div class="off-row"><span class="off-name">${s}. ${esc(S.name)}</span>
      <span class="audio-note" data-sura-state="${s}"></span>
      <button type="button" class="audio-btn ghost small" data-save-sura="${s}">⬇ ${fmtMB(suraMB(s))}</button></div>`;
  }
  html += `</div>
    <h3>So nutzt du die App offline</h3>
    <div class="card"><p style="margin-top:0"><b>iPhone:</b> Öffne die App in Safari → Teilen-Symbol → „Zum Home-Bildschirm“. Starte sie dann immer über das neue Symbol auf dem Home-Bildschirm und speichere dort die Suren (gespeicherte Daten gehören zu diesem Symbol).</p>
    <p style="margin-bottom:0"><b>Mac:</b> Öffne die App in Safari → Menü „Ablage“ → „Zum Dock hinzufügen“ (oder in Chrome: Installieren-Symbol in der Adresszeile). Danach startet sie wie ein Programm, auch ohne Internet.</p></div>
  </div>`;
  return html;
}
function bindOffline(root){
  root.querySelectorAll("[data-off]").forEach(b => b.onclick = () => {
    const k = b.dataset.off;
    if (k === "all") saveAll();
    else if (k === "cancel") cancelJob();
    else if (k === "delete") {
      if (b.dataset.confirm === "1") deleteAll();
      else { b.dataset.confirm = "1"; b.textContent = "Wirklich löschen? Nochmal tippen"; setTimeout(() => { b.dataset.confirm = ""; b.textContent = "Gespeicherte Rezitationen löschen"; }, 4000); }
    }
  });
  const st = root.querySelector("#off-storage");
  if (st && navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(e => {
      if (e && e.usage != null) st.textContent = `Belegter Speicher dieser App: ${fmtMB(e.usage / 1e6)}` + (e.quota ? ` · verfügbar: ${fmtMB(e.quota / 1e6)}` : "");
    }).catch(() => {});
  }
}
function refreshOfflineView(){
  if (window.state && window.state.view === "offline" && !window.state.lesson && typeof window.render === "function") {
    const y = window.scrollY; window.render(); window.scrollTo(0, y);
  }
}

window.KIK_AUDIO = {AUDIO_OK, OFFLINE_OK, suraToolbar, verseActions, verseRangeActions, bind, viewOffline, playSura, stop};
})();

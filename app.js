// MovieBox_Animal_Daily
// Live animal cams + animal shows from official YouTube channels (data/live.json, refreshed by
// scripts/update_streams.py), plus links to free 24/7 animal TV channels and official cam sites.

const CATEGORIES = {
  all:      { label: "All", icon: "🐾" },
  wildlife: { label: "Wildlife & Safari", icon: "🦁" },
  ocean:    { label: "Ocean & Aquarium", icon: "🐋" },
  birds:    { label: "Birds", icon: "🦅" },
  zoo:      { label: "Zoo & Pandas", icon: "🐼" },
  pets:     { label: "Pets", icon: "🐶" },
  kids:     { label: "Kids", icon: "🧒" },
};

// Title keywords → category, so e.g. an eagle nest on a wildlife channel lands in Birds.
const KEYWORDS = [
  ["birds", /\b(bird|eagle|osprey|hawk|owl|albatross|hummingbird|feeder|nest|falcon|heron|penguin|aviary|puffin)s?\b/i],
  ["ocean", /\b(aquarium|jelly|jellies|shark|reef|otter|kelp|ocean|sea|underwater|manatee|whale|dolphin|coral|crab|fish|open sea)s?\b/i],
  ["zoo", /\b(panda|zoo|giraffe|koala)s?\b/i],
  ["pets", /\b(kitten|cat|puppy|puppies|dog|pet)s?\b/i],
  ["wildlife", /\b(bear|wolf|wolves|elephant|lion|safari|waterhole|savanna|africa|namib|kalahari|orangutan|leopard)s?\b/i],
];

// Free TV apps with even more animal channels. They don't allow other sites to play their channels,
// so these open on the service's own site (the playable 24/7 channels come from data/live.json "tv").
const FREE_TV = [
  {
    service: "Pluto TV", url: "https://pluto.tv/us/watch/live-tv/category/animals-nature-us/", region: "US & many countries",
    note: "Whole “Animals + Nature” category — watch in the browser, no account needed.",
    channels: ["BBC Earth", "PBS Nature", "Love Nature", "Dog Whisperer", "Animal Babies", "Dinos 24/7", "Naturescape"],
    featured: [{ name: "The Pet Collective", url: "https://pluto.tv/us/live-tv/5bb1ad55268cae539bcedb08" }],
  },
  {
    service: "Samsung TV Plus", url: "https://www.samsungtvplus.com/", region: "US, CA, UK & more",
    note: "Free on the web and Samsung devices. Nature & animal channels sit around channel 3505–3535 in the US.",
    channels: ["Love Nature 4K", "BBC Earth", "PBS Nature", "WildEarth", "Brave Wilderness", "The Jack Hanna Channel", "Love Pets", "The Pet Collective", "Dog Whisperer", "Lucky Dog", "The Incredible Dr. Pol", "MagellanTV Wildest", "Samsung Wild Life"],
  },
  {
    service: "The Roku Channel", url: "https://therokuchannel.roku.com/live-tv", region: "US, CA, UK",
    note: "Free live TV in the browser — open the Nature or Pets section of the guide.",
    channels: [],
  },
  {
    service: "Tubi", url: "https://tubitv.com/live", region: "US & more",
    note: "Free live channels — look under Nature & Animals.",
    channels: [],
  },
  {
    service: "Plex Live TV", url: "https://www.plex.tv/live-tv-channels/", region: "Worldwide",
    note: "Free live channels, including nature and pet channels, with no subscription.",
    channels: [],
  },
];

// Official websites with even more cams (some aren't on YouTube).
const CAM_SITES = [
  { name: "explore.org", url: "https://explore.org/livecams", note: "Bears, eagles, Africa, oceans — the biggest live nature cam network." },
  { name: "Cornell Lab Bird Cams", url: "https://www.allaboutbirds.org/cams/", note: "Nest cams, feeders and seabirds worldwide." },
  { name: "Smithsonian's National Zoo", url: "https://nationalzoo.si.edu/webcams", note: "Giant panda cam and more." },
  { name: "San Diego Zoo", url: "https://zoo.sandiegozoo.org/live-cams", note: "Apes, penguins, koalas, polar bears." },
  { name: "Monterey Bay Aquarium", url: "https://www.montereybayaquarium.org/animals/live-cams", note: "Sea otters, sharks, jellies, kelp forest." },
  { name: "Georgia Aquarium", url: "https://www.georgiaaquarium.org/webcam/", note: "Whale sharks, belugas, sea lions." },
  { name: "WildEarth", url: "https://www.wildearth.tv/", note: "Live guided safaris twice daily from Africa." },
  { name: "Love Nature", url: "https://www.lovenature.com/", note: "4K wildlife channel and series." },
];

const app = document.getElementById("app");
let DATA = null;

// ---------- Helpers ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const thumb = (id, live) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${live ? "hqdefault_live" : "hqdefault"}.jpg`;
const embed = (id) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`;
const cleanTitle = (t) => t.replace(/🔴/g, "").replace(/^\s*(LIVE|WATCH LIVE)[:\s-]*/i, "").trim();
function categorize(title, fallback) {
  const hit = KEYWORDS.find(([, re]) => re.test(title));
  return hit ? hit[0] : fallback;
}
function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

async function loadData() {
  if (DATA) return DATA;
  const res = await fetch(`data/live.json?t=${Date.now()}`);
  if (!res.ok) throw new Error("Stream list missing — run: python3 scripts/update_streams.py");
  const raw = await res.json();
  const n = (v) => parseFloat(String(v).replace(/,/g, "")) * (/K/.test(v) ? 1e3 : /M/.test(v) ? 1e6 : 1) || 0;
  const byViewers = (a, b) => n(b.viewers) - n(a.viewers);
  const tv = (raw.tv || [])
    .filter((c) => (c.streams || []).length)
    .map((c) => ({
      id: c.id, name: c.name, category: c.category,
      streams: c.streams
        .map((s) => ({ ...s, live: true, tv: true, title: cleanTitle(s.title), channel: c.name, channelId: c.id, category: c.category }))
        .sort(byViewers),
    }));
  const live = raw.live.flatMap((c) =>
    (c.streams || []).map((s) => ({
      ...s, live: true, title: cleanTitle(s.title), channel: c.name, channelId: c.id,
      category: categorize(s.title, c.category),
    }))
  );
  live.sort(byViewers); // most-watched first
  const shows = raw.shows
    .filter((c) => (c.videos || []).length)
    .map((c) => ({
      ...c,
      videos: c.videos.map((v) => ({ ...v, live: false, channel: c.name, channelId: c.id, category: c.category })),
    }));
  DATA = { updated: raw.updated, tv, live, shows, all: [...tv.flatMap((c) => c.streams), ...live, ...shows.flatMap((c) => c.videos)] };
  document.getElementById("updated").textContent = `Stream list updated ${timeAgo(raw.updated)}.`;
  return DATA;
}

// ---------- Favorites ----------
const favs = () => JSON.parse(localStorage.getItem("favorites") || "[]");
const isFav = (id) => favs().some((f) => f.id === id);
function toggleFav(item) {
  const list = favs();
  const next = isFav(item.id) ? list.filter((f) => f.id !== item.id)
    : [{ id: item.id, title: item.title, channel: item.channel, live: item.live, category: item.category }, ...list];
  localStorage.setItem("favorites", JSON.stringify(next));
  return isFav(item.id);
}
function bindFav(el, item) {
  if (!el) return;
  const label = () => (el.textContent = isFav(item.id) ? "♥ Saved" : "♡ Save");
  label();
  el.onclick = () => { toggleFav(item); label(); };
}

// ---------- Components ----------
function tile(item) {
  return `
    <a class="tile" href="${item.href || `#/watch/${encodeURIComponent(item.id)}`}">
      <div class="thumb">
        <img loading="lazy" src="${thumb(item.id, item.live)}" alt="" onerror="this.src='${thumb(item.id, false)}'" />
        ${item.tv ? `<span class="live-badge tv">📺 24/7 TV</span>` : item.live ? `<span class="live-badge">● LIVE</span>` : ""}
        ${item.live && item.viewers ? `<span class="viewers">${esc(item.viewers)} watching</span>` : ""}
        <span class="cat-icon" title="${esc(CATEGORIES[item.category]?.label || "")}">${CATEGORIES[item.category]?.icon || "🐾"}</span>
      </div>
      <h3 title="${esc(item.title)}">${esc(item.title)}</h3>
      <small>${esc(item.subtitle || item.channel)}${item.published ? ` · ${timeAgo(item.published)}` : ""}</small>
    </a>`;
}

const row = (title, items, link) =>
  items.length
    ? `<section class="section"><h2>${title} ${link ? `<a href="${link}">See all →</a>` : ""}</h2>
         <div class="row">${items.map(tile).join("")}</div></section>`
    : "";

const chips = (base, active) => `
  <div class="chips">
    ${Object.entries(CATEGORIES).map(([k, c]) =>
      `<a class="chip ${k === active ? "on" : ""}" href="${base}${k === "all" ? "" : `?cat=${k}`}">${c.icon} ${c.label}</a>`).join("")}
  </div>`;

function freeTvHTML() {
  return `
    <div class="tv-grid">
      ${FREE_TV.map((s) => `
        <div class="tv-card">
          <div class="tv-head">
            <h3>${esc(s.service)}</h3><span class="free-badge">FREE</span>
          </div>
          <small class="muted">${esc(s.region)}</small>
          <p>${esc(s.note)}</p>
          ${s.channels.length ? `<div class="tags">${s.channels.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>` : ""}
          <div class="tv-actions">
            ${(s.featured || []).map((f) => `<a class="btn btn-ghost" href="${f.url}" target="_blank" rel="noopener">▶ ${esc(f.name)}</a>`).join("")}
            <a class="btn btn-primary" href="${s.url}" target="_blank" rel="noopener">Open ${esc(s.service)} ↗</a>
          </div>
        </div>`).join("")}
    </div>`;
}

const camSitesHTML = () => `
  <div class="site-grid">
    ${CAM_SITES.map((s) => `
      <a class="site-card" href="${s.url}" target="_blank" rel="noopener">
        <strong>${esc(s.name)} ↗</strong><span>${esc(s.note)}</span>
      </a>`).join("")}
  </div>`;

const loading = () => (app.innerHTML = `<div class="loader"></div>`);

// ---------- Views ----------
async function homeView() {
  loading();
  const d = await loadData();
  const featured = d.live[0];
  const byCat = (k) => d.live.filter((s) => s.category === k);

  app.innerHTML = `
    ${featured ? `
    <section class="feature">
      <div class="player">
        <iframe src="${embed(featured.id)}&mute=1" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
      </div>
      <div class="feature-info">
        <span class="live-badge static">● LIVE NOW</span>
        <h1>${esc(featured.title)}</h1>
        <p class="muted">${esc(featured.channel)}${featured.viewers ? ` · ${esc(featured.viewers)} watching` : ""}</p>
        <p>The most-watched animal cam right now. ${d.tv.length} animal TV channels and ${d.live.length} live cams are on air — pick one below.</p>
        <div class="actions">
          <a class="btn btn-primary" href="#/watch/${encodeURIComponent(featured.id)}">▶ Watch with sound</a>
          <a class="btn btn-ghost" href="#/live">See all ${d.live.length} live</a>
        </div>
      </div>
    </section>` : ""}
    ${chips("#/live", "")}
    ${row("📺 24/7 Animal TV Channels", tvTiles(d), "#/tv")}
    ${row("🔴 Live Now — Most Watched", d.live.slice(0, 16), "#/live")}
    ${["wildlife", "ocean", "birds", "zoo", "pets"].map((k) => row(`${CATEGORIES[k].icon} Live ${CATEGORIES[k].label}`, byCat(k), `#/live?cat=${k}`)).join("")}
    ${d.shows.slice(0, 8).map((c) => row(`📺 ${esc(c.name)} — Latest`, c.videos, `#/show/${c.id}`)).join("")}
    ${d.shows.slice(8).map((c) => row(`📺 ${esc(c.name)} — Latest`, c.videos, `#/show/${c.id}`)).join("")}
    <section class="section"><h2>🌍 More Official Live Cam Sites</h2>${camSitesHTML()}</section>`;
}

async function liveView(query) {
  loading();
  const d = await loadData();
  const cat = CATEGORIES[query.get("cat")] ? query.get("cat") : "all";
  const items = cat === "all" ? d.live : d.live.filter((s) => s.category === cat);
  app.innerHTML = `
    <h1 class="page-title">🔴 Live Now <small class="muted">${items.length} streams on air</small></h1>
    ${chips("#/live", cat)}
    <section class="section">
      ${items.length ? `<div class="grid">${items.map(tile).join("")}</div>` : `<p class="empty">Nothing live in this category right now — check back soon, or try a <a href="#/tv">free TV channel</a>.</p>`}
    </section>
    <section class="section"><h2>🌍 More Official Live Cam Sites</h2>${camSitesHTML()}</section>`;
}

async function showsView(query) {
  loading();
  const d = await loadData();
  const cat = CATEGORIES[query.get("cat")] ? query.get("cat") : "all";
  const shows = cat === "all" ? d.shows : d.shows.filter((c) => c.category === cat);
  app.innerHTML = `
    <h1 class="page-title">📺 Animal Shows & Documentaries</h1>
    <p class="hint page-hint">Free episodes and clips from official channels — BBC Earth, Nat Geo, Animal Planet, Smithsonian, PBS and more. Updated daily.</p>
    ${chips("#/shows", cat)}
    ${shows.map((c) => row(esc(c.name), c.videos, `#/show/${c.id}`)).join("") || `<p class="empty">No shows in this category.</p>`}`;
}

async function showView(id) {
  loading();
  const d = await loadData();
  const c = d.shows.find((s) => s.id === id);
  if (!c) throw new Error("Channel not found");
  app.innerHTML = `
    <h1 class="page-title">📺 ${esc(c.name)}</h1>
    <p class="hint page-hint">
      <a href="https://www.youtube.com/channel/${encodeURIComponent(c.id)}" target="_blank" rel="noopener">Official channel on YouTube ↗</a>
      · <button class="link-btn" id="playAll">▶ Play all episodes</button>
    </p>
    <section class="section"><div class="grid">${c.videos.map(tile).join("")}</div></section>`;
  // Plays the channel's full upload playlist (UC… → UU…).
  document.getElementById("playAll").onclick = () => {
    app.querySelector(".section").insertAdjacentHTML("afterbegin",
      `<div class="player" style="margin-bottom:24px"><iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=UU${encodeURIComponent(c.id.slice(2))}&autoplay=1"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`);
    document.getElementById("playAll").remove();
  };
}

async function watchView(id) {
  loading();
  const d = await loadData();
  const item = d.all.find((v) => v.id === id) || favs().find((f) => f.id === id) || { id, title: "Animal stream", channel: "", live: false };
  if (item.tv && item.channelId) return location.replace(`#/tv/${item.channelId}?v=${encodeURIComponent(id)}`);
  document.title = `${item.title} — MovieBox_Animal_Daily`;
  const pool = item.live ? d.live : d.all.filter((v) => !v.live);
  const related = [
    ...pool.filter((v) => v.id !== id && v.category === item.category),
    ...pool.filter((v) => v.id !== id && v.category !== item.category),
  ].slice(0, 12);

  app.innerHTML = `
    <div class="watch">
      <div>
        <div class="player">
          <iframe src="${embed(id)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
        </div>
        <h1>${item.live ? `<span class="live-badge static">● LIVE</span> ` : ""}${esc(item.title)}</h1>
        <div class="meta">
          ${item.channel ? `<span>${esc(item.channel)}</span>` : ""}
          ${item.viewers ? `<span>${esc(item.viewers)} watching</span>` : ""}
          ${item.published ? `<span>${timeAgo(item.published)}</span>` : ""}
          ${item.category ? `<span>${CATEGORIES[item.category].icon} ${CATEGORIES[item.category].label}</span>` : ""}
        </div>
        <div class="actions">
          <button class="btn btn-ghost" id="favBtn"></button>
          <a class="btn btn-ghost" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener">Open on YouTube ↗</a>
        </div>
        ${item.live ? `<p class="hint">If the player says the stream is offline, the cam may be off for the night or between seasons — try another live cam.</p>` : ""}
      </div>
      <aside class="side">
        <h2>${item.live ? "More Live Cams" : "Up Next"}</h2>
        ${related.map((v) => `
          <a class="side-item" href="#/watch/${encodeURIComponent(v.id)}">
            <div class="side-thumb"><img loading="lazy" src="${thumb(v.id, v.live)}" alt="" onerror="this.src='${thumb(v.id, false)}'" />
              ${v.live ? `<span class="live-badge">● LIVE</span>` : ""}</div>
            <div><h3>${esc(v.title)}</h3><small>${esc(v.channel)}</small></div>
          </a>`).join("")}
      </aside>
    </div>`;
  bindFav(document.getElementById("favBtn"), item);
}

const tvTiles = (d) =>
  d.tv.map((c) => ({ ...c.streams[0], title: c.name, subtitle: c.streams[0].title, href: `#/tv/${c.id}` }));

// TV-style player: one big screen plus a channel guide. ↑/↓ switch channels.
async function tvView(channelId, query) {
  loading();
  const d = await loadData();
  const apps = `<section class="section"><h2>📱 More Channels on Free TV Apps</h2>
    <p class="hint">These services carry extra animal channels but don't let other websites play them, so they open on their own site.</p>
    ${freeTvHTML()}</section>`;
  if (!d.tv.length) {
    app.innerHTML = `<h1 class="page-title">📺 24/7 Animal TV</h1><p class="empty">No TV channels are on air right now — try the <a href="#/live">live cams</a>.</p>${apps}`;
    return;
  }
  const channel = d.tv.find((c) => c.id === channelId) || d.tv[0];
  const stream = channel.streams.find((s) => s.id === query.get("v")) || channel.streams[0];
  document.title = `${channel.name} — 24/7 Animal TV — MovieBox_Animal_Daily`;

  app.innerHTML = `
    <h1 class="page-title">📺 24/7 Animal TV <small class="muted">${d.tv.length} channels on air · use ↑ ↓ to switch</small></h1>
    ${chips("#/tv", "")}
    <div class="tv-layout">
      <div>
        <div class="player">
          <iframe src="${embed(stream.id)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
        </div>
        <div class="now-playing">
          <span class="live-badge static">● ON AIR</span>
          <h2>${CATEGORIES[channel.category]?.icon || "📺"} ${esc(channel.name)}</h2>
          <p>${esc(stream.title)}${stream.viewers ? ` <span class="muted">· ${esc(stream.viewers)} watching</span>` : ""}</p>
          <div class="actions">
            <button class="btn btn-ghost" id="favBtn"></button>
            <a class="btn btn-ghost" href="https://www.youtube.com/watch?v=${encodeURIComponent(stream.id)}" target="_blank" rel="noopener">Open on YouTube ↗</a>
          </div>
        </div>
        ${channel.streams.length > 1 ? `
          <h3 class="alt-title">More streams on ${esc(channel.name)} (${channel.streams.length})</h3>
          <div class="row alt-row">${channel.streams.map((s) => tile({ ...s, href: `#/tv/${channel.id}?v=${s.id}` })).join("")}</div>` : ""}
      </div>
      <aside class="guide">
        <h2>Channel Guide</h2>
        ${d.tv.map((c, i) => `
          <a class="guide-item ${c.id === channel.id ? "on" : ""}" href="#/tv/${c.id}">
            <span class="ch-num">${String(i + 1).padStart(2, "0")}</span>
            <img loading="lazy" src="${thumb(c.streams[0].id, true)}" alt="" onerror="this.src='${thumb(c.streams[0].id, false)}'" />
            <div><strong>${esc(c.name)}</strong><small>${esc(c.streams[0].title)}</small></div>
          </a>`).join("")}
      </aside>
    </div>
    ${apps}`;
  bindFav(document.getElementById("favBtn"), stream);
  // Filter chips on this page jump to the first channel in that category.
  app.querySelectorAll(".chips .chip").forEach((a) => {
    const cat = new URLSearchParams(a.getAttribute("href").split("?")[1] || "").get("cat");
    const first = cat && d.tv.find((c) => c.category === cat);
    if (cat && !first) a.remove();
    else a.setAttribute("href", first ? `#/tv/${first.id}` : `#/tv/${d.tv[0].id}`);
    a.classList.toggle("on", !!first && channel.category === cat);
  });
}

window.addEventListener("keydown", (e) => {
  if (!DATA || !location.hash.startsWith("#/tv") || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  e.preventDefault();
  const current = location.hash.split("?")[0].split("/")[2];
  const i = Math.max(0, DATA.tv.findIndex((c) => c.id === current));
  const next = DATA.tv[(i + (e.key === "ArrowDown" ? 1 : -1) + DATA.tv.length) % DATA.tv.length];
  location.hash = `#/tv/${next.id}`;
});

async function searchView(q) {
  loading();
  const d = await loadData();
  document.getElementById("searchInput").value = q;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = d.all.filter((v) => words.every((w) => `${v.title} ${v.channel}`.toLowerCase().includes(w)));
  const live = hits.filter((v) => v.live);
  const vids = hits.filter((v) => !v.live);
  app.innerHTML = `
    <h1 class="page-title">Results for “${esc(q)}” <small class="muted">${hits.length} found</small></h1>
    ${live.length ? `<section class="section"><h2>🔴 Live</h2><div class="grid">${live.map(tile).join("")}</div></section>` : ""}
    ${vids.length ? `<section class="section"><h2>📺 Shows & Videos</h2><div class="grid">${vids.map(tile).join("")}</div></section>` : ""}
    ${hits.length ? "" : `<p class="empty">Nothing matched. Try “bear”, “otter”, “eagle”, “panda” or “safari”.</p>`}`;
}

function favoritesView() {
  const list = favs();
  app.innerHTML = `
    <h1 class="page-title">♥ Favorites</h1>
    <section class="section">
      ${list.length ? `<div class="grid">${list.map(tile).join("")}</div>` : `<p class="empty">No favorites yet. Tap “♡ Save” on any stream.</p>`}
    </section>`;
}

// ---------- Router ----------
async function router() {
  const [path, qs = ""] = location.hash.slice(1).split("?");
  const [, route = "", ...rest] = path.split("/");
  const arg = decodeURIComponent(rest.join("/"));
  const query = new URLSearchParams(qs);
  document.title = "MovieBox_Animal_Daily — Free Live Animal Cams, Shows & Channels";
  document.querySelectorAll(".nav a").forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === `#/${route}`));
  window.scrollTo(0, 0);

  try {
    if (route === "watch" && arg) await watchView(arg);
    else if (route === "live") await liveView(query);
    else if (route === "shows") await showsView(query);
    else if (route === "show" && arg) await showView(arg);
    else if (route === "tv") await tvView(arg, query);
    else if (route === "search" && arg) await searchView(arg);
    else if (route === "favorites") favoritesView();
    else await homeView();
  } catch (e) {
    app.innerHTML = `<p class="empty">Couldn't load streams (${esc(e.message)}).</p>`;
  }
}

document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("searchInput").value.trim();
  if (q) location.hash = `#/search/${encodeURIComponent(q)}`;
});
window.addEventListener("hashchange", router);
router();

// ---------- Visitor counter (free Abacus API, https://abacus.jasoncameron.dev) ----------
// "visitors" counts each browser once; "visits" counts once per browser session.
// Local previews only read the numbers, so testing doesn't inflate them.
const COUNTER = "https://abacus.jasoncameron.dev";
const COUNTER_NS = "zjqyai-moviebox-animal-daily";
async function updateVisitors() {
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const count = async (key, increment) => {
    const res = await fetch(`${COUNTER}/${increment ? "hit" : "get"}/${COUNTER_NS}/${key}`);
    if (res.status === 404) return 0; // nothing counted yet
    if (!res.ok) throw new Error(`counter ${res.status}`);
    return (await res.json()).value || 0;
  };
  try {
    const newVisitor = !isLocal && !localStorage.getItem("counted_visitor");
    const newVisit = !isLocal && !sessionStorage.getItem("counted_visit");
    const [visitors, visits] = await Promise.all([count("visitors", newVisitor), count("visits", newVisit)]);
    if (newVisitor) localStorage.setItem("counted_visitor", "1");
    if (newVisit) sessionStorage.setItem("counted_visit", "1");
    document.getElementById("visitorCount").textContent = visitors.toLocaleString();
    document.getElementById("visitCount").textContent = visits.toLocaleString();
    document.getElementById("visitors").hidden = false;
  } catch {
    // The counter is optional; the site works without it.
  }
}
updateVisitors();

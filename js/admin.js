/* Admin panel — open at /admin.
   Edits are saved as a draft in this browser only. Visitors keep seeing the
   published content.js until you download a new one and upload it. */
(function () {
  const panel = document.getElementById("admin");
  const flag = document.getElementById("draft-flag");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const D = () => Store.data;

  const SLIDERS = [
    ["Vortex", [
      ["particleCount", "Particles", 200, 8000, 100],
      ["spinSpeed", "Idle spin", 0, 2, 0.01],
      ["scrollSpin", "Scroll spin", 0, 6, 0.05],
      ["inflow", "Pull to centre", 0, 3, 0.05],
      ["arms", "Spiral arms", 1, 9, 1],
      ["twist", "Twist", 0, 10, 0.1],
      ["particleSize", "Particle size", 0.4, 5, 0.1],
      ["trail", "Trail length", 0, 0.97, 0.01],
      ["radius", "Radius", 0.3, 1.6, 0.01],
      ["centerX", "Centre X", 0, 1, 0.01],
      ["centerY", "Centre Y", 0, 1, 0.01]
    ]],
    ["Glow", [
      ["glow", "Core glow", 0, 1.5, 0.01]
    ]],
    ["Type & stacks", [
      ["textScale", "Text scale", 0.6, 1.4, 0.01],
      ["stackRotation", "Stack rotation", 0, 20, 0.5],
      ["stackSpread", "Stack spread", 0, 40, 1],
      ["gridColumns", "Grid columns", 2, 6, 1]
    ]]
  ];

  const COLORS = [
    ["colorBg", "Background"],
    ["colorInk", "Text"],
    ["colorDim", "Secondary text"],
    ["colorLine", "Lines"],
    ["colorAccent", "Accent"],
    ["colorAccent2", "Accent 2 (warnings)"],
    ["colorName1", "Name — first line"],
    ["colorName2", "Name — second line"],
    ["particleOuter", "Particles — outer"],
    ["particleCore", "Particles — core"]
  ];
  const PRESETS = {
    "Saulė": { colorBg: "#000000", colorInk: "#fbe7c8", colorDim: "#c9a77f", colorLine: "#5a3218", colorAccent: "#ffcf29", colorAccent2: "#ff6d0a", colorName1: "#fbe7c8", colorName2: "#ffcf29", particleOuter: "#f56200", particleCore: "#ffdb66" },
    "Žarijos": { colorBg: "#120403", colorInk: "#ffe2d6", colorDim: "#c98a7a", colorLine: "#5c1a12", colorAccent: "#ff4a1c", colorAccent2: "#ffb703", colorName1: "#ffe2d6", colorName2: "#ff4a1c", particleOuter: "#b3120a", particleCore: "#ff9e3d" },
    "Naktis": { colorBg: "#03050f", colorInk: "#e6ecff", colorDim: "#8a95b8", colorLine: "#1f2a4d", colorAccent: "#7cc4ff", colorAccent2: "#ff7a59", colorName1: "#e6ecff", colorName2: "#7cc4ff", particleOuter: "#2a3cff", particleCore: "#b8f0ff" },
    "Popierius": { colorBg: "#f3ead8", colorInk: "#1d1209", colorDim: "#6b5440", colorLine: "#c9b394", colorAccent: "#d1460a", colorAccent2: "#8f1d00", colorName1: "#1d1209", colorName2: "#d1460a", particleOuter: "#e0721f", particleCore: "#ffb74d" },
    "Tušas": { colorBg: "#f3f0e8", colorInk: "#111111", colorDim: "#55514a", colorLine: "#cfc8bb", colorAccent: "#111111", colorAccent2: "#b3261e", colorName1: "#111111", colorName2: "#111111", particleOuter: "#111111", particleCore: "#111111" },
    "Rūgštis": { colorBg: "#050805", colorInk: "#ecffe0", colorDim: "#9bb88a", colorLine: "#26401d", colorAccent: "#c6ff2e", colorAccent2: "#ff3cac", colorName1: "#ecffe0", colorName2: "#c6ff2e", particleOuter: "#3dff8b", particleCore: "#f4ff9e" }
  };

  // Login gate. Only a SHA-256 hash of "username:password" is stored here.
  // This keeps casual visitors out of the editor; the live site itself can only be
  // changed by whoever can upload js/content.js to GitHub.
  const LOGIN_HASH = "fd4e39942097282713c9b32cf782e7d06b0dfd1d91b90b9e37913afcd3c77b7c";
  const AUTH_KEY = "rv-admin-auth";
  const authed = () => { try { return sessionStorage.getItem(AUTH_KEY) === LOGIN_HASH; } catch (e) { return false; } };

  // Small SHA-256 (works on plain http too, where crypto.subtle is unavailable)
  function sha256(str) {
    const K = [], H = [];
    let n = 2, c = 0;
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    while (c < 64) {
      let prime = true;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
      if (prime) { if (c < 8) H[c] = frac(Math.pow(n, 1 / 2)); K[c++] = frac(Math.pow(n, 1 / 3)); }
      n++;
    }
    const bytes = Array.from(new TextEncoder().encode(str));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bitLen >>> (i * 8)) & 255);
    const rotr = (x, r) => (x >>> r) | (x << (32 - r));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, cc, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, cc, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
    }
    return H.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
  }

  function renderLogin(error) {
    panel.innerHTML = `
      <div class="adm__top">
        <strong class="adm__brand">Redaktorius</strong>
        <span class="adm__status">Locked</span>
        <button class="adm__x" data-act="close" type="button" aria-label="Close">${ICONS.close}</button>
      </div>
      <form class="adm__body adm__login" data-login autocomplete="on">
        <fieldset class="adm__group"><legend>Prisijungti</legend>
          <label class="adm__field"><span>Vartotojo vardas</span><input type="text" name="user" autocomplete="username" required></label>
          <label class="adm__field"><span>Slaptažodis</span><input type="password" name="pass" autocomplete="current-password" required></label>
          ${error ? `<p class="adm__warn">${error}</p>` : ""}
          <button type="submit" class="adm__btn">Prisijungti</button>
        </fieldset>
      </form>`;
    panel.querySelector("input[name=user]").focus();
  }

  panel.addEventListener("submit", (e) => {
    if (!e.target.matches("[data-login]")) return;
    e.preventDefault();
    const f = new FormData(e.target);
    if (sha256(`${f.get("user").trim()}:${f.get("pass")}`) === LOGIN_HASH) {
      try { sessionStorage.setItem(AUTH_KEY, LOGIN_HASH); } catch (err) {}
      open();
    } else {
      renderLogin("Neteisingas vartotojo vardas arba slaptažodis.");
    }
  });

  let tab = "design";
  let pageIdx = 0;

  // --- path helpers: "pages.0.blocks.1.heading" ---
  function getPath(path) { return path.split(".").reduce((o, k) => o?.[k], D()); }
  function setPath(path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((o, k) => o[k], D())[last] = value;
  }

  function slugify(s) {
    const map = { ą: "a", č: "c", ę: "e", ė: "e", į: "i", š: "s", ų: "u", ū: "u", ž: "z" };
    return s.toLowerCase().replace(/[ąčęėįšųūž]/g, (c) => map[c]).replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function pageUrl(p) { return `${location.origin}/${p.slug}`; }

  // ---------- render ----------
  function render() {
    panel.innerHTML = `
      <div class="adm__top">
        <strong class="adm__brand">Redaktorius</strong>
        <span class="adm__status" id="adm-status">${Store.hasDraft() ? "Draft saved" : "Published"}</span>
        <button class="adm__logout" data-act="logout" type="button">Atsijungti</button>
        <button class="adm__x" data-act="close" type="button" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="adm__tabs">
        ${["design", "pages", "site", "publish"].map((t) => `<button type="button" data-tab="${t}" class="${t === tab ? "is-on" : ""}">${t}</button>`).join("")}
      </div>
      <div class="adm__body">${({ design: designTab, pages: pagesTab, site: siteTab, publish: publishTab })[tab]()}</div>`;
  }

  function designTab() {
    const d = D().design;
    return SLIDERS.map(([group, rows]) => `
      <fieldset class="adm__group"><legend>${group}</legend>
        ${rows.map(([key, label, min, max, step]) => `
          <label class="adm__slider">
            <span>${label}</span><output id="out-${key}">${d[key]}</output>
            <input type="range" min="${min}" max="${max}" step="${step}" value="${d[key]}" data-design="${key}">
          </label>`).join("")}
      </fieldset>`).join("") +
      `<fieldset class="adm__group"><legend>Colours</legend>
        <div class="adm__presets">${Object.keys(PRESETS).map((p) => `<button type="button" data-preset="${p}"
          style="background:${PRESETS[p].colorBg};color:${PRESETS[p].colorAccent};border-color:${PRESETS[p].particleOuter}">${p}</button>`).join("")}</div>
        <div class="adm__colors">${COLORS.map(([key, label]) => `
          <label class="adm__color"><input type="color" value="${esc(d[key] || "#000000")}" data-color="${key}"><span>${label}</span></label>`).join("")}
        </div>
      </fieldset>
      <fieldset class="adm__group"><legend>Name font</legend>
        <label class="adm__field"><span>Font for "${esc(D().site.name)}"</span>
          <select data-namefont>${Object.keys(window.NAME_FONTS).map((f) =>
            `<option value="${f}" ${f === d.nameFont ? "selected" : ""}>${f}</option>`).join("")}
            ${d.customFont ? `<option value="custom" ${d.nameFont === "custom" ? "selected" : ""}>Own: ${esc(d.customFont.name)}</option>` : ""}</select></label>
        <label class="adm__drop" data-drop>
          <input type="file" accept=".ttf,.otf,.woff,.woff2" data-fontfile>
          <b>Drop a font file here</b><span>.ttf · .otf · .woff · .woff2 — or click to choose</span>
        </label>
        ${d.customFont ? `<button type="button" class="adm__btn adm__btn--ghost" data-act="font-remove">Remove ${esc(d.customFont.name)}</button>` : ""}
      </fieldset>
      <button type="button" class="adm__btn adm__btn--ghost" data-act="reset-design">Reset design to published</button>`;
  }

  function field(label, path, opts = {}) {
    const v = getPath(path) ?? "";
    const input = opts.area
      ? `<textarea data-bind="${path}" rows="${opts.rows || 4}" ${opts.lines ? 'data-lines="1"' : ""}>${esc(opts.lines ? (v || []).join("\n") : v)}</textarea>`
      : `<input type="text" data-bind="${path}" value="${esc(v)}" ${opts.slug ? 'data-slug="1"' : ""}>`;
    return `<label class="adm__field"><span>${label}</span>${input}</label>`;
  }

  const BG_LABELS = { colorBg: "Background", colorInk: "Text", colorAccent: "Accent", particleOuter: "Particles outer", particleCore: "Particles core" };

  function range(label, path, value, min, max, step) {
    return `<label class="adm__slider"><span>${label}</span><output>${value}</output>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-bind="${path}" data-num="1"></label>`;
  }

  function pagesTab() {
    const pages = D().pages;
    pageIdx = Math.min(pageIdx, pages.length - 1);
    const p = pages[pageIdx];
    p.bg = p.bg || {};
    const base = `pages.${pageIdx}`;
    const dup = pages.some((o, i) => i !== pageIdx && o.slug === p.slug);

    const blocks = (p.blocks || []).map((b, bi) => {
      const bp = `${base}.blocks.${bi}`;
      if (b.type === "panel") {
        return `<div class="adm__block">
          <div class="adm__blockhead"><span>${String(bi + 1).padStart(2, "0")} · glass panel</span>
            <span class="adm__mini"><button type="button" data-act="b-del" data-i="${bi}">Delete</button></span></div>
          ${p.layout === "free" ? "" : `<p class="adm__warn">Panels only show in Free layout.</p>`}
          <label class="adm__color"><input type="color" data-bind="${bp}.color" value="${esc(b.color || "#000000")}"><span>Colour</span></label>
          ${range("Opacity", `${bp}.opacity`, b.opacity ?? 0.4, 0, 1, 0.01)}
          ${range("Blur (px)", `${bp}.blur`, b.blur ?? 16, 0, 60, 1)}
        </div>`;
      }
      let body = field("Heading", `${bp}.heading`);
      if (b.type === "timeline") {
        const line = (e) => [e.year, e.title].concat(e.detail ? e.detail.split("\n") : []).join(" | ");
        const txt = (b.entries || []).map((e) => e.group ? `# ${e.group}`
          : [line(e)].concat((e.items || []).map((s) => `- ${line(s)}`)).join("\n")).join("\n");
        body += `<label class="adm__field"><span>One entry per line: <b>Year | Title | Details</b> (each extra “|” = new detail line).
          A line starting with <b>-</b> belongs to the entry above it.
          A line starting with <b>#</b> is a sub-heading. (${(b.entries || []).filter((e) => !e.group).length} entries)</span>
          <textarea rows="12" class="adm__mono" data-timeline="${bp}">${esc(txt)}</textarea></label>`;
      }
      if (b.type === "text") body += field("Text (blank line = new paragraph)", `${bp}.body`, { area: true, rows: 6 });
      if (b.type === "video") body += field("YouTube / Vimeo link", `${bp}.url`);
      if (b.type === "stacks") {
        body += (b.groups || []).map((g, gi) => {
          const gp = `${bp}.groups.${gi}`;
          return `<div class="adm__sub">
            <div class="adm__row">${field("Group title", `${gp}.title`)}${field("Year / place", `${gp}.year`)}</div>
            ${field("Description — shown above the photos when the stack is opened (optional)", `${gp}.text`, { area: true, rows: 5 })}
            ${field(`Images — one URL per line (${(g.images || []).length})`, `${gp}.images`, { area: true, rows: 4, lines: true })}
            <div class="adm__mini">
              <button type="button" data-act="ph" data-path="${gp}">+ 4 placeholders</button>
              ${gi > 0 ? `<button type="button" data-act="g-up" data-path="${bp}" data-i="${gi}" aria-label="Move up">${ICONS.arrowUp}</button>` : ""}
              <button type="button" data-act="g-del" data-path="${bp}" data-i="${gi}">Delete group</button>
            </div>
          </div>`;
        }).join("");
        body += `<button type="button" class="adm__btn adm__btn--ghost" data-act="g-add" data-path="${bp}">+ Image group</button>`;
      }
      return `<div class="adm__block">
        <div class="adm__blockhead">
          <span>${String(bi + 1).padStart(2, "0")} · ${b.type}</span>
          <span class="adm__mini">
            ${bi > 0 ? `<button type="button" data-act="b-up" data-i="${bi}" aria-label="Move up">${ICONS.arrowUp}</button>` : ""}
            ${bi < p.blocks.length - 1 ? `<button type="button" data-act="b-down" data-i="${bi}" aria-label="Move down">${ICONS.arrowDown}</button>` : ""}
            <button type="button" data-act="b-del" data-i="${bi}">Delete</button>
          </span>
        </div>${body}</div>`;
    }).join("");

    return `
      <div class="adm__pagelist">
        ${pages.map((o, i) => `<button type="button" data-page="${i}" class="${i === pageIdx ? "is-on" : ""}">${esc(o.title || "(untitled)")}${o.hidden ? " " + ICONS.hidden : ""}</button>`).join("")}
        <button type="button" data-act="p-add">+ New page</button>
      </div>

      <fieldset class="adm__group"><legend>Page</legend>
        ${field("Title", `${base}.title`)}
        ${p.slug === "" && pageIdx === 0
          ? `<p class="adm__note">This is the home page (<code>/</code>).</p>`
          : field("Link slug", `${base}.slug`, { slug: true })}
        ${dup ? `<p class="adm__warn">Another page already uses this slug.</p>` : ""}
        <div class="adm__link"><code id="adm-url">${esc(pageUrl(p))}</code>
          <button type="button" data-act="copy-url">Copy</button>
          <a href="/${esc(p.slug)}" data-link>Open</a></div>
        <label class="adm__check"><input type="checkbox" data-hidden ${p.hidden ? "checked" : ""}>
          <span><b>Only via link</b> — hide from the menu and search engines</span></label>
        ${field("Intro", `${base}.intro`, { area: true, rows: 3 })}
      </fieldset>

      <fieldset class="adm__group"><legend>Layout</legend>
        <label class="adm__field"><span>Arrangement</span>
          <select data-layout>
            <option value="flow" ${p.layout !== "free" ? "selected" : ""}>Flow — blocks one under another</option>
            <option value="free" ${p.layout === "free" ? "selected" : ""}>Free — drag blocks anywhere (like Figma)</option>
          </select></label>
        ${p.layout === "free" ? `<p class="adm__note">On the page: <b>drag</b> a block to move it, drag the
          <b>yellow corner</b> to resize, <b>the arrows</b> on its label changes what's in front. Arrow keys nudge the
          selected block (Shift = bigger steps). On phones blocks stack top-to-bottom.</p>` : ""}
      </fieldset>

      <fieldset class="adm__group"><legend>Page background</legend>
        <p class="adm__note">Tick a colour to override the site colour on this page only.</p>
        <div class="adm__colors">${window.PAGE_BG_KEYS.map((k) => `
          <label class="adm__color"><input type="checkbox" data-pbg-on="${k}" ${p.bg[k] ? "checked" : ""}>
            <input type="color" data-pbg="${k}" value="${esc(p.bg[k] || D().design[k] || "#000000")}"><span>${BG_LABELS[k]}</span></label>`).join("")}
        </div>
        ${field("Background image URL (optional)", `${base}.bg.image`)}
        ${range("Image visibility", `${base}.bg.imageOpacity`, p.bg.imageOpacity ?? 0.5, 0, 1, 0.01)}
        <label class="adm__check"><input type="checkbox" data-pbg-check="particlesOff" ${p.bg.particlesOff ? "checked" : ""}>
          <span>Hide the particle vortex on this page</span></label>
      </fieldset>

      <fieldset class="adm__group"><legend>Blocks</legend>
        ${blocks || `<p class="adm__note">No blocks yet.</p>`}
        <div class="adm__mini adm__mini--add">
          <button type="button" data-act="b-add" data-type="stacks">+ Photo stacks</button>
          <button type="button" data-act="b-add" data-type="text">+ Text</button>
          <button type="button" data-act="b-add" data-type="timeline">+ Timeline (CV)</button>
          <button type="button" data-act="b-add" data-type="video">+ Video</button>
          <button type="button" data-act="b-add" data-type="panel">+ Glass panel</button>
        </div>
      </fieldset>
      ${pageIdx > 0 ? `<button type="button" class="adm__btn adm__btn--danger" data-act="p-del">Delete this page</button>` : ""}`;
  }

  function siteTab() {
    return `<fieldset class="adm__group"><legend>Site</legend>
      ${field("Name", "site.name")}
      ${field("Role line", "site.role")}
      ${field("Email", "site.email")}
    </fieldset>
    <fieldset class="adm__group"><legend>Links at the bottom</legend>
      ${(D().site.links || []).map((l, i) => `<div class="adm__sub">
        <div class="adm__row">${field("Label", `site.links.${i}.label`)}${field("URL", `site.links.${i}.url`)}</div>
        <div class="adm__mini">
          ${i > 0 ? `<button type="button" data-act="l-up" data-i="${i}" aria-label="Move up">${ICONS.arrowUp}</button>` : ""}
          <button type="button" data-act="l-del" data-i="${i}">Delete link</button>
        </div></div>`).join("") || `<p class="adm__note">No links yet.</p>`}
      <button type="button" class="adm__btn adm__btn--ghost" data-act="l-add">+ Add link</button>
    </fieldset>`;
  }

  function publishTab() {
    return `<fieldset class="adm__group"><legend>Publish</legend>
      <p class="adm__note">Your edits live in this browser as a draft. Visitors see them only after you
      download <code>content.js</code> and replace <code>/js/content.js</code> on the server.</p>
      <button type="button" class="adm__btn" data-act="download">Download content.js</button>
      <button type="button" class="adm__btn adm__btn--ghost" data-act="copy-json">Copy as JSON</button>
      <label class="adm__btn adm__btn--ghost adm__file">Import JSON / content.js<input type="file" accept=".json,.js" data-import></label>
      <button type="button" class="adm__btn adm__btn--danger" data-act="discard">Discard draft</button>
    </fieldset>`;
  }

  // ---------- events ----------
  panel.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.color) {
      D().design[t.dataset.color] = t.value;
      return Store.change("design");
    }
    if (t.dataset.design) {
      const key = t.dataset.design;
      D().design[key] = parseFloat(t.value);
      panel.querySelector(`#out-${key}`).textContent = t.value;
      return Store.change("design");
    }
    if (t.dataset.timeline) {
      const parse = (l) => {
        const [year = "", title = "", ...detail] = l.split(/\s*\|\s*/);
        return { year, title, detail: detail.join("\n") };
      };
      const entries = [];
      t.value.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
        if (l.startsWith("#")) return entries.push({ group: l.replace(/^#+\s*/, "") });
        const last = entries[entries.length - 1];
        if (l.startsWith("-") && last && !last.group) return (last.items = last.items || []).push(parse(l.replace(/^-\s*/, "")));
        entries.push(parse(l));
      });
      getPath(t.dataset.timeline).entries = entries;
      return Store.change("content");
    }
    if (t.dataset.pbg) {
      const p = pages()[pageIdx];
      p.bg = p.bg || {};
      p.bg[t.dataset.pbg] = t.value;
      const on = panel.querySelector(`[data-pbg-on="${t.dataset.pbg}"]`);
      if (on) on.checked = true;
      return Store.change("design");
    }
    if (t.dataset.bind) {
      let v = t.value;
      if (t.dataset.num) {
        v = parseFloat(v);
        const out = t.parentElement.querySelector("output");
        if (out) out.textContent = v;
      }
      if (t.dataset.lines) v = v.split("\n").map((s) => s.trim()).filter(Boolean);
      if (t.dataset.slug) {
        v = slugify(v);
        const url = panel.querySelector("#adm-url");
        if (url) url.textContent = `${location.origin}/${v}`;
      }
      const viewing = pages()[pageIdx] === current();
      setPath(t.dataset.bind, v);
      if (t.dataset.slug && viewing) history.replaceState(null, "", `/${v}`);
      // panel look & page background only need a repaint, not a rebuild
      const m = t.dataset.bind.match(/blocks\.(\d+)\.(opacity|blur|color)$/);
      const g = m && document.querySelector(`.free__item[data-key="b${m[1]}"] .glass`);
      if (g) {
        const b = pages()[pageIdx].blocks[+m[1]];
        const c = (b.color || "#000000").replace("#", "");
        const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) || 0).join(", ");
        g.style.setProperty("--glass", `rgba(${rgb}, ${b.opacity ?? 0.4})`);
        g.style.setProperty("--blur", `${b.blur ?? 16}px`);
        return Store.change("layout");
      }
      if (/\.bg\./.test(t.dataset.bind)) return Store.change("design");
      if (/^pages\.\d+\.title$/.test(t.dataset.bind)) {
        const btn = panel.querySelector(`[data-page="${pageIdx}"]`);
        if (btn) btn.innerHTML = esc(v || "(untitled)") + (pages()[pageIdx].hidden ? " " + ICONS.hidden : "");
      }
      return Store.change("content");
    }
  });

  panel.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.fontfile !== undefined && t.files[0]) readFont(t.files[0]);
    if (t.dataset.namefont !== undefined) {
      D().design.nameFont = t.value;
      Store.change("design");
    }
    if (t.dataset.layout !== undefined) {
      const p = pages()[pageIdx];
      p.layout = t.value;
      if (p.layout === "free") Free.ensureBoxes(p);
      Store.change("content");
      return render();
    }
    if (t.dataset.pbgOn) {
      const p = pages()[pageIdx];
      const k = t.dataset.pbgOn;
      if (t.checked) p.bg[k] = panel.querySelector(`[data-pbg="${k}"]`).value;
      else delete p.bg[k];
      return Store.change("design");
    }
    if (t.dataset.pbgCheck) {
      pages()[pageIdx].bg[t.dataset.pbgCheck] = t.checked;
      return Store.change("design");
    }
    if (t.dataset.hidden !== undefined) {
      pages()[pageIdx].hidden = t.checked;
      Store.change("content");
    }
    if (t.dataset.slug) t.value = getPath(t.dataset.bind);
    if (t.dataset.hidden !== undefined) render();
    if (t.dataset.import !== undefined && t.files[0]) importFile(t.files[0]);
  });

  const pages = () => D().pages;
  const current = () => pages().find((p) => p.slug === App.slug());

  function blocksOf() { return pages()[pageIdx].blocks; }
  function move(arr, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; return render(); }
    if (b.dataset.preset) {
      Object.assign(D().design, PRESETS[b.dataset.preset]);
      Store.change("design");
      return render();
    }
    if (b.dataset.page) {
      pageIdx = +b.dataset.page;
      App.go(`/${pages()[pageIdx].slug}`);
      return render();
    }
    const act = b.dataset.act;
    const i = +b.dataset.i;
    const structural = {
      "p-add": () => {
        let n = 1;
        while (pages().some((p) => p.slug === `naujas-${n}`)) n++;
        pages().push({ slug: `naujas-${n}`, title: "Naujas puslapis", hidden: true, intro: "", blocks: [] });
        pageIdx = pages().length - 1;
        Store.change("content");
        App.go(`/naujas-${n}`);
      },
      "p-del": () => {
        pages().splice(pageIdx, 1);
        pageIdx = 0;
        App.go("/");
      },
      "b-add": () => {
        const type = b.dataset.type;
        const block = { type, heading: "" };
        if (type === "text") block.body = "";
        if (type === "timeline") block.entries = [{ year: String(new Date().getFullYear()), title: "Pavadinimas", detail: "Vieta" }];
        if (type === "video") block.url = "";
        if (type === "panel") Object.assign(block, { color: "#000000", opacity: 0.4, blur: 16, box: { x: 30, y: 20, w: 40, h: 14, z: 1 } });
        else if (pages()[pageIdx].layout === "free") {
          const ys = blocksOf().map((o) => (o.box ? o.box.y + 30 : 0));
          block.box = { x: 4, y: Math.max(40, ...ys), w: 48, z: 2 };
        }
        if (type === "stacks") block.groups = [{ title: "Nauja grupė", year: String(new Date().getFullYear()), images: placeholders(6) }];
        blocksOf().push(block);
      },
      "l-add": () => { D().site.links = (D().site.links || []).concat([{ label: "Nauja nuoroda", url: "https://" }]); },
      "l-up": () => move(D().site.links, i, -1),
      "l-del": () => { D().site.links.splice(i, 1); },
      "b-up": () => move(blocksOf(), i, -1),
      "b-down": () => move(blocksOf(), i, 1),
      "b-del": () => { blocksOf().splice(i, 1); },
      "g-add": () => getPath(b.dataset.path).groups.push({ title: "Nauja grupė", year: "", images: placeholders(6) }),
      "g-up": () => move(getPath(b.dataset.path).groups, i, -1),
      "g-del": () => { getPath(b.dataset.path).groups.splice(i, 1); },
      "ph": () => { const g = getPath(b.dataset.path); g.images = (g.images || []).concat(placeholders(4)); },
      "reset-design": () => { Object.assign(D().design, window.SITE_DEFAULTS.design); },
      "font-remove": () => {
        D().design.customFont = null;
        if (D().design.nameFont === "custom") D().design.nameFont = "silver-northern";
      }
    };
    if (/-del$/.test(act) && !armed(b)) return;
    if (structural[act]) {
      structural[act]();
      Store.change(act === "reset-design" ? "design" : "content");
      return render();
    }
    if (act === "close") return close();
    if (act === "logout") {
      try { sessionStorage.removeItem(AUTH_KEY); } catch (err) {}
      return close();
    }
    if (act === "copy-url") return copy(panel.querySelector("#adm-url").textContent, b);
    if (act === "copy-json") return copy(JSON.stringify(D(), null, 2), b);
    if (act === "download") return download();
    if (act === "discard") {
      if (armed(b)) { Store.discardDraft(); render(); }
    }
  });

  // First click arms a destructive button, a second click within 3 s confirms it
  function armed(btn) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = "1";
    const old = btn.textContent;
    btn.textContent = "Sure? Click again";
    btn.classList.add("is-armed");
    setTimeout(() => {
      if (!btn.isConnected) return;
      delete btn.dataset.armed;
      btn.textContent = old;
      btn.classList.remove("is-armed");
    }, 3000);
    return false;
  }

  // Font file → data URL stored in the design, so it ships inside content.js
  function readFont(file) {
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) return alert("Use a .ttf, .otf, .woff or .woff2 file.");
    if (file.size > 1.5 * 1024 * 1024) {
      if (!confirm(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB — it will slow the site down. Use it anyway?`)) return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      D().design.customFont = { name: file.name, data: reader.result };
      D().design.nameFont = "custom";
      Store.change("design");
      render();
    };
    reader.readAsDataURL(file);
  }
  panel.addEventListener("dragover", (e) => {
    const z = e.target.closest("[data-drop]");
    if (z) { e.preventDefault(); z.classList.add("is-over"); }
  });
  panel.addEventListener("dragleave", (e) => {
    const z = e.target.closest("[data-drop]");
    if (z) z.classList.remove("is-over");
  });
  panel.addEventListener("drop", (e) => {
    const z = e.target.closest("[data-drop]");
    if (!z) return;
    e.preventDefault();
    z.classList.remove("is-over");
    if (e.dataTransfer.files[0]) readFont(e.dataTransfer.files[0]);
  });

  function placeholders(n) {
    const seed = Math.random().toString(36).slice(2, 7);
    const sizes = [[800, 1000], [1000, 700], [800, 800], [700, 1000], [1200, 800]];
    return Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${seed}-${i}/${sizes[i % 5][0]}/${sizes[i % 5][1]}`);
  }

  function copy(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = old), 1200);
    });
  }

  function download() {
    const blob = new Blob([Store.exportJS()], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "content.js";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importFile(file) {
    file.text().then((txt) => {
      try {
        const json = txt.trim().startsWith("{") ? txt : txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
        const data = JSON.parse(json);
        if (!data.pages || !data.site) throw new Error("missing pages/site");
        Store.replace(data);
        pageIdx = 0;
        render();
      } catch (err) {
        alert("Could not read that file: " + err.message);
      }
    });
  }

  Store.on((kind) => {
    const s = panel.querySelector("#adm-status");
    if (kind === "saved" && s) s.textContent = Store.hasDraft() ? "Draft saved" : "Published";
    flag.hidden = !Store.hasDraft() || !panel.hidden;
  });

  function open() {
    const idx = pages().indexOf(current());
    if (idx >= 0) pageIdx = idx;
    panel.hidden = false;
    document.documentElement.classList.add("has-admin");
    if (!authed()) return renderLogin();
    Free.setEditing(true);
    flag.hidden = true;
    render();
  }
  function close() {
    panel.hidden = true;
    document.documentElement.classList.remove("has-admin");
    Free.setEditing(false);
    flag.hidden = !Store.hasDraft();
  }

  // Keep the Pages tab in sync with navigation
  window.addEventListener("popstate", () => {
    const idx = pages().indexOf(current());
    if (!panel.hidden && idx >= 0 && tab === "pages") { pageIdx = idx; render(); }
  });

  flag.hidden = !Store.hasDraft();

  window.Admin = { open, close };
})();

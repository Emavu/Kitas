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
      ["flipDuration", "Unstack speed (s)", 0.3, 2, 0.05],
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
    "Rūgštis": { colorBg: "#050805", colorInk: "#ecffe0", colorDim: "#9bb88a", colorLine: "#26401d", colorAccent: "#c6ff2e", colorAccent2: "#ff3cac", colorName1: "#ecffe0", colorName2: "#c6ff2e", particleOuter: "#3dff8b", particleCore: "#f4ff9e" }
  };

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
        <button class="adm__x" data-act="close" type="button" aria-label="Close">✕</button>
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

  function pagesTab() {
    const pages = D().pages;
    pageIdx = Math.min(pageIdx, pages.length - 1);
    const p = pages[pageIdx];
    const base = `pages.${pageIdx}`;
    const dup = pages.some((o, i) => i !== pageIdx && o.slug === p.slug);

    const blocks = (p.blocks || []).map((b, bi) => {
      const bp = `${base}.blocks.${bi}`;
      let body = field("Heading", `${bp}.heading`);
      if (b.type === "text") body += field("Text (blank line = new paragraph)", `${bp}.body`, { area: true, rows: 6 });
      if (b.type === "video") body += field("YouTube / Vimeo link", `${bp}.url`);
      if (b.type === "stacks") {
        body += (b.groups || []).map((g, gi) => {
          const gp = `${bp}.groups.${gi}`;
          return `<div class="adm__sub">
            <div class="adm__row">${field("Group title", `${gp}.title`)}${field("Year", `${gp}.year`)}</div>
            ${field(`Images — one URL per line (${(g.images || []).length})`, `${gp}.images`, { area: true, rows: 4, lines: true })}
            <div class="adm__mini">
              <button type="button" data-act="ph" data-path="${gp}">+ 4 placeholders</button>
              <button type="button" data-act="g-up" data-path="${bp}" data-i="${gi}">↑</button>
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
            <button type="button" data-act="b-up" data-i="${bi}">↑</button>
            <button type="button" data-act="b-down" data-i="${bi}">↓</button>
            <button type="button" data-act="b-del" data-i="${bi}">Delete</button>
          </span>
        </div>${body}</div>`;
    }).join("");

    return `
      <div class="adm__pagelist">
        ${pages.map((o, i) => `<button type="button" data-page="${i}" class="${i === pageIdx ? "is-on" : ""}">${esc(o.title || "(untitled)")}${o.hidden ? " ◌" : ""}</button>`).join("")}
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

      <fieldset class="adm__group"><legend>Blocks</legend>
        ${blocks || `<p class="adm__note">No blocks yet.</p>`}
        <div class="adm__mini adm__mini--add">
          <button type="button" data-act="b-add" data-type="stacks">+ Photo stacks</button>
          <button type="button" data-act="b-add" data-type="text">+ Text</button>
          <button type="button" data-act="b-add" data-type="video">+ Video</button>
        </div>
      </fieldset>
      ${pageIdx > 0 ? `<button type="button" class="adm__btn adm__btn--danger" data-act="p-del">Delete this page</button>` : ""}`;
  }

  function siteTab() {
    const links = (D().site.links || []).map((l) => `${l.label} | ${l.url}`).join("\n");
    return `<fieldset class="adm__group"><legend>Site</legend>
      ${field("Name", "site.name")}
      ${field("Role line", "site.role")}
      ${field("Email", "site.email")}
      <label class="adm__field"><span>Links — "Label | URL", one per line</span>
        <textarea rows="4" data-links>${esc(links)}</textarea></label>
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
    if (t.dataset.bind) {
      let v = t.value;
      if (t.dataset.lines) v = v.split("\n").map((s) => s.trim()).filter(Boolean);
      if (t.dataset.slug) {
        v = slugify(v);
        const url = panel.querySelector("#adm-url");
        if (url) url.textContent = `${location.origin}/${v}`;
      }
      const viewing = pages()[pageIdx] === current();
      setPath(t.dataset.bind, v);
      if (t.dataset.slug && viewing) history.replaceState(null, "", `/${v}`);
      if (/^pages\.\d+\.title$/.test(t.dataset.bind)) {
        const btn = panel.querySelector(`[data-page="${pageIdx}"]`);
        if (btn) btn.textContent = (v || "(untitled)") + (pages()[pageIdx].hidden ? " ◌" : "");
      }
      return Store.change("content");
    }
    if (t.dataset.links !== undefined) {
      D().site.links = t.value.split("\n").map((l) => l.split("|").map((s) => s.trim())).filter((a) => a[0] && a[1]).map(([label, url]) => ({ label, url }));
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
        if (!confirm(`Delete page "${pages()[pageIdx].title}"?`)) return;
        pages().splice(pageIdx, 1);
        pageIdx = 0;
        App.go("/");
      },
      "b-add": () => {
        const type = b.dataset.type;
        const block = { type, heading: "" };
        if (type === "text") block.body = "";
        if (type === "video") block.url = "";
        if (type === "stacks") block.groups = [{ title: "Nauja grupė", year: String(new Date().getFullYear()), images: placeholders(6) }];
        blocksOf().push(block);
      },
      "b-up": () => move(blocksOf(), i, -1),
      "b-down": () => move(blocksOf(), i, 1),
      "b-del": () => { if (confirm("Delete this block?")) blocksOf().splice(i, 1); },
      "g-add": () => getPath(b.dataset.path).groups.push({ title: "Nauja grupė", year: "", images: placeholders(6) }),
      "g-up": () => move(getPath(b.dataset.path).groups, i, -1),
      "g-del": () => { if (confirm("Delete this image group?")) getPath(b.dataset.path).groups.splice(i, 1); },
      "ph": () => { const g = getPath(b.dataset.path); g.images = (g.images || []).concat(placeholders(4)); },
      "reset-design": () => { Object.assign(D().design, window.SITE_DEFAULTS.design); },
      "font-remove": () => {
        D().design.customFont = null;
        if (D().design.nameFont === "custom") D().design.nameFont = "silver-northern";
      }
    };
    if (structural[act]) {
      structural[act]();
      Store.change(act === "reset-design" ? "design" : "content");
      return render();
    }
    if (act === "close") return close();
    if (act === "copy-url") return copy(panel.querySelector("#adm-url").textContent, b);
    if (act === "copy-json") return copy(JSON.stringify(D(), null, 2), b);
    if (act === "download") return download();
    if (act === "discard") {
      if (confirm("Throw away all unpublished edits in this browser?")) { Store.discardDraft(); render(); }
    }
  });

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
    flag.hidden = true;
    render();
  }
  function close() {
    panel.hidden = true;
    document.documentElement.classList.remove("has-admin");
    flag.hidden = !Store.hasDraft();
  }

  // Keep the Pages tab in sync with navigation
  window.addEventListener("popstate", () => {
    const idx = pages().indexOf(current());
    if (!panel.hidden && idx >= 0 && tab === "pages") { pageIdx = idx; render(); }
  });

  flag.addEventListener("click", (e) => { e.preventDefault(); open(); });
  flag.hidden = !Store.hasDraft();

  window.Admin = { open, close };
})();

/* Router + page rendering.
   Every page lives at /<slug>. Pages marked "hidden" are left out of the menu,
   so they can only be reached by someone who has the link. */
(function () {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const robots = document.getElementById("meta-robots");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Plain text → paragraphs; URLs become links; only a short opening paragraph gets the big lead style
  const linkify = (h) => h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const paras = (txt) => String(txt || "").replace(/\t/g, " ").split(/\n\s*\n/).filter((p) => p.trim())
    .map((p, i) => `<p${i === 0 && p.length < 180 ? ' class="lead"' : ""}>${linkify(esc(p.trim())).replace(/\n/g, "<br>")}</p>`).join("");

  // Fonts in the Typekit kit (ozo8xwr) that can be used for the name
  const NAME_FONTS = {
    "silver-northern": { weight: 400 },
    "sztos-variable": { weight: 800 },
    "podium-soft-variable": { weight: 800 },
    "bimbo-pro-dripping-jumbo": { weight: 900 }
  };
  window.NAME_FONTS = NAME_FONTS;

  // A font file dropped into the admin panel, stored inside content.js as a data URL
  let customFace = null, customSrc = null;
  function loadCustomFont(cf) {
    if (customSrc === cf.data) return;
    customSrc = cf.data;
    if (customFace) document.fonts.delete(customFace);
    customFace = new FontFace("rv-custom", `url(${cf.data})`);
    customFace.load().then((f) => document.fonts.add(f)).catch(() => console.warn("Font failed to load:", cf.name));
  }

  function slugFromPath() {
    return decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, "").toLowerCase();
  }

  // Page-level overrides of the site design (background colours, image, particles)
  const PAGE_BG_KEYS = ["colorBg", "colorInk", "colorAccent", "particleOuter", "particleCore"];
  window.PAGE_BG_KEYS = PAGE_BG_KEYS;
  const bgImg = document.getElementById("bgimg");

  function currentPage() {
    const slug = slugFromPath();
    return Store.data.pages.find((p) => (p.slug || "") === slug);
  }

  function applyDesign() {
    const page = currentPage();
    const bg = (page && page.bg) || {};
    const d = Object.assign({}, Store.data.design);
    PAGE_BG_KEYS.forEach((k) => { if (bg[k]) d[k] = bg[k]; });
    d.particlesOff = !!bg.particlesOff;
    bgImg.style.backgroundImage = bg.image ? `url("${String(bg.image).replace(/"/g, "%22")}")` : "none";
    bgImg.style.opacity = bg.image ? (bg.imageOpacity ?? 0.5) : 0;
    const s = document.documentElement.style;
    const colors = { "--bg": d.colorBg, "--ink": d.colorInk, "--ink-dim": d.colorDim, "--line": d.colorLine,
      "--accent": d.colorAccent, "--accent-2": d.colorAccent2, "--name-1": d.colorName1, "--name-2": d.colorName2 };
    for (const k in colors) if (colors[k]) s.setProperty(k, colors[k]);
    s.setProperty("--text-scale", d.textScale);
    s.setProperty("--stack-rot", `${d.stackRotation}deg`);
    s.setProperty("--stack-spread", `${d.stackSpread}px`);
    s.setProperty("--grid-cols", Math.round(d.gridColumns));
    if (d.nameFont === "custom" && d.customFont && d.customFont.data) {
      loadCustomFont(d.customFont);
      s.setProperty("--name-font", `"rv-custom", sans-serif`);
      s.setProperty("--name-weight", 400);
    } else {
      const key = d.nameFont in NAME_FONTS ? d.nameFont : "silver-northern";
      s.setProperty("--name-font", `"${key}", sans-serif`);
      s.setProperty("--name-weight", NAME_FONTS[key].weight);
    }
    Vortex.configure(d);
  }

  function videoEmbed(url) {
    const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return null;
  }

  function renderBlock(b, ctx) {
    if (b.type === "panel") {
      if (!ctx.free) return "";
      const c = (b.color || "#000000").replace("#", "");
      const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) || 0).join(", ");
      return `<div class="glass" style="--glass: rgba(${rgb}, ${b.opacity ?? 0.4}); --blur: ${b.blur ?? 16}px"></div>`;
    }
    const sid = b.heading ? ` id="s-${ctx.i}"` : "";
    const head = b.heading ? `<h2 class="block__head"><span class="block__idx">${String(ctx.i + 1).padStart(2, "0")}</span>${esc(b.heading)}</h2>` : "";
    if (b.type === "text") {
      return `<section class="block block--text reveal"${sid}>${head}<div class="prose">${paras(b.body)}</div></section>`;
    }
    if (b.type === "video") {
      const src = b.url ? videoEmbed(b.url) : null;
      const media = src
        ? `<iframe src="${esc(src)}" title="${esc(b.heading || "Video")}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
        : `<div class="video__empty"><span>Video</span><small>Įklijuok YouTube ar Vimeo nuorodą administravimo skydelyje</small></div>`;
      return `<section class="block block--video reveal"${sid}>${head}<div class="video">${media}</div></section>`;
    }
    if (b.type === "stacks") {
      if (!(b.groups || []).some((g) => (g.images || []).length)) return "";
      const html = Stacks.render(b.groups || [], ctx.groupOffset);
      ctx.groupOffset += (b.groups || []).length;
      return `<section class="block block--stacks reveal"${sid}>${head}${html}</section>`;
    }
    return "";
  }

  function renderNav(current, sections = []) {
    const { site, pages } = Store.data;
    const links = pages
      .filter((p) => !p.hidden)
      .map((p) => `<a href="/${esc(p.slug)}" data-link class="${p.slug === current ? "is-current" : ""}">${esc(p.title)}</a>`)
      .join("");
    const secs = sections.length
      ? `<ol class="nav__sections">${sections.map((s) => `<li><a href="#${s.id}" data-section="${s.id}">${esc(s.label)}</a></li>`).join("")}</ol>`
      : "";
    nav.innerHTML = `<nav class="nav__links">${links}</nav>${secs}`;
  }

  function renderPage() {
    Stacks.reset();
    const { site, pages } = Store.data;
    const slug = slugFromPath();

    if (slug === "admin") {
      Admin.open();
      history.replaceState(null, "", "/");
      return renderPage();
    }

    const page = pages.find((p) => (p.slug || "") === slug);
    renderNav(page ? page.slug : null);
    applyDesign();
    robots.content = page && !page.hidden ? "index,follow" : "noindex,nofollow";

    if (!page) {
      document.title = `404 — ${site.name}`;
      app.innerHTML = `
        <section class="hero hero--page">
          <p class="hero__kicker">404</p>
          <h1 class="hero__title">Nėra</h1>
          <p class="hero__lede">Tokio puslapio nėra — arba nuoroda pasikeitė. <a href="/" data-link>Į pradžią →</a></p>
        </section>`;
      return afterRender();
    }

    document.title = page.slug ? `${page.title} — ${site.name}` : site.name;
    const [first, ...rest] = site.name.split(/\s+/);
    const free = page.layout === "free";
    const ctx = { i: 0, groupOffset: 0, free };
    const sections = (page.blocks || [])
      .map((b, i) => {
        const empty = b.type === "stacks" && !(b.groups || []).some((g) => (g.images || []).length);
        return b.heading && b.type !== "panel" && !empty ? { id: `s-${i}`, label: b.heading } : null;
      })
      .filter(Boolean)
      .concat([{ id: "kontaktai", label: "Kontaktai" }]);
    renderNav(page.slug, sections);
    applyDesign();

    if (free) {
      Free.ensureBoxes(page);
      const items = [
        { key: "title", type: "title", box: page.boxes.title, html: `<p class="hero__kicker">${page.hidden ? "Tik su nuoroda" : esc(site.name)}</p><h1 class="hero__title">${esc(page.title)}</h1>` },
        { key: "intro", type: "intro", box: page.boxes.intro, html: page.intro ? `<p class="free__intro">${esc(page.intro)}</p>` : "" }
      ];
      (page.blocks || []).forEach((b, i) => {
        ctx.i = i;
        const html = renderBlock(b, ctx);
        if (html) items.push({ key: `b${i}`, type: b.type, box: b.box, html });
      });
      app.innerHTML = Free.render(items) + footer(site);
      afterRender();
      return Free.mount(page);
    }

    const blocks = (page.blocks || []).map((b, i) => { ctx.i = i; return renderBlock(b, ctx); }).join("");

    const hero = page.slug
      ? `<section class="hero hero--page">
           <p class="hero__kicker">${page.hidden ? "Tik su nuoroda" : esc(site.name)}</p>
           <h1 class="hero__title">${esc(page.title)}</h1>
           ${page.intro ? `<p class="hero__lede">${esc(page.intro)}</p>` : ""}
         </section>`
      : `<section class="hero">
           <h1 class="hero__name"><span>${esc(first)}</span><span>${esc(rest.join(" "))}</span></h1>
           <div class="hero__aside">
             <p class="hero__role">${esc(site.role)}</p>
             ${page.intro ? `<p class="hero__lede">${esc(page.intro)}</p>` : ""}
             <p class="hero__scroll">Slink žemyn ↓</p>
           </div>
         </section>`;

    app.innerHTML = `${hero}${blocks}${footer(site)}`;
    afterRender();
  }

  function footer(site) {
    const links = (site.links || []).filter((l) => l.label && l.url);
    return `
      <footer class="foot reveal" id="kontaktai">
        <p class="foot__label">Rašyk</p>
        <a class="foot__mail" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
        ${links.length ? `<ul class="foot__big">${links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}<span aria-hidden="true">↗</span></a></li>`).join("")}</ul>` : ""}
        <div class="foot__row"><span>© ${new Date().getFullYear()} ${esc(site.name)}</span></div>
      </footer>`;
  }

  let io, sio;
  function afterRender() {
    Stacks.bind(app);
    sio && sio.disconnect();
    sio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        nav.querySelectorAll("[data-section]").forEach((a) => a.classList.toggle("is-current", a.dataset.section === e.target.id));
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    nav.querySelectorAll("[data-section]").forEach((a) => {
      const el = document.getElementById(a.dataset.section);
      if (el) sio.observe(el);
    });
    io && io.disconnect();
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    app.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  function go(href) {
    if (href === location.pathname) return;
    history.pushState(null, "", href);
    renderPage();
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", (e) => {
    const sec = e.target.closest("a[data-section]");
    if (sec) {
      e.preventDefault();
      document.getElementById(sec.dataset.section)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const a = e.target.closest("a[data-link]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    go(a.getAttribute("href"));
  });
  window.addEventListener("popstate", renderPage);

  let renderTimer;
  Store.on((kind) => {
    if (kind === "saved") return;
    applyDesign();
    if (kind !== "design" && kind !== "layout") {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => { if (!Stacks.isOpen()) renderPage(); }, 200);
    }
  });

  window.App = { go, render: renderPage, slug: slugFromPath };

  document.addEventListener("DOMContentLoaded", () => {
    applyDesign();
    Vortex.start();
    renderPage();
  });
})();

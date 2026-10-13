/* Router + page rendering.
   Every page lives at /<slug>. Pages marked "hidden" are left out of the menu,
   so they can only be reached by someone who has the link. */
(function () {
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const robots = document.getElementById("meta-robots");
  const BASE_PATH = new URL(document.baseURI).pathname.replace(/\/?$/, "/");
  const sitePath = (slug = "") => `${BASE_PATH}${slug}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const paras = (txt) => String(txt || "").split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

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
    const pathname = decodeURIComponent(location.pathname);
    const relativePath = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
    return relativePath.replace(/^\/+|\/+$/g, "").toLowerCase();
  }

  function applyDesign() {
    const d = Store.data.design;
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
    const head = b.heading ? `<h2 class="block__head"><span class="block__idx">${String(ctx.i + 1).padStart(2, "0")}</span>${esc(b.heading)}</h2>` : "";
    if (b.type === "text") {
      return `<section class="block block--text reveal">${head}<div class="prose">${paras(b.body)}</div></section>`;
    }
    if (b.type === "video") {
      const src = b.url ? videoEmbed(b.url) : null;
      const media = src
        ? `<iframe src="${esc(src)}" title="${esc(b.heading || "Video")}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
        : `<div class="video__empty"><span>Video</span><small>Įklijuok YouTube ar Vimeo nuorodą administravimo skydelyje</small></div>`;
      return `<section class="block block--video reveal">${head}<div class="video">${media}</div></section>`;
    }
    if (b.type === "stacks") {
      const html = Stacks.render(b.groups || [], ctx.groupOffset);
      ctx.groupOffset += (b.groups || []).length;
      return `<section class="block block--stacks reveal">${head}${html}</section>`;
    }
    return "";
  }

  function renderNav(current) {
    const { site, pages } = Store.data;
    const links = pages
      .filter((p) => !p.hidden)
      .map((p) => `<a href="${sitePath(esc(p.slug))}" data-link class="${p.slug === current ? "is-current" : ""}">${esc(p.title)}</a>`)
      .join("");
    nav.innerHTML = `<nav class="nav__links">${links}</nav>`;
  }

  function renderPage() {
    Stacks.reset();
    const { site, pages } = Store.data;
    const slug = slugFromPath();

    if (slug === "admin") {
      Admin.open();
      history.replaceState(null, "", sitePath());
      return renderPage();
    }

    const page = pages.find((p) => (p.slug || "") === slug);
    renderNav(page ? page.slug : null);
    robots.content = page && !page.hidden ? "index,follow" : "noindex,nofollow";

    if (!page) {
      document.title = `404 — ${site.name}`;
      app.innerHTML = `
        <section class="hero hero--page">
          <p class="hero__kicker">404</p>
          <h1 class="hero__title drip">Nėra</h1>
          <p class="hero__lede">Tokio puslapio nėra — arba nuoroda pasikeitė. <a href="${sitePath()}" data-link>Į pradžią →</a></p>
        </section>`;
      return afterRender();
    }

    document.title = page.slug ? `${page.title} — ${site.name}` : site.name;
    const [first, ...rest] = site.name.split(/\s+/);
    const ctx = { i: 0, groupOffset: 0 };
    const blocks = (page.blocks || []).map((b, i) => { ctx.i = i; return renderBlock(b, ctx); }).join("");

    const hero = page.slug
      ? `<section class="hero hero--page">
           <p class="hero__kicker">${page.hidden ? "Tik su nuoroda" : esc(site.name)}</p>
           <h1 class="hero__title drip">${esc(page.title)}</h1>
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

    app.innerHTML = `
      ${hero}
      ${blocks}
      <footer class="foot reveal">
        <p class="foot__label">Rašyk</p>
        <a class="foot__mail" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
        <div class="foot__row">
          <span>© ${new Date().getFullYear()} ${esc(site.name)}</span>
          <span class="foot__links">${(site.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}</span>
        </div>
      </footer>`;
    afterRender();
  }

  let io;
  function afterRender() {
    Stacks.bind(app);
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
    if (kind !== "design") {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => { if (!Stacks.isOpen()) renderPage(); }, 200);
    }
  });

  window.App = { go, render: renderPage, slug: slugFromPath, path: sitePath };

  document.addEventListener("DOMContentLoaded", () => {
    applyDesign();
    Vortex.start();
    renderPage();
  });
})();

/* Image stacks. Clicking a stack opens it in place: its description and photos
   unfold inside the card (a plain CSS height + fade transition, cheap on phones)
   and the caption stays underneath. Clicking a photo shows it large. */
(function () {
  let active = null;  // { stack, panel, freeItem }
  let pending = null; // finishes a card that is still closing

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const linkify = (h) => h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const paras = (txt) => String(txt || "").split(/\n\s*\n/).filter((p) => p.trim())
    .map((p) => `<p>${linkify(esc(p.trim())).replace(/\n/g, "<br>")}</p>`).join("");

  // Cloudinary can resize on the fly: ask for a web-sized copy instead of the original
  // (originals are often 2–9 MB each). Other image hosts are used as they are.
  function sized(url, w) {
    return /res\.cloudinary\.com\/[^/]+\/image\/upload\/(?!.*\b[wc]_\d)/.test(url)
      ? url.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${w}/`)
      : url;
  }
  const PILE_VISIBLE = 4; // only the top of the pile shows; the rest load when the stack opens

  // Deterministic pseudo-random so piles look the same on every render
  function jitter(seed) {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x) - 0.5;
  }

  function pileVars(i) {
    if (i === 0) return "--x:0;--y:0;--r:0;";
    const k = Math.min(i, 4);
    return `--x:${(jitter(i * 3 + 1) * 2).toFixed(2)};--y:${(jitter(i * 7 + 2) * 2).toFixed(2)};--r:${(jitter(i * 5 + 3) * 2 * (k / 4 + 0.5)).toFixed(2)};`;
  }

  function render(groups) {
    return `<div class="stacks">${groups
      .map((g) => {
        const imgs = (g.images || []).filter(Boolean);
        return `
        <figure class="stack" tabindex="0" role="button" aria-expanded="false" aria-label="Atidaryti: ${esc(g.title)}" data-text="${esc(g.text || "")}">
          <div class="stack__pile">
            ${imgs.map((src, i) => {
              const url = esc(sized(src, 900));
              const load = i < PILE_VISIBLE ? `src="${url}" loading="lazy"` : `data-src="${url}"`;
              return `<img class="stack__img" ${load} decoding="async" data-full="${esc(sized(src, 2000))}" alt="${esc(g.title)} ${i + 1}" style="${pileVars(i)}z-index:${imgs.length - i}" draggable="false">`;
            }).join("")}
          </div>
          <figcaption class="stack__cap">
            <span class="stack__title">${esc(g.title)}</span>
            ${g.year ? `<span class="stack__meta">${esc(g.year)}</span>` : ""}
          </figcaption>
        </figure>`;
      })
      .join("")}</div>`;
  }

  function setRatio(img) {
    const apply = () => {
      if (!img.naturalWidth) return;
      const ar = img.naturalWidth / img.naturalHeight;
      img.style.setProperty("--ar", ar.toFixed(3));
      img.classList.toggle("is-wide", ar > 1.25);
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener("load", apply, { once: true });
  }

  function bind(root) {
    root.querySelectorAll(".stack").forEach((stack) => {
      stack.querySelectorAll(".stack__img").forEach(setRatio);
      stack.addEventListener("click", (e) => {
        if (e.target.closest(".gpanel__close")) return close();
        const photo = e.target.closest(".gpanel .stack__img");
        if (photo) return Lightbox.open(photo);
        if (e.target.closest(".gpanel")) return; // text and gaps inside an open card
        toggle(stack);
      });
      stack.addEventListener("keydown", (e) => {
        if (e.target !== stack) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(stack); }
      });
    });
  }

  function toggle(stack) {
    if (pending) pending();
    if (active && active.stack === stack) return close();
    if (active) close(true);
    open(stack);
  }

  function open(stack) {
    const freeItem = stack.closest(".free__item");
    const closedHeight = freeItem ? freeItem.offsetHeight : 0;
    const imgs = [...stack.querySelectorAll(".stack__pile .stack__img")];
    imgs.forEach((img) => {
      if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
    });

    const text = stack.dataset.text;
    const panel = document.createElement("div");
    panel.className = "gpanel";
    panel.innerHTML = `
      <div class="gpanel__body">
        <button type="button" class="gpanel__close" aria-label="Uždaryti">${ICONS.close}</button>
        ${text ? `<div class="gpanel__text">${paras(text)}</div>` : ""}
        <div class="gpanel__grid"></div>
      </div>`;
    const grid = panel.querySelector(".gpanel__grid");
    imgs.forEach((img) => grid.appendChild(img));
    stack.insertBefore(panel, stack.querySelector(".stack__cap"));

    active = { stack, panel, freeItem };
    stack.classList.add("is-open");
    stack.setAttribute("aria-expanded", "true");
    if (freeItem) {
      freeItem.classList.add("has-panel");
      Free.setExpanded(freeItem, closedHeight);
    }
    // read a size first so the browser registers the folded state, then let CSS unfold it
    void panel.offsetHeight;
    panel.classList.add("is-shown");

    const top = stack.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.5) stack.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // instant = true when another card opens right away (no need to animate this one shut)
  function close(instant) {
    if (!active) return;
    const { stack, panel, freeItem } = active;
    active = null;
    const finish = () => {
      pending = null;
      if (!panel.isConnected) return;
      const pile = stack.querySelector(".stack__pile");
      panel.querySelectorAll(".stack__img").forEach((img) => pile.appendChild(img));
      panel.remove();
      stack.classList.remove("is-open");
      stack.setAttribute("aria-expanded", "false");
      if (freeItem) {
        freeItem.classList.remove("has-panel");
        Free.setExpanded(null);
      }
    };
    if (instant === true) return finish();
    pending = finish;
    panel.classList.remove("is-shown");
    panel.addEventListener("transitionend", (e) => { if (e.target === panel) finish(); });
    setTimeout(finish, 600); // in case transitionend doesn't fire (e.g. reduced motion)
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !Lightbox.isOpen()) close();
  });

  // ---------- Lightbox: one photo, large ----------
  const Lightbox = (function () {
    let box = null, list = [], index = 0;

    function build() {
      box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = `
        <img class="lightbox__img" alt="">
        <button type="button" class="lightbox__btn lightbox__close" aria-label="Uždaryti">${ICONS.close}</button>
        <button type="button" class="lightbox__btn lightbox__prev" aria-label="Ankstesnė">${ICONS.chevronLeft}</button>
        <button type="button" class="lightbox__btn lightbox__next" aria-label="Kita">${ICONS.chevronRight}</button>`;
      document.body.appendChild(box);
      box.addEventListener("click", (e) => {
        if (e.target.closest(".lightbox__prev")) return step(-1);
        if (e.target.closest(".lightbox__next")) return step(1);
        hide();
      });
      // swipe left / right on phones
      let x0 = null;
      box.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      box.addEventListener("touchend", (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 50) { e.preventDefault(); step(dx < 0 ? 1 : -1); }
      });
    }

    function show(i) {
      index = (i + list.length) % list.length;
      const img = box.querySelector(".lightbox__img");
      img.src = list[index].dataset.full || list[index].src;
      img.alt = list[index].alt;
      box.classList.toggle("is-single", list.length < 2);
    }

    function open(thumb) {
      if (!box) build();
      list = [...thumb.parentElement.querySelectorAll(".stack__img")];
      show(list.indexOf(thumb));
      box.classList.add("is-open");
      document.documentElement.classList.add("is-locked");
    }

    function step(dir) { show(index + dir); }

    function hide() {
      if (!box) return;
      box.classList.remove("is-open");
      document.documentElement.classList.remove("is-locked");
    }

    document.addEventListener("keydown", (e) => {
      if (!box || !box.classList.contains("is-open")) return;
      if (e.key === "Escape") hide();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });

    return { open, hide, isOpen: () => !!box && box.classList.contains("is-open") };
  })();

  window.Stacks = {
    render,
    bind,
    isOpen: () => !!active,
    // Called on route change: the DOM is about to be replaced, just forget the open card
    reset() {
      Lightbox.hide();
      pending = null;
      if (active && active.freeItem) Free.setExpanded(null);
      active = null;
    }
  };
})();

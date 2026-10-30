/* Image stacks. Clicking a stack opens it in place: the card grows to the full
   width of the page, its description and photos unfold inside it (the photos fly
   out of the pile, GSAP Flip) and the caption slides down underneath them.
   Everything after the card moves down to make room. Clicking a photo enlarges it. */
(function () {
  gsap.registerPlugin(Flip);

  let active = null;   // { stack, panel, freeItem }
  let busy = false;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const linkify = (h) => h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const paras = (txt) => String(txt || "").split(/\n\s*\n/).filter((p) => p.trim())
    .map((p) => `<p>${linkify(esc(p.trim())).replace(/\n/g, "<br>")}</p>`).join("");
  const design = () => Store.data.design;

  // Cloudinary can resize on the fly: ask for a web-sized copy instead of the original
  // (originals are often 2–9 MB each). Other image hosts are used as they are.
  function sized(url, w) {
    return /res\.cloudinary\.com\/[^/]+\/image\/upload\/(?!.*\b[wc]_\d)/.test(url)
      ? url.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${w}/`)
      : url;
  }
  const PILE_VISIBLE = 4; // only the top of the pile is visible; the rest load when the stack opens

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
            ${imgs
              .map((src, i) => {
                const url = esc(sized(src, 900));
                const load = i < PILE_VISIBLE ? `src="${url}" loading="lazy" decoding="async"` : `data-src="${url}" decoding="async"`;
                return `<img class="stack__img" ${load} data-full="${esc(sized(src, 2000))}" alt="${esc(g.title)} ${i + 1}" style="${pileVars(i)}z-index:${imgs.length - i}" draggable="false">`;
              })
              .join("")}
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
    if (busy) return;
    if (active && active.stack === stack) return close();
    if (active) return close(() => open(stack));
    open(stack);
  }

  // Everything whose position changes when a card opens or closes, so Flip can animate it
  function movers(stack) {
    const freeItem = stack.closest(".free__item");
    const canvas = stack.closest(".free");
    const list = freeItem && canvas && !canvas.classList.contains("is-flow")
      ? [...canvas.querySelectorAll(":scope > .free__item")]
      : [...stack.parentElement.querySelectorAll(":scope > .stack")];
    return list.concat([...stack.querySelectorAll(".stack__img, .stack__cap")]);
  }

  function animate(state, d, done) {
    Flip.from(state, {
      duration: d,
      ease: "expo.inOut",
      nested: true,
      scale: false,
      simple: false,
      onComplete: done
    });
  }

  function open(stack) {
    busy = true;
    const d = design().flipDuration;
    const imgs = [...stack.querySelectorAll(".stack__pile .stack__img")];
    imgs.forEach((img) => {
      img.loading = "eager";
      if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
    });
    const freeItem = stack.closest(".free__item");
    const closedHeight = freeItem ? freeItem.offsetHeight : 0;

    const state = Flip.getState(movers(stack));

    const panel = document.createElement("div");
    panel.className = "gpanel";
    const text = stack.dataset.text;
    panel.innerHTML = `
      <button type="button" class="gpanel__close" aria-label="Uždaryti">${ICONS.close}</button>
      ${text ? `<div class="gpanel__text">${paras(text)}</div>` : ""}
      <div class="gpanel__grid"></div>`;
    const grid = panel.querySelector(".gpanel__grid");
    imgs.forEach((img) => grid.appendChild(img));
    stack.insertBefore(panel, stack.querySelector(".stack__cap"));

    active = { stack, panel, freeItem };
    stack.classList.add("is-open");
    stack.setAttribute("aria-expanded", "true");
    if (freeItem) freeItem.classList.add("has-panel");
    document.documentElement.classList.add("is-flipping");
    if (freeItem) Free.setExpanded(freeItem, closedHeight); else Free.layout();

    gsap.fromTo(panel.querySelectorAll(".gpanel__text, .gpanel__close"), { autoAlpha: 0, y: 24 },
      { autoAlpha: 1, y: 0, duration: d * 0.6, delay: d * 0.35, stagger: 0.08, ease: "expo.out" });
    animate(state, d, () => {
      document.documentElement.classList.remove("is-flipping");
      busy = false;
      Free.layout();
      const r = stack.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.6) window.scrollTo({ top: window.scrollY + r.top - 96, behavior: "smooth" });
    });
  }

  function close(then) {
    if (!active || busy) return;
    busy = true;
    const { stack, panel, freeItem } = active;
    const d = design().flipDuration;
    const pile = stack.querySelector(".stack__pile");

    const state = Flip.getState(movers(stack));
    [...panel.querySelectorAll(".stack__img")].forEach((img) => pile.appendChild(img));
    panel.remove();
    stack.classList.remove("is-open");
    stack.setAttribute("aria-expanded", "false");
    if (freeItem) freeItem.classList.remove("has-panel");
    document.documentElement.classList.add("is-flipping");
    stack.classList.add("is-returning");
    Free.setExpanded(null);

    animate(state, d, () => {
      stack.classList.remove("is-returning");
      document.documentElement.classList.remove("is-flipping");
      active = null;
      busy = false;
      Free.layout();
      if (then) then();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !Lightbox.isOpen()) close();
  });

  // ---------- Lightbox: one photo, large ----------
  const Lightbox = (function () {
    let box = null, list = [], index = 0, from = null;

    function build() {
      box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = `
        <div class="lightbox__bg"></div>
        <img class="lightbox__img" alt="">
        <button type="button" class="lightbox__btn lightbox__close" aria-label="Uždaryti">${ICONS.close}</button>
        <button type="button" class="lightbox__btn lightbox__prev" aria-label="Ankstesnė">${ICONS.chevronLeft}</button>
        <button type="button" class="lightbox__btn lightbox__next" aria-label="Kita">${ICONS.chevronRight}</button>`;
      document.body.appendChild(box);
      box.querySelector(".lightbox__close").addEventListener("click", hide);
      box.querySelector(".lightbox__bg").addEventListener("click", hide);
      box.querySelector(".lightbox__prev").addEventListener("click", () => step(-1));
      box.querySelector(".lightbox__next").addEventListener("click", () => step(1));
      box.querySelector(".lightbox__img").addEventListener("click", hide);
    }

    // Animate the big image from / to the thumbnail's rectangle
    function fly(img, rect, reverse, done) {
      const r = img.getBoundingClientRect();
      const sx = rect.width / r.width, sy = rect.height / r.height;
      const dx = rect.left + rect.width / 2 - (r.left + r.width / 2);
      const dy = rect.top + rect.height / 2 - (r.top + r.height / 2);
      const small = { x: dx, y: dy, scaleX: sx, scaleY: sy };
      const big = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      gsap.fromTo(img, reverse ? big : small, Object.assign({}, reverse ? small : big, { duration: 0.6, ease: "expo.inOut", onComplete: done }));
    }

    function show(i) {
      index = (i + list.length) % list.length;
      const img = box.querySelector(".lightbox__img");
      img.src = list[index].dataset.full || list[index].src;
      img.alt = list[index].alt;
      box.classList.toggle("is-single", list.length < 2);
      return img;
    }

    function open(thumb) {
      if (!box) build();
      list = [...thumb.parentElement.querySelectorAll(".stack__img")];
      from = thumb;
      const img = show(list.indexOf(thumb));
      box.classList.add("is-open");
      document.documentElement.classList.add("is-locked");
      gsap.fromTo(box.querySelector(".lightbox__bg"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
      gsap.fromTo(box.querySelectorAll(".lightbox__btn"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, delay: 0.3 });
      const go = () => fly(img, thumb.getBoundingClientRect(), false);
      img.complete && img.naturalWidth ? go() : img.addEventListener("load", go, { once: true });
    }

    function step(dir) {
      const img = box.querySelector(".lightbox__img");
      gsap.to(img, { autoAlpha: 0, x: -dir * 40, duration: 0.2, onComplete: () => {
        show(index + dir);
        from = list[index];
        gsap.fromTo(img, { autoAlpha: 0, x: dir * 40 }, { autoAlpha: 1, x: 0, duration: 0.35, ease: "expo.out" });
      } });
    }

    function hide() {
      if (!box || !box.classList.contains("is-open")) return;
      const img = box.querySelector(".lightbox__img");
      gsap.to(box.querySelectorAll(".lightbox__btn"), { autoAlpha: 0, duration: 0.2 });
      gsap.to(box.querySelector(".lightbox__bg"), { autoAlpha: 0, duration: 0.5, delay: 0.15 });
      const finish = () => {
        box.classList.remove("is-open");
        gsap.set(img, { clearProps: "all" });
        document.documentElement.classList.remove("is-locked");
      };
      if (from && from.isConnected) fly(img, from.getBoundingClientRect(), true, finish);
      else gsap.to(img, { autoAlpha: 0, duration: 0.3, onComplete: finish });
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
      if (!active) return;
      Free.setExpanded(null);
      document.documentElement.classList.remove("is-flipping");
      active = null;
      busy = false;
    }
  };
})();

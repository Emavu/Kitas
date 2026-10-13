/* Image stacks that unstack into a grid on click (GSAP Flip),
   in the spirit of Codrops' ImageStackGrid. */
(function () {
  gsap.registerPlugin(Flip);

  const overlay = document.getElementById("unstack");
  const bgEl = overlay.querySelector(".unstack__bg");
  const inner = overlay.querySelector(".unstack__inner");
  const grid = document.getElementById("unstack-grid");
  const titleEl = document.getElementById("unstack-title");
  const numEl = document.getElementById("unstack-num");
  const closeBtn = document.getElementById("unstack-close");

  let active = null;   // the .stack currently open
  let busy = false;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const design = () => Store.data.design;

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

  function render(groups, offset) {
    return `<div class="stacks">${groups
      .map((g, gi) => {
        const imgs = (g.images || []).filter(Boolean);
        const num = String(offset + gi + 1).padStart(2, "0");
        return `
        <figure class="stack" data-title="${esc(g.title)}" data-num="${num}" tabindex="0" role="button" aria-label="Atidaryti: ${esc(g.title)}">
          <div class="stack__pile">
            ${imgs
              .map((src, i) => `<img class="stack__img" src="${esc(src)}" alt="${esc(g.title)} ${i + 1}" style="${pileVars(i)}z-index:${imgs.length - i}" ${i < 4 ? "" : 'loading="lazy"'} draggable="false">`)
              .join("")}
          </div>
          <figcaption class="stack__cap">
            <span class="stack__num">${num}</span>
            <span class="stack__title">${esc(g.title)}</span>
            <span class="stack__meta">${esc(g.year || "")} — ${imgs.length} foto</span>
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
    img.complete ? apply() : img.addEventListener("load", apply, { once: true });
  }

  function bind(root) {
    root.querySelectorAll(".stack").forEach((stack) => {
      stack.querySelectorAll(".stack__img").forEach(setRatio);
      stack.addEventListener("click", () => open(stack));
      stack.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(stack); }
      });
    });
  }

  function open(stack) {
    if (busy || active) return;
    busy = true;
    active = stack;
    const d = design().flipDuration;
    const pile = stack.querySelector(".stack__pile");
    const imgs = [...pile.querySelectorAll(".stack__img")];
    imgs.forEach((img) => img.loading = "eager");

    titleEl.textContent = stack.dataset.title;
    numEl.textContent = stack.dataset.num;

    const state = Flip.getState(imgs);
    document.documentElement.classList.add("is-locked", "is-flipping");
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    inner.scrollTop = 0;
    imgs.forEach((img) => grid.appendChild(img));

    gsap.fromTo(bgEl, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: d * 0.75, ease: "expo.inOut" });
    gsap.fromTo(".unstack__head > *", { yPercent: 110 }, { yPercent: 0, duration: d * 0.8, ease: "expo.out", delay: d * 0.4, stagger: 0.06 });
    Flip.from(state, {
      duration: d,
      ease: "expo.inOut",
      stagger: Math.min(0.04, 0.5 / imgs.length),
      absolute: true,
      zIndex: 5,
      onComplete: () => {
        document.documentElement.classList.remove("is-flipping");
        busy = false;
        closeBtn.focus({ preventScroll: true });
      }
    });
  }

  function close() {
    if (busy || !active) return;
    busy = true;
    const stack = active;
    const d = design().flipDuration;
    const pile = stack.querySelector(".stack__pile");
    const imgs = [...grid.querySelectorAll(".stack__img")];

    const state = Flip.getState(imgs);
    document.documentElement.classList.add("is-flipping");
    stack.classList.add("is-returning");
    imgs.forEach((img) => pile.appendChild(img));

    gsap.to(".unstack__head > *", { yPercent: -110, duration: d * 0.4, ease: "expo.in" });
    gsap.to(bgEl, { clipPath: "inset(0% 0% 100% 0%)", duration: d * 0.7, ease: "expo.inOut" });
    Flip.from(state, {
      duration: d,
      ease: "expo.inOut",
      stagger: { each: Math.min(0.03, 0.4 / imgs.length), from: "end" },
      absolute: true,
      onComplete: () => {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        document.documentElement.classList.remove("is-locked", "is-flipping");
        stack.classList.remove("is-returning");
        active = null;
        busy = false;
        stack.focus({ preventScroll: true });
      }
    });
  }

  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  window.Stacks = {
    render,
    bind,
    isOpen: () => !!active,
    // Called on route change: put images back without animation
    reset() {
      if (!active) return;
      gsap.killTweensOf(bgEl);
      overlay.classList.remove("is-open");
      document.documentElement.classList.remove("is-locked", "is-flipping");
      grid.innerHTML = "";
      active = null;
      busy = false;
    }
  };
})();

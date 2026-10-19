/* Warm particle vortex. Spins on its own, and much harder while you scroll. */
(function () {
  const canvas = document.getElementById("vortex");
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BINS = 24;

  let cfg = {};
  let W = 0, H = 0, dpr = 1;
  let n = 0, rn, ang, hueBin, size, speed;
  let bins = [];          // particle indices grouped by colour
  let palette = [];
  let rot = 0, boost = 0;
  let lastY = window.scrollY, lastT = performance.now();
  let pointer = { x: 0.5, y: 0.5 }, center = { x: 0.5, y: 0.5 };

  const rand = Math.random;
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

  function spawn(i, edge) {
    rn[i] = edge ? 0.85 + rand() * 0.15 : Math.pow(rand(), 0.7);
    const arm = Math.floor(rand() * cfg.arms);
    ang[i] = (arm / cfg.arms) * Math.PI * 2 + gauss() * (0.55 / Math.sqrt(cfg.arms));
  }

  function init() {
    n = Math.round(cfg.particleCount);
    rn = new Float32Array(n);
    ang = new Float32Array(n);
    size = new Float32Array(n);
    speed = new Float32Array(n);
    hueBin = new Uint8Array(n);
    bins = Array.from({ length: BINS }, () => []);
    for (let i = 0; i < n; i++) {
      spawn(i, false);
      size[i] = 0.4 + rand() * rand() * 2.2;
      speed[i] = 0.5 + rand();
      hueBin[i] = Math.floor(rand() * BINS);
      bins[hueBin[i]].push(i);
    }
  }

  const hex = (h) => {
    const m = String(h || "#000").replace("#", "");
    const f = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.padEnd(6, "0");
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
  };
  const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
  let cOuter, cCore, cBg, blend = "lighter";

  function buildPalette() {
    cOuter = hex(cfg.particleOuter);
    cCore = hex(cfg.particleCore);
    cBg = hex(cfg.colorBg);
    // light backgrounds: additive light would wash particles out to white, so darken-blend instead
    const lum = (0.2126 * cBg[0] + 0.7152 * cBg[1] + 0.0722 * cBg[2]) / 255;
    blend = lum > 0.5 ? "multiply" : "lighter";
    palette = [];
    for (let b = 0; b < BINS; b++) {
      const t = b / (BINS - 1);
      const c = cOuter.map((v, i) => Math.round(v + (cCore[i] - v) * t));
      palette.push(rgba(c, 1));
    }
  }

  function bg(alpha) {
    return rgba(cBg, alpha);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = canvas.width = Math.round(innerWidth * dpr);
    H = canvas.height = Math.round(innerHeight * dpr);
    ctx.fillStyle = bg(1);
    ctx.fillRect(0, 0, W, H);
  }

  function frame(t) {
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;

    // Scroll velocity → spin boost (signed, decays smoothly)
    const y = window.scrollY;
    const v = (y - lastY) / Math.max(innerHeight, 1);
    lastY = y;
    boost += v * 14;
    boost *= Math.pow(0.04, dt);

    const motion = reduced ? 0.2 : 1;
    rot += dt * motion * (cfg.spinSpeed + boost * cfg.scrollSpin);

    center.x += (pointer.x - center.x) * dt * 1.5;
    center.y += (pointer.y - center.y) * dt * 1.5;
    const cx = (cfg.centerX + (center.x - 0.5) * 0.04) * W;
    const cy = (cfg.centerY + (center.y - 0.5) * 0.04) * H;
    const R = Math.hypot(W, H) * 0.5 * cfg.radius;

    // Fade previous frame → trails
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = bg(1 - cfg.trail);
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = blend;

    if (cfg.particlesOff) return requestAnimationFrame(frame);

    // Core glow
    if (cfg.glow > 0) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
      const a = cfg.glow * (1 - cfg.trail) * 0.9;
      const mid = cOuter.map((v, i) => (v + cCore[i]) >> 1);
      g.addColorStop(0, rgba(cCore, a));
      g.addColorStop(0.35, rgba(mid, a * 0.45));
      g.addColorStop(1, rgba(cOuter, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const inflow = dt * motion * cfg.inflow * 0.06 * (1 + Math.abs(boost) * 3);
    const twist = cfg.twist;
    const ps = cfg.particleSize * dpr;

    for (let b = 0; b < BINS; b++) {
      ctx.fillStyle = palette[b];
      const list = bins[b];
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        let r = rn[i] - inflow * speed[i] * (0.25 + rn[i]);
        if (r < 0.015) { spawn(i, true); r = rn[i]; }
        rn[i] = r;
        const th = ang[i] + r * twist * Math.PI * 0.5 + rot;
        const x = cx + Math.cos(th) * r * R;
        const y2 = cy + Math.sin(th) * r * R;
        const s = size[i] * ps * (0.45 + r);
        ctx.fillRect(x, y2, s, s);
      }
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    pointer.x = e.clientX / innerWidth;
    pointer.y = e.clientY / innerHeight;
  });

  window.Vortex = {
    configure(next) {
      const needInit = !n || next.particleCount !== cfg.particleCount || next.arms !== cfg.arms;
      cfg = Object.assign({}, next);
      cfg.arms = Math.max(1, Math.round(cfg.arms));
      buildPalette();
      if (needInit) init();
    },
    start() {
      resize();
      requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
    }
  };
})();

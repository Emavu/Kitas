/* Warm particle vortex. Spins on its own, and much harder while you scroll.
   Styles: "particles" (glowing specks), "paint" (opaque brush dabs that smear along
   the spin, with drops running down) and "ink" (pen-and-ink drawing: several spirals,
   stippled or made of scales). */
(function () {
  const canvas = document.getElementById("vortex");
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BINS = 24;

  let cfg = {};
  let W = 0, H = 0, dpr = 1;
  let n = 0, rn, ang, hueBin, size, speed, px, py;
  let drips = [];
  let dripShine = "#ffffff";
  const MAX_DRIPS = 90;
  let bins = [];          // particle indices grouped by colour
  let palette = [];
  let rot = 0, boost = 0;
  let lastY = window.scrollY, lastT = performance.now();
  let pointer = { x: 0.5, y: 0.5 }, center = { x: 0.5, y: 0.5 };

  const rand = Math.random;
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

  function spawn(i, edge) {
    if (px) px[i] = NaN; // no smear from the old position to the new one
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
    px = new Float32Array(n).fill(NaN);
    py = new Float32Array(n);
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

  let glowCanvas = null, glowKey = "";
  function glowSprite() {
    const key = cfg.particleCore + cfg.particleOuter;
    if (glowCanvas && glowKey === key) return glowCanvas;
    glowKey = key;
    glowCanvas = glowCanvas || document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 256;
    const g = glowCanvas.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    const mid = cOuter.map((v, i) => (v + cCore[i]) >> 1);
    grad.addColorStop(0, rgba(cCore, 1));
    grad.addColorStop(0.35, rgba(mid, 0.45));
    grad.addColorStop(1, rgba(cOuter, 0));
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return glowCanvas;
  }

  function bg(alpha) {
    return rgba(cBg, alpha);
  }

  function resize() {
    dpr = 1; // soft, glowing background: full device resolution isn't visible, but costs 4–9x more per frame
    W = canvas.width = Math.round(innerWidth * dpr);
    H = canvas.height = Math.round(innerHeight * dpr);
    ctx.fillStyle = bg(1);
    ctx.fillRect(0, 0, W, H);
  }

  let skip = false;
  function frame(t) {
    // idle (not scrolling): draw every other frame — the slow spin looks the same at 30 fps
    skip = !skip;
    if (skip && Math.abs(boost) < 0.02 && !reduced) return requestAnimationFrame(frame);
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

    if (cfg.particlesOff) { drips = []; return requestAnimationFrame(frame); }
    if (cfg.vortexStyle === "ink") {
      inkFrame(dt, motion);
      return requestAnimationFrame(frame);
    }
    const paint = cfg.vortexStyle === "paint";

    // Core glow: a pre-drawn sprite, only as big as the glow itself
    if (cfg.glow > 0 && (!paint || blend === "lighter")) {
      const gr = R * 0.55;
      ctx.globalAlpha = Math.min(1, cfg.glow * (1 - cfg.trail) * 0.9);
      ctx.drawImage(glowSprite(), cx - gr, cy - gr, gr * 2, gr * 2);
      ctx.globalAlpha = 1;
    }

    const inflow = dt * motion * cfg.inflow * 0.06 * (1 + Math.abs(boost) * 3);
    const twist = cfg.twist;
    const ps = cfg.particleSize * dpr;

    if (paint) {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    for (let b = 0; b < BINS; b++) {
      const list = bins[b];
      if (paint) {
        // one stroke per colour; widths vary between colours so the dabs look hand-made
        ctx.strokeStyle = palette[b];
        ctx.lineWidth = ps * (1.2 + ((b * 7) % 5) * 0.55);
        ctx.beginPath();
      } else {
        ctx.fillStyle = palette[b];
      }
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        let r = rn[i] - inflow * speed[i] * (0.25 + rn[i]);
        if (r < 0.015) { spawn(i, true); r = rn[i]; }
        rn[i] = r;
        const th = ang[i] + r * twist * Math.PI * 0.5 + rot;
        const x = cx + Math.cos(th) * r * R;
        const y2 = cy + Math.sin(th) * r * R;
        if (paint) {
          if (px[i] === px[i]) { ctx.moveTo(px[i], py[i]); ctx.lineTo(x, y2); }
          else { ctx.moveTo(x, y2); ctx.lineTo(x + 0.1, y2); }
        } else {
          const s = size[i] * ps * (0.45 + r);
          ctx.fillRect(x, y2, s, s);
        }
        px[i] = x;
        py[i] = y2;
      }
      if (paint) ctx.stroke();
    }

    if (paint) runDrips(dt, motion);
    else drips = [];

    requestAnimationFrame(frame);
  }

  // ---------- ink style ----------
  // Fixed composition (seeded), so the drawing looks the same on every visit.
  // [x, y] position on screen (0–1), scale, texture, spin direction
  const INK_LAYOUT = [
    [0.16, 0.8, 0.72, "stipple", -1],
    [0.86, 0.84, 0.48, "scales", 1],
    [0.3, 0.12, 0.42, "stipple", 1],
    [0.93, 0.18, 0.34, "scales", -1]
  ];
  let ink = null;

  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function initInk() {
    const R = seeded(11);
    const arms = Math.max(1, Math.round(cfg.arms));
    ink = INK_LAYOUT.map(([dx, dy, sc, kind, dir]) => {
      const v = { dx, dy, sc, kind, dir, rot: R() * Math.PI * 2 };
      const m = Math.round(cfg.particleCount * (kind === "stipple" ? 0.65 : 0.1) * sc);
      v.u = new Float32Array(m); v.a = new Float32Array(m); v.o = new Float32Array(m); v.s = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        v.u[i] = kind === "stipple" ? Math.pow(R(), 0.6) : 0.12 + R() * 0.88;
        v.a[i] = kind === "stipple" ? (Math.floor(R() * arms) / arms) * Math.PI * 2 : R() * Math.PI * 2;
        v.o[i] = (R() + R() + R() - 1.5) / 1.5;
        v.s[i] = 0.5 + R() * R() * 2.5;
      }
      return v;
    });
  }

  function inkFrame(dt, motion) {
    if (!ink) initInk();
    ctx.globalCompositeOperation = "source-over";
    const M = Math.min(W, H);
    const base = M * 0.5 * cfg.radius * 1.5;
    const turns = 0.35 + cfg.twist * 0.32;
    const inkC = rgba(cOuter, 1);
    const ps = cfg.particleSize * dpr;
    const TAU = Math.PI * 2;

    for (const v of ink) {
      v.rot += dt * motion * (cfg.spinSpeed + boost * cfg.scrollSpin) * v.dir * (0.8 / v.sc);
      const cx = v.dx * W, cy = v.dy * H, Rv = base * v.sc;
      if (cx + Rv < 0 || cx - Rv > W || cy + Rv < 0 || cy - Rv > H) continue;
      const theta = (u, a) => a + v.rot + u * turns * TAU * v.dir;

      if (v.kind === "stipple") {
        const pull = dt * motion * cfg.inflow * 0.035 * (1 + Math.abs(boost) * 3);
        ctx.fillStyle = inkC;
        ctx.beginPath();
        for (let i = 0; i < v.u.length; i++) {
          let u = v.u[i] - pull * (0.3 + v.u[i]);
          if (u < 0.03) u = 1;
          v.u[i] = u;
          const th = theta(u, v.a[i]);
          const r = u * Rv + v.o[i] * Rv * 0.075 * (0.3 + u);
          const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
          const s = v.s[i] * ps * (0.5 + u * 1.1);
          ctx.moveTo(x + s, y);
          ctx.arc(x, y, s, 0, TAU);
        }
        ctx.fill();
      }

      if (v.kind === "scales") {
        ctx.fillStyle = inkC;
        ctx.beginPath();
        for (let i = 0; i < v.u.length; i++) {
          const u = v.u[i];
          const th = theta(u, v.a[i]);
          const r = u * Rv;
          const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
          const rx = v.s[i] * Rv * 0.022 * (0.45 + u), ry = rx * 0.48;
          const rot = th + Math.PI / 2;
          ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
          ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
        }
        ctx.fill();
      }
    }
  }

  // ---------- paint drips ----------
  function particleSource() {
    const i = Math.floor(rand() * n);
    return px[i] === px[i] ? { x: px[i], y: py[i], c: palette[hueBin[i]] } : null;
  }

  function runDrips(dt, motion, source = particleSource, shine = "#ffffff", scale = 1) {
    dripShine = shine;
    const rate = (cfg.drips ?? 0.5) * 7 * scale * (1 + Math.abs(boost) * 3) * motion;
    if (drips.length < MAX_DRIPS && rand() < rate * dt) {
      const p = source();
      if (p && p.x > 0 && p.x < W && p.y > 0 && p.y < H) {
        const w = p.w ? p.w * (0.35 + rand() * 0.35) : (3.5 + rand() * 6) * dpr * Math.max(0.6, cfg.particleSize / 1.5);
        drips.push({
          x: p.x, y0: p.y, y: p.y, v: 0, w,
          c: p.c,
          max: (25 + rand() * 120) * dpr * (cfg.dripLength ?? 1),
          hold: rand() * 0.5, a: 1
        });
      }
    }
    ctx.globalCompositeOperation = "source-over";
    const g = 90 * dpr; // paint is thick: it creeps, it doesn't fall
    for (let k = drips.length - 1; k >= 0; k--) {
      const d = drips[k];
      if (d.hold > 0) d.hold -= dt;
      else {
        d.v = Math.min(d.v + g * dt * (0.4 + rand()), 70 * dpr);
        if (rand() < 0.012) { d.v *= 0.15; d.hold = rand() * 0.35; } // paint catches, then runs again
        d.y += d.v * dt * motion;
      }
      if (d.y - d.y0 > d.max || d.y > H + 40) d.a -= dt * 0.9;
      if (d.a <= 0) { drips.splice(k, 1); continue; }
      drawDrip(d);
    }
    ctx.globalAlpha = 1;
  }

  function drawDrip(d) {
    const { x, y0, y, w } = d;
    const len = y - y0;
    const head = w * 0.7 * Math.min(1, 0.55 + len / (w * 6));
    ctx.globalAlpha = d.a;
    ctx.fillStyle = d.c;
    ctx.beginPath();
    ctx.arc(x, y0, w * 0.75, 0, Math.PI * 2); // the blob it ran from
    ctx.moveTo(x - w * 0.5, y0);
    ctx.quadraticCurveTo(x - w * 0.16, y0 + len * 0.6, x - head, y);
    ctx.arc(x, y, head, Math.PI, 0, true);       // round bulb at the bottom
    ctx.quadraticCurveTo(x + w * 0.16, y0 + len * 0.6, x + w * 0.5, y0);
    ctx.closePath();
    ctx.fill();
    // wet highlight
    ctx.globalAlpha = d.a * 0.35;
    ctx.fillStyle = dripShine;
    ctx.beginPath();
    ctx.arc(x - head * 0.35, y - head * 0.2, head * 0.28, 0, Math.PI * 2);
    ctx.fill();
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
      if (needInit) { init(); ink = null; }
    },
    start() {
      resize();
      requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
    }
  };
})();

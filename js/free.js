/* Free layout — a Figma-like canvas for a page.
   Every item has a box {x, y, w, h?, z}, all in % of the canvas width, so the
   composition scales with the screen. In /admin, items can be dragged and resized.
   Below 720px the canvas falls back to a simple column ordered top-to-bottom. */
(function () {
  const SNAP = 8;
  const MOBILE = 720;
  let canvas = null, page = null, editing = false, selected = null;
  let ro = null, raf = 0;
  let expanded = null; // { el, closedHeight, from }: an opened gallery card; items starting below it move down

  function boxOf(key) {
    if (key === "title" || key === "intro") return page.boxes[key];
    return page.blocks[+key.slice(1)].box;
  }

  // Give every item a box when a page is switched to free layout
  function ensureBoxes(p) {
    p.boxes = p.boxes || {};
    p.boxes.title = p.boxes.title || { x: 2, y: 6, w: 70, z: 3 };
    p.boxes.intro = p.boxes.intro || { x: 40, y: 24, w: 40, z: 3 };
    let y = 36;
    (p.blocks || []).forEach((b, i) => {
      if (b.box) return;
      if (b.type === "panel") b.box = { x: 36, y: 21, w: 48, h: 12, z: 1 };
      else { b.box = { x: i % 2 ? 48 : 2, y, w: b.type === "text" ? 44 : 50, z: 2 }; y += 40; }
    });
  }

  function itemHtml(key, type, inner, box) {
    return `<div class="free__item free__item--${type}" data-key="${key}" style="z-index:${box.z || 2}">
      ${inner}
      <div class="free__ui">
        <span class="free__tag">${type}
          <button type="button" data-z="1" title="Bring forward">${ICONS.arrowUp}</button>
          <button type="button" data-z="-1" title="Send back">${ICONS.arrowDown}</button>
        </span>
        <span class="free__resize" data-resize></span>
      </div>
    </div>`;
  }

  function render(items) {
    return `<div class="free" id="free">${items.map((it) => itemHtml(it.key, it.type, it.html, it.box)).join("")}</div>`;
  }

  function layout() {
    if (!canvas) return;
    const W = canvas.clientWidth;
    canvas.style.setProperty("--cw", W + "px"); // lets type scale with the canvas, like a Figma frame
    const flow = W < MOBILE;
    canvas.classList.toggle("is-flow", flow);
    const items = [...canvas.querySelectorAll(".free__item")];
    if (flow) {
      canvas.style.height = "";
      items
        .map((el) => ({ el, b: boxOf(el.dataset.key) }))
        .sort((a, c) => a.b.y - c.b.y || a.b.x - c.b.x)
        .forEach(({ el }, i) => { el.style.cssText = `order:${i}`; });
      return;
    }
    const exp = expanded && expanded.el.isConnected ? expanded : null;
    let shift = 0;
    // An opened card keeps its place; narrow ones widen to at least 60% so photos stay readable.
    // Only what starts below the card moves, and only by as much as the card grew.
    let expX = 0, expW = 0;
    if (exp) {
      const b = boxOf(exp.el.dataset.key);
      expW = Math.max(b.w, 60);
      expX = Math.min(b.x, 100 - expW);
      exp.el.style.left = expX + "%";
      exp.el.style.width = expW + "%";
      shift = Math.max(0, exp.el.offsetHeight - exp.closedHeight);
    }
    let bottom = 0;
    items.forEach((el) => {
      const b = boxOf(el.dataset.key);
      let top = (b.y / 100) * W;
      const isExp = exp && el === exp.el;
      if (exp && !isExp && top >= exp.from) top += shift;
      el.style.left = (isExp ? expX : b.x) + "%";
      el.style.top = top + "px";
      el.style.width = (isExp ? expW : b.w) + "%";
      el.style.height = b.h ? (b.h / 100) * W + "px" : "";
      el.style.zIndex = b.z || 2;
      el.style.order = "";
      bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
    });
    canvas.style.height = bottom + SNAP * 8 + "px";
    const rects = items.map((el) => [el.offsetLeft, el.offsetTop, el.offsetLeft + el.offsetWidth, el.offsetTop + el.offsetHeight]);
    items.forEach((el, i) => {
      const r = rects[i];
      const overlaps = rects.some((o, j) => j !== i && r[0] < o[2] && o[0] < r[2] && r[1] < o[3] && o[1] < r[3]);
      el.classList.toggle("has-overlap", overlaps);
    });
  }
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };

  function mount(p) {
    page = p;
    expanded = null;
    canvas = document.getElementById("free");
    ro && ro.disconnect();
    if (!canvas) return;
    ro = new ResizeObserver(schedule);
    ro.observe(canvas.parentElement);
    canvas.querySelectorAll(".free__item").forEach((el) => ro.observe(el));
    canvas.classList.toggle("is-editing", editing);
    if (selected) canvas.querySelector(`[data-key="${selected}"]`)?.classList.add("is-sel");
    layout();
  }

  function setEditing(on) {
    editing = on;
    if (canvas) canvas.classList.toggle("is-editing", on);
  }

  function select(el) {
    canvas.querySelectorAll(".is-sel").forEach((n) => n.classList.remove("is-sel"));
    selected = el ? el.dataset.key : null;
    el && el.classList.add("is-sel");
  }

  // ---------- drag / resize ----------
  let drag = null;
  document.addEventListener("pointerdown", (e) => {
    if (!editing || !canvas || canvas.classList.contains("is-flow")) return;
    const el = e.target.closest(".free__item");
    if (!el || !canvas.contains(el)) return;
    select(el);
    const zBtn = e.target.closest("[data-z]");
    if (zBtn) {
      const b = boxOf(el.dataset.key);
      b.z = Math.max(0, (b.z || 2) + +zBtn.dataset.z);
      el.style.zIndex = b.z;
      Store.change("layout");
      return;
    }
    e.preventDefault();
    const W = canvas.clientWidth;
    drag = {
      el, W,
      box: boxOf(el.dataset.key),
      mode: e.target.closest("[data-resize]") ? "resize" : "move",
      sx: e.clientX, sy: e.clientY,
      left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight
    };
    el.setPointerCapture(e.pointerId);
    el.classList.add("is-dragging");
  });

  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const { el, W, box } = drag;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    const snap = (v) => Math.round(v / SNAP) * SNAP;
    if (drag.mode === "move") {
      const left = Math.min(Math.max(0, snap(drag.left + dx)), W - drag.width);
      const top = Math.max(0, snap(drag.top + dy));
      box.x = +(left / W * 100).toFixed(2);
      box.y = +(top / W * 100).toFixed(2);
      el.style.left = box.x + "%";
      el.style.top = top + "px";
      schedule();
    } else {
      const width = Math.min(Math.max(SNAP * 8, snap(drag.width + dx)), W - drag.left);
      box.w = +(width / W * 100).toFixed(2);
      el.style.width = box.w + "%";
      if (box.h !== undefined) {
        const height = Math.max(SNAP * 4, snap(drag.height + dy));
        box.h = +(height / W * 100).toFixed(2);
        el.style.height = height + "px";
      }
    }
  });

  document.addEventListener("pointerup", () => {
    if (!drag) return;
    drag.el.classList.remove("is-dragging");
    drag = null;
    schedule();
    Store.change("layout");
  });

  // Arrow keys nudge the selected item by 8px (Shift = 40px)
  document.addEventListener("keydown", (e) => {
    if (!editing || !selected || !canvas || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const W = canvas.clientWidth, step = (e.shiftKey ? SNAP * 5 : SNAP) / W * 100;
    const b = boxOf(selected);
    b.x = +Math.min(Math.max(0, b.x + d[0] * step), 100 - b.w).toFixed(2);
    b.y = +Math.max(0, b.y + d[1] * step).toFixed(2);
    layout();
    Store.change("layout");
  });

  // Open a card in place (el) or close it again (null)
  // closedHeight: the card's height before it opened
  function setExpanded(el, closedHeight = 0) {
    if (el && canvas && canvas.contains(el)) {
      const W = canvas.clientWidth;
      const top = (boxOf(el.dataset.key).y / 100) * W;
      expanded = { el, closedHeight, from: top + 1 };
    } else {
      expanded = null;
    }
    layout();
  }

  window.Free = { ensureBoxes, render, mount, setEditing, setExpanded, layout: schedule };
})();

/* Line icons as inline SVG. Used instead of text symbols (✕ ↗ ↓ …), which some
   phones turn into colour emoji. They inherit the text colour. */
(function () {
  const svg = (paths, extra = "") =>
    `<svg class="icon${extra}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true" focusable="false">${paths}</svg>`;

  window.ICONS = {
    close: svg('<path d="M5 5l14 14M19 5L5 19"/>'),
    arrowUpRight: svg('<path d="M7 17L17 7M8 7h9v9"/>'),
    arrowDown: svg('<path d="M12 4v16M5 13l7 7 7-7"/>'),
    arrowUp: svg('<path d="M12 20V4M5 11l7-7 7 7"/>'),
    arrowRight: svg('<path d="M4 12h16M13 5l7 7-7 7"/>'),
    chevronLeft: svg('<path d="M15 4l-8 8 8 8"/>'),
    chevronRight: svg('<path d="M9 4l8 8-8 8"/>'),
    hidden: svg('<circle cx="12" cy="12" r="6" stroke-dasharray="3 3"/>')
  };
})();

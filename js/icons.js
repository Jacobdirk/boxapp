// Custom exercise pictograms (24x24, white line art). Exercises reference them as icon: 'svg:<key>'.
// Anything else in exercise.icon is rendered as an emoji/text, so user-made exercises keep working.
(function () {
  const head = (x, y, r = 1.8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
  const db = (x, y) => `<path d="M${x - 2} ${y}h4"/><path d="M${x - 2} ${y - 1.3}v2.6M${x + 2} ${y - 1.3}v2.6" stroke-width="2.4"/>`;
  const dbV = (x, y) => `<path d="M${x} ${y - 2}v4"/><path d="M${x - 1.3} ${y - 2}h2.6M${x - 1.3} ${y + 2}h2.6" stroke-width="2.4"/>`;
  const bar = (x1, x2, y) => `<path d="M${x1} ${y}H${x2}"/><path d="M${x1 + 1} ${y - 2.2}v4.4M${x2 - 1} ${y - 2.2}v4.4" stroke-width="2.6"/>`;

  const ICONS = {
    pullup: `<path d="M3 3H21"/>${head(12, 7.2)}<path d="M7 3l1.5 5.5L12 9.5l3.5-1L17 3"/><path d="M12 9.5V15l-2 6M12 15l2 6"/>`,
    chinup: `<path d="M3 3H21"/>${head(12, 6.4)}<path d="M10 3L9 7.5l3 2 3-2L14 3"/><path d="M12 9.5V15l-1.5 3 2 3M12 15l1.5 3-2 3"/>`,
    latpulley: `<circle cx="12" cy="2.5" r="1.2"/><path d="M12 3.7V6M4.5 6h15"/>${head(12, 8.6, 1.6)}<path d="M5.5 6l3 4.5 3.5 1 3.5-1 3-4.5"/><path d="M12 11v5h4v5M7 16h10"/>`,
    cablerow: `<path d="M21 4v16"/><path d="M21 11h-6"/>${head(6.5, 6)}<path d="M6.5 8v7M6.5 10l4.5 2 4-1"/><path d="M6.5 15h7l1.5 3M3 15h4"/><path d="M3 20h18" stroke-width="1.2"/>`,
    dbrow: `<path d="M3 13h9M5 13v7M10 13v7"/>${head(17.5, 7)}<path d="M15.5 8L8 11.5"/><path d="M11 10.2V16"/>${dbV(11, 18)}<path d="M8 11.5L8 20M15.5 8l3 5v7"/>`,
    barbellrow: `${head(18, 6)}<path d="M16.5 7.5L8 11l-1 4 1 5M8 11l2 4-1 5"/><path d="M14 9v6M11 10v5"/>${bar(4, 20, 16)}`,
    hexdeadlift: `${head(12, 3.8)}<path d="M12 5.8v7l-2 8M12 12.8l2 8M12 7.5l-3.5 5M12 7.5l3.5 5"/><path d="M8.5 12.5h7l1.5 2-1.5 2h-7l-1.5-2z"/><path d="M3 14.5h4M17 14.5h4" stroke-width="2.6"/>`,
    deadlift: `${head(12, 3.8)}<path d="M12 5.8v7l-2 8M12 12.8l2 8M12 7.5l-2.5 6M12 7.5l2.5 6"/>${bar(3, 21, 13.5)}`,
    rdl: `${head(17, 5)}<path d="M15.5 6.5L8 10l1 5-1 6M8 10l2.5 5-1 6"/><path d="M13 8v8.5M11 9v7.5"/>${bar(4, 20, 16.5)}`,
    bench: `<path d="M4 15h16M6 15v5M18 15v5"/>${head(5.5, 12.5)}<path d="M7.5 13h8l2 3.5-1 3.5M9.5 13V7.5M13 13V7.5"/>${bar(4, 18.5, 6)}`,
    shoulderpress: `${bar(3, 21, 4)}${head(12, 8)}<path d="M8 4l-1 5 3.5 2M16 4l1 5-3.5 2M12 10v6l-2 5M12 16l2 5"/>`,
    dbshoulderpress: `${dbV(6, 4)}${dbV(18, 4)}${head(12, 8)}<path d="M6 6.5l1 4 3.5 1M18 6.5l-1 4-3.5 1M12 10v6l-2 5M12 16l2 5"/>`,
    machinepress: `<path d="M19 3v18M5 21h14"/><path d="M15 5h4" stroke-width="2.6"/>${head(11, 7.5)}<path d="M15 5l-1 4.5-3 1M11 9.5V15h4l1 6M7 15h8"/>`,
    squat: `${bar(4, 20, 6)}${head(12, 3.6)}<path d="M8 6l1.5 3h5L16 6"/><path d="M12 9v5l-4 1.5 1 5.5M12 14l4 1.5-1 5.5"/>`,
    legpress: `<path d="M3 20l8-3"/>${head(4.5, 12)}<path d="M5.5 14l5 2.5 4-4 4 1M10.5 16.5l4.5-.5"/><path d="M19 7l2 12" stroke-width="2.6"/><path d="M19 13.5l-4-1"/>`,
    cablefly: `<path d="M2 3v18M22 3v18"/>${head(12, 5)}<path d="M2 6l5 4 5 1 5-1 5-4"/><path d="M12 7v8l-2 6M12 15l2 6"/>`,
    curl: `${head(10, 4)}<path d="M10 6v8l-2 7M10 14l2 7M10 8l-2 5M10 8l3.5 3.5 1.5-3.5"/>${db(15.5, 7)}`,
    triceppulley: `<circle cx="16" cy="2.5" r="1.2"/><path d="M16 3.7V13"/>${head(10, 5)}<path d="M10 7v7l-2 7M10 14l2 7M10 9l3 2 3 3"/><path d="M14.5 14h3" stroke-width="2.4"/>`,
    shrugs: `${head(12, 7)}<path d="M8 8.5l4 1.5 4-1.5M8 8.5v5M16 8.5v5M12 10v6l-2 5M12 16l2 5"/>${dbV(8, 15.5)}${dbV(16, 15.5)}<path d="M5 6V2.5L3.8 3.8M5 2.5l1.2 1.3M19 6V2.5l-1.2 1.3M19 2.5l1.2 1.3" stroke-width="1.4"/>`,
    latraise: `${head(12, 5)}<path d="M4 9h16M12 7v8l-2 6M12 15l2 6"/>${dbV(3.5, 9)}${dbV(20.5, 9)}`,
    hamcurl: `<path d="M3 15h14M5 15v5M15 15v5"/>${head(4.5, 11.5)}<path d="M6.5 12.5h8l3-5.5"/><path d="M17.5 7l1.5-2" stroke-width="2.6"/>`,
    calfraise: `${head(12, 3.8)}<path d="M12 5.8V14l-1 5 .8 1.8M12 14l1 5 .8 1.8M12 8l-3 5M12 8l3 5"/><path d="M6 21h12" stroke-width="2.6"/><path d="M18 5V2l-1.2 1.2M18 2l1.2 1.2" stroke-width="1.4"/>`,
    pushup: `${head(4.5, 10)}<path d="M6.5 11L21 15.5M8.5 11.6l.5 4.4M9 16l1.5 4"/><path d="M3 20.5h18" stroke-width="1.2"/>`,
    dips: `<path d="M4 10h5M15 10h5M5 10v11M19 10v11"/>${head(12, 4.5)}<path d="M8 10l1-3.5h6l1 3.5M9 6.5V8M15 6.5V8M12 6.5v6l-2 3 1.5 3M12 12.5l2 3-1.5 3"/>`,
    generic: `${db(12, 12)}<path d="M7 12h10" stroke-width="2.6"/>`
  };

  window.EXERCISE_ICONS = ICONS;
  window.renderExerciseIcon = icon => {
    const key = typeof icon === 'string' && icon.startsWith('svg:') ? icon.slice(4) : null;
    if (!key) return String(icon ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<svg class="ex-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key] || ICONS.generic}</svg>`;
  };
})();

/* Starmap: canvas renderer and navigation UI.
 * Depends on STARS from stars.js. No other dependencies.
 */
(() => {
  'use strict';

  /* ---- DOM ------------------------------------------------------------- */
  const canvas = document.getElementById('map');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    search: $('search'), list: $('list'), listTitle: $('list-title'),
    panelRight: $('panel-right'), infoName: $('info-name'), infoSpec: $('info-spec'),
    infoDl: $('info-dl'), routeSummary: $('route-summary'),
    btnFocus: $('btn-focus'), btnJump: $('btn-jump'), closeInfo: $('close-info'),
    range: $('range'), rangeOut: $('range-out'),
    tgLabels: $('tg-labels'), tgStalks: $('tg-stalks'), tgGrid: $('tg-grid'), tgRings: $('tg-rings'),
    btnTop: $('btn-topdown'), btnReset: $('btn-reset'), btnHelp: $('btn-help'),
    btnHelpClose: $('btn-help-close'), help: $('help'),
    readout: $('readout'), status: $('status'),
  };

  /* ---- data ------------------------------------------------------------ */
  const stars = STARS;
  const byId = new Map(stars.map((s) => [s.id, s]));
  const SOL = byId.get('sol');
  for (const s of stars) s.p = { sx: 0, sy: 0, depth: 0 };

  /* ---- constants ------------------------------------------------------- */
  const COLORS = { accent: '#4fd1ff', amber: '#ffb347', route: '#7cfc9a', dim: '#7f9ac0', text: '#cfe3ff' };
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const MONO = '"Cascadia Mono", Consolas, monospace';
  const DEFAULT_VIEW = { x: 0, y: 0, z: 0, scale: 22, yaw: -0.35, pitch: 0.95 };
  const MIN_SCALE = 3, MAX_SCALE = 260, MAX_PITCH = 1.45;

  /* ---- state ----------------------------------------------------------- */
  const cam = { ...DEFAULT_VIEW };   // rendered camera
  const camT = { ...DEFAULT_VIEW };  // target camera (smoothed toward)
  const state = {
    current: SOL, selected: null, hovered: null, route: null, trail: [SOL],
    jumpRange: 10, reachable: new Set(), inRange: new Set(),
    showLabels: true, showStalks: true, showGrid: true, showRings: true,
    w: 1, h: 1, dpr: 1,
    mouse: { x: -1, y: -1, over: false },
    drag: null,
    pointers: new Map(),
    pinch: null,
  };

  /* ---- helpers --------------------------------------------------------- */
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const fmt = (n, d = 1) => n.toFixed(d);
  const deg = (r) => Math.round((r * 180) / Math.PI);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  /* ---- camera math ----------------------------------------------------- */
  // Camera space: x1 = screen right, sY = screen up, depth = toward viewer.
  // yaw rotates about +Z (galactic pole), pitch tilts from top-down (0) toward edge-on.
  const rot = (c) => ({ cy: Math.cos(c.yaw), sy: Math.sin(c.yaw), cp: Math.cos(c.pitch), sp: Math.sin(c.pitch) });
  let R = rot(cam);

  function project(x, y, z, out) {
    const px = x - cam.x, py = y - cam.y, pz = z - cam.z;
    const x1 = R.cy * px - R.sy * py;
    const y1 = R.sy * px + R.cy * py;
    out.sx = state.w / 2 + x1 * cam.scale;
    out.sy = state.h / 2 - (R.cp * y1 + R.sp * pz) * cam.scale;
    out.depth = R.cp * pz - R.sp * y1;
    return out;
  }
  const P = (x, y, z) => project(x, y, z, {});

  // Screen point -> world point on the horizontal plane z = planeZ.
  function unprojectPlane(c, r, sx, sy, planeZ) {
    const x1 = (sx - state.w / 2) / c.scale;
    const sY = (state.h / 2 - sy) / c.scale;
    const y1 = (sY - r.sp * (planeZ - c.z)) / Math.max(r.cp, 0.08);
    return { x: c.x + r.cy * x1 + r.sy * y1, y: c.y - r.sy * x1 + r.cy * y1, z: planeZ };
  }
  function camOffset(c, r, p) {
    const px = p.x - c.x, py = p.y - c.y, pz = p.z - c.z;
    return { x1: r.cy * px - r.sy * py, sY: r.cp * (r.sy * px + r.cy * py) + r.sp * pz };
  }
  // Move a camera by a camera-space offset, constrained to the horizontal plane.
  function shiftInPlane(c, r, dx1, dsY) {
    const dy1 = dsY / Math.max(r.cp, 0.08);
    c.x += r.cy * dx1 + r.sy * dy1;
    c.y += -r.sy * dx1 + r.cy * dy1;
  }
  function panBy(dx, dy, smooth = false) {
    const r = rot(cam), dx1 = -dx / cam.scale, dsY = dy / cam.scale;
    shiftInPlane(camT, r, dx1, dsY);
    if (!smooth) shiftInPlane(cam, r, dx1, dsY);
  }
  function rotateBy(dx, dy) {
    camT.yaw += dx * 0.005;
    camT.pitch = clamp(camT.pitch - dy * 0.005, 0, MAX_PITCH);
    cam.yaw = camT.yaw; cam.pitch = camT.pitch;
  }
  function zoomAt(mx, my, factor, immediate = false) {
    const newScale = clamp(camT.scale * factor, MIN_SCALE, MAX_SCALE);
    const r = rot(camT);
    const p = unprojectPlane(camT, r, mx, my, camT.z);
    camT.scale = newScale;
    const have = camOffset(camT, r, p);
    shiftInPlane(camT, r, have.x1 - (mx - state.w / 2) / newScale, have.sY - (state.h / 2 - my) / newScale);
    if (immediate) Object.assign(cam, camT);
  }
  function focusOn(s, minScale = 0) {
    camT.x = s.x; camT.y = s.y; camT.z = s.z;
    if (camT.scale < minScale) camT.scale = minScale;
  }
  function resetView() { Object.assign(camT, DEFAULT_VIEW); }

  function smoothCamera(dt) {
    const k = 1 - Math.exp(-dt * 10);
    for (const key of ['x', 'y', 'z', 'yaw', 'pitch']) cam[key] += (camT[key] - cam[key]) * k;
    cam.scale = Math.exp(Math.log(cam.scale) + (Math.log(camT.scale) - Math.log(cam.scale)) * k);
    R = rot(cam);
  }

  /* ---- navigation ------------------------------------------------------ */
  // Fewest jumps first, shortest total distance as tie-breaker.
  function findRoute(from, to, range) {
    if (from === to) return { path: [from], hops: 0, dist: 0 };
    const cost = new Map([[from.id, 0]]), prev = new Map(), done = new Set();
    for (;;) {
      let u = null, best = Infinity;
      for (const [id, c] of cost) if (!done.has(id) && c < best) { best = c; u = byId.get(id); }
      if (!u) return null;
      if (u === to) break;
      done.add(u.id);
      for (const v of stars) {
        if (v === u || done.has(v.id)) continue;
        const d = dist3(u, v);
        if (d > range) continue;
        const nc = best + 1e6 + d;
        if (nc < (cost.has(v.id) ? cost.get(v.id) : Infinity)) { cost.set(v.id, nc); prev.set(v.id, u); }
      }
    }
    const path = [];
    for (let c = to; c; c = prev.get(c.id)) path.unshift(c);
    let dist = 0;
    for (let i = 1; i < path.length; i++) dist += dist3(path[i - 1], path[i]);
    return { path, hops: path.length - 1, dist };
  }

  function computeReachable() {
    const cur = state.current;
    const seen = new Set([cur.id]), queue = [cur];
    while (queue.length) {
      const u = queue.pop();
      for (const v of stars) if (!seen.has(v.id) && dist3(u, v) <= state.jumpRange) { seen.add(v.id); queue.push(v); }
    }
    state.reachable = seen;
    state.inRange = new Set(stars.filter((s) => s !== cur && dist3(cur, s) <= state.jumpRange).map((s) => s.id));
  }

  function select(s) {
    state.selected = s;
    state.route = s ? findRoute(state.current, s, state.jumpRange) : null;
    renderInfo();
    renderList();
  }

  function jump() {
    const r = state.route;
    if (!r || r.hops === 0) return;
    for (const s of r.path.slice(1)) state.trail.push(s);
    state.current = r.path[r.path.length - 1];
    computeReachable();
    focusOn(state.current);
    select(state.current);
    renderStatus();
  }

  /* ---- HTML panels ----------------------------------------------------- */
  function renderInfo() {
    const s = state.selected;
    ui.panelRight.classList.toggle('hidden', !s);
    if (!s) return;
    const cur = state.current;
    ui.infoName.textContent = s.name;
    ui.infoSpec.innerHTML = `<i style="background:${s.color}"></i>${esc(s.spec)} · ${esc(s.cls)}`;
    const rows = [
      ['From Sol', s === SOL ? '0.0 ly' : `${fmt(s.dist)} ly`],
      ...(cur === SOL ? [] : [[`From ${esc(cur.name)}`, s === cur ? 'current location' : `${fmt(dist3(cur, s))} ly`]]),
      ['Galactic XYZ', `${fmt(s.x)} / ${fmt(s.y)} / ${fmt(s.z)} ly`],
      ['Equatorial', s === SOL ? '—' : `RA ${fmt(s.ra, 2)}h · Dec ${fmt(s.dec, 1)}°`],
      ['Components', s.comps.map(esc).join('<br>')],
    ];
    ui.infoDl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
      + (s.note ? `<dd class="note">${esc(s.note)}</dd>` : '');

    const r = state.route;
    ui.routeSummary.className = 'route';
    if (s === cur) {
      ui.routeSummary.classList.add('here');
      ui.routeSummary.textContent = 'You are here.';
    } else if (!r) {
      ui.routeSummary.classList.add('none');
      ui.routeSummary.innerHTML = `No route within a <b>${fmt(state.jumpRange)} ly</b> jump range.`;
    } else {
      const via = r.path.slice(1, -1).map((x) => esc(x.name)).join(' → ');
      ui.routeSummary.innerHTML = `Route: <b>${r.hops}</b> jump${r.hops === 1 ? '' : 's'} · <b>${fmt(r.dist)} ly</b>`
        + (via ? `<br><small>via ${via}</small>` : '');
    }
    ui.btnJump.disabled = !(r && r.hops > 0);
  }

  function renderList() {
    const q = ui.search.value.trim().toLowerCase();
    const cur = state.current;
    let items;
    if (q) {
      items = stars.filter((s) => s.name.toLowerCase().includes(q) || s.spec.toLowerCase().startsWith(q) || s.cls.toLowerCase().includes(q));
      const starts = (s) => (s.name.toLowerCase().startsWith(q) ? 0 : 1);
      items.sort((a, b) => starts(a) - starts(b) || dist3(a, cur) - dist3(b, cur));
      ui.listTitle.innerHTML = `${items.length} match${items.length === 1 ? '' : 'es'}`;
    } else {
      items = stars.filter((s) => state.inRange.has(s.id)).sort((a, b) => dist3(a, cur) - dist3(b, cur));
      ui.listTitle.innerHTML = `Within ${fmt(state.jumpRange)} ly of <b>${esc(cur.name)}</b>`;
    }
    ui.list.innerHTML = items.map((s) =>
      `<li data-id="${s.id}" class="${s === state.selected ? 'sel' : ''}"><i style="background:${s.color}"></i><span>${esc(s.name)}</span><em>${fmt(dist3(s, cur))} ly</em></li>`
    ).join('') || '<li class="empty">Nothing in range. Increase the jump range.</li>';
  }

  function renderStatus() {
    ui.status.innerHTML = `LOCATION <b>${esc(state.current.name).toUpperCase()}</b> · JUMP RANGE <b>${fmt(state.jumpRange)} LY</b> · <b>${state.reachable.size - 1}</b> SYSTEMS REACHABLE · <b>${state.trail.length - 1}</b> JUMPS MADE`;
  }

  /* ---- sprites & background ------------------------------------------- */
  const spriteCache = new Map();
  function sprite(color) {
    let c = spriteCache.get(color);
    if (c) return c;
    const S = 64;
    c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const { r, g: gg, b } = hexRgb(color);
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.34, `rgba(${r},${gg},${b},0.5)`);
    grad.addColorStop(0.62, `rgba(${r},${gg},${b},0.12)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    spriteCache.set(color, c);
    return c;
  }

  let bgPattern = null;
  function makeBackground() {
    const S = 512;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    let seed = 1337;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 380; i++) {
      const x = rnd() * S, y = rnd() * S, rad = rnd() < 0.88 ? 0.6 : 1.2, a = 0.12 + rnd() * 0.5;
      g.fillStyle = `rgba(${200 + (rnd() * 55) | 0},${210 + (rnd() * 45) | 0},255,${a})`;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    bgPattern = ctx.createPattern(c, 'repeat');
  }
  function drawBackground() {
    const { w, h } = state;
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, '#0a1226'); g.addColorStop(1, '#03050d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Parallax: the far field slides 4 px per light-year of camera travel, independent of zoom.
    const ox = -(R.cy * cam.x - R.sy * cam.y) * 4;
    const oy = (R.cp * (R.sy * cam.x + R.cy * cam.y) + R.sp * cam.z) * 4;
    ctx.save(); ctx.translate(ox, oy); ctx.fillStyle = bgPattern;
    ctx.fillRect(-ox - 512, -oy - 512, w + 1024, h + 1024);
    ctx.restore();
  }

  /* ---- drawing --------------------------------------------------------- */
  function gridStep() {
    for (const s of [1, 2, 5, 10, 20, 50]) if (s * cam.scale >= 44) return s;
    return 100;
  }

  function drawGrid(step) {
    const { w, h } = state;
    const LIM = 90;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const c = unprojectPlane(cam, R, x, y, 0);
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    }
    minX = Math.max(minX, -LIM); maxX = Math.min(maxX, LIM);
    minY = Math.max(minY, -LIM); maxY = Math.min(maxY, LIM);
    const a = {}, b = {};
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.ceil(minX / step); i * step <= maxX; i++) {
      if (i === 0) continue;
      project(i * step, minY, 0, a); project(i * step, maxY, 0, b);
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
    }
    for (let i = Math.ceil(minY / step); i * step <= maxY; i++) {
      if (i === 0) continue;
      project(minX, i * step, 0, a); project(maxX, i * step, 0, b);
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
    }
    ctx.strokeStyle = 'rgba(90,140,220,0.10)';
    ctx.stroke();
    // axes through Sol
    ctx.beginPath();
    project(minX, 0, 0, a); project(maxX, 0, 0, b); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
    project(0, minY, 0, a); project(0, maxY, 0, b); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
    ctx.strokeStyle = 'rgba(90,140,220,0.28)';
    ctx.stroke();
    // axis hint toward the galactic centre
    const hint = P(Math.min(maxX, 12 / cam.scale * 22 + 6), 0, 0);
    ctx.font = `10px ${MONO}`; ctx.fillStyle = 'rgba(120,160,230,0.55)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('+X  galactic centre →', hint.sx + 4, hint.sy - 3);
  }

  function traceCircle(cx, cy, cz, radius, segs = 96) {
    const a = {};
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      project(cx + radius * Math.cos(t), cy + radius * Math.sin(t), cz, a);
      if (i) ctx.lineTo(a.sx, a.sy); else ctx.moveTo(a.sx, a.sy);
    }
  }

  function drawRings() {
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(120,170,255,0.16)';
    ctx.font = `11px ${MONO}`; ctx.fillStyle = 'rgba(140,180,240,0.5)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    for (const rr of [5, 10, 15, 20, 25]) {
      traceCircle(0, 0, 0, rr); ctx.stroke();
      const p = P(rr * Math.cos(-cam.yaw), rr * Math.sin(-cam.yaw), 0);
      ctx.fillText(`${rr} ly`, p.sx + 4, p.sy - 2);
    }
  }

  function drawJumpRing() {
    const c = state.current;
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,179,71,0.6)';
    traceCircle(c.x, c.y, c.z, state.jumpRange); ctx.stroke();
    ctx.restore();
  }

  function tracePath(list) {
    ctx.beginPath();
    list.forEach((s, i) => (i ? ctx.lineTo(s.p.sx, s.p.sy) : ctx.moveTo(s.p.sx, s.p.sy)));
  }

  function drawRoute(t) {
    if (state.trail.length > 1) {
      ctx.save();
      ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(255,179,71,0.4)'; ctx.lineWidth = 1;
      tracePath(state.trail); ctx.stroke();
      ctx.restore();
    }
    const r = state.route;
    if (!r || r.hops === 0) return;
    ctx.save();
    ctx.strokeStyle = COLORS.route; ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]); ctx.lineDashOffset = -(t / 40) % 16;
    ctx.shadowColor = COLORS.route; ctx.shadowBlur = 8;
    tracePath(r.path); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = COLORS.route;
    for (const s of r.path.slice(1, -1)) { ctx.beginPath(); ctx.arc(s.p.sx, s.p.sy, 3, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawStars() {
    const order = stars.slice().sort((a, b) => a.p.depth - b.p.depth);
    const foot = {};
    const { w, h } = state;
    for (const s of order) {
      const { sx, sy } = s.p;
      if (sx < -60 || sy < -400 || sx > w + 60 || sy > h + 400) continue;
      const reach = state.reachable.has(s.id);
      ctx.globalAlpha = reach ? 1 : 0.38;
      if (state.showStalks && Math.abs(s.z) > 0.05) {
        project(s.x, s.y, 0, foot);
        ctx.strokeStyle = s.z > 0 ? 'rgba(140,190,255,0.3)' : 'rgba(255,160,120,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(foot.sx, foot.sy); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.fillStyle = 'rgba(140,190,255,0.45)';
        ctx.beginPath(); ctx.arc(foot.sx, foot.sy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      const D = s.r * 7;
      ctx.drawImage(sprite(s.color), sx - D / 2, sy - D / 2, D, D);
      if (state.inRange.has(s.id)) {
        ctx.strokeStyle = 'rgba(255,179,71,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, s.r + 4, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function tag(text, x, y) {
    ctx.font = `11px ${MONO}`;
    const tw = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(5,8,18,0.85)'; ctx.fillRect(x - tw / 2, y - 9, tw, 18);
    ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function drawHover() {
    const hov = state.hovered, cur = state.current;
    if (!hov || state.drag) return;
    if (hov !== cur) {
      ctx.save();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(207,227,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cur.p.sx, cur.p.sy); ctx.lineTo(hov.p.sx, hov.p.sy); ctx.stroke();
      ctx.restore();
      tag(`${fmt(dist3(cur, hov))} ly`, (cur.p.sx + hov.p.sx) / 2, (cur.p.sy + hov.p.sy) / 2);
    }
    // tooltip
    const lines = [
      [hov.name, `600 13px ${FONT}`, '#ffffff'],
      [`${hov.spec} · ${hov.cls}`, `11px ${FONT}`, COLORS.dim],
      [hov === cur ? 'current location' : `${fmt(dist3(cur, hov))} ly from ${cur.name}`, `11px ${MONO}`, COLORS.text],
    ];
    let tw = 0;
    for (const [text, font] of lines) { ctx.font = font; tw = Math.max(tw, ctx.measureText(text).width); }
    const bw = tw + 20, bh = 56;
    let bx = state.mouse.x + 16, by = state.mouse.y + 16;
    if (bx + bw > state.w - 8) bx = state.mouse.x - bw - 12;
    if (by + bh > state.h - 8) by = state.mouse.y - bh - 12;
    ctx.fillStyle = 'rgba(7,12,26,0.9)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(110,170,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = hov.color; ctx.fillRect(bx, by, 3, bh);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let ly = by + 7;
    for (const [text, font, color] of lines) { ctx.font = font; ctx.fillStyle = color; ctx.fillText(text, bx + 11, ly); ly += 15; }
  }

  function drawLabels() {
    const must = new Set([state.current, state.selected, state.hovered, SOL].filter(Boolean));
    const showAll = cam.scale >= 34, showMajor = cam.scale >= 11;
    const list = stars.filter((s) => must.has(s) || showAll || (showMajor && s.major));
    list.sort((a, b) => (must.has(b) - must.has(a)) || (b.major - a.major) || (a.dist - b.dist));
    const placed = [];
    ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const s of list) {
      const { sx, sy } = s.p;
      if (sx < -120 || sx > state.w + 20 || sy < -20 || sy > state.h + 20) continue;
      const x = sx + s.r + 7, y = sy + 1, tw = ctx.measureText(s.name).width;
      const rect = { x: x - 2, y: y - 8, w: tw + 4, h: 16 };
      const m = must.has(s);
      if (!m && placed.some((r) => overlaps(r, rect))) continue;
      placed.push(rect);
      const reach = state.reachable.has(s.id);
      ctx.globalAlpha = reach || m ? 1 : 0.55;
      ctx.strokeStyle = 'rgba(3,5,13,0.9)'; ctx.lineWidth = 3; ctx.strokeText(s.name, x, y);
      ctx.fillStyle = s === state.current ? COLORS.amber : m ? '#ffffff' : reach ? COLORS.text : COLORS.dim;
      ctx.fillText(s.name, x, y);
    }
    ctx.globalAlpha = 1;
  }

  function drawMarkers(t) {
    const c = state.current, { sx, sy } = c.p;
    const r0 = c.r + 9;
    ctx.save();
    ctx.strokeStyle = COLORS.amber; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, r0, 0, Math.PI * 2); ctx.stroke();
    ctx.translate(sx, sy); ctx.rotate(t / 2500);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(r0 + 2, 0); ctx.lineTo(r0 + 8, 0); ctx.stroke();
    }
    ctx.restore();
    const s = state.selected;
    if (s && s !== c) {
      const pulse = 2 + Math.sin(t / 250) * 1.5;
      ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(s.p.sx, s.p.sy, s.r + 7 + pulse, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function updateReadout(step) {
    let line1 = 'cursor  —';
    if (state.mouse.over && !state.drag) {
      const p = unprojectPlane(cam, R, state.mouse.x, state.mouse.y, 0);
      line1 = `cursor  x ${fmt(p.x).padStart(6)}  y ${fmt(p.y).padStart(6)} ly  (galactic plane)`;
    }
    const line2 = `view    yaw ${deg(cam.yaw)}°  tilt ${deg(cam.pitch)}°  ${fmt(cam.scale)} px/ly  grid ${step} ly`;
    const text = `${line1}\n${line2}`;
    if (ui.readout.textContent !== text) ui.readout.textContent = text;
  }

  function draw(t) {
    const { w, h } = state;
    ctx.clearRect(0, 0, w, h);
    drawBackground();
    for (const s of stars) project(s.x, s.y, s.z, s.p);
    const step = gridStep();
    if (state.showGrid) drawGrid(step);
    if (state.showRings) drawRings();
    drawJumpRing();
    drawRoute(t);
    drawStars();
    drawMarkers(t);
    if (state.showLabels) drawLabels();
    drawHover();
    updateReadout(step);
  }

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    smoothCamera(dt);
    draw(t);
    requestAnimationFrame(frame);
  }

  /* ---- picking & input ------------------------------------------------- */
  function pick(mx, my) {
    let best = null, bd = Infinity;
    for (const s of stars) {
      const dx = s.p.sx - mx, dy = s.p.sy - my, d = dx * dx + dy * dy;
      const rad = Math.max(11, s.r + 7);
      if (d < rad * rad && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or already-released pointer */ }
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.pointers.size === 2) {
      const [a, b] = [...state.pointers.values()];
      state.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      state.drag = null;
      return;
    }
    const rotate = e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey;
    state.drag = { mode: rotate ? 'rotate' : 'pan', x: e.clientX, y: e.clientY, moved: 0, button: e.button };
    canvas.style.cursor = rotate ? 'move' : 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    state.mouse.x = e.clientX; state.mouse.y = e.clientY; state.mouse.over = true;
    if (state.pointers.has(e.pointerId)) state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.pinch && state.pointers.size === 2) {
      const [a, b] = [...state.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (state.pinch.d > 0) zoomAt(mx, my, d / state.pinch.d, true);
      panBy(mx - state.pinch.mx, my - state.pinch.my);
      state.pinch = { d, mx, my };
      return;
    }
    const d = state.drag;
    if (d) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (d.mode === 'pan') panBy(dx, dy); else rotateBy(dx, dy);
      d.x = e.clientX; d.y = e.clientY;
      return;
    }
    state.hovered = pick(e.clientX, e.clientY);
    canvas.style.cursor = state.hovered ? 'pointer' : 'crosshair';
  });

  function endPointer(e) {
    state.pointers.delete(e.pointerId);
    if (state.pointers.size < 2) state.pinch = null;
    const d = state.drag;
    state.drag = null;
    canvas.style.cursor = 'crosshair';
    if (d && d.moved < 5 && d.button === 0 && e.type === 'pointerup') select(pick(e.clientX, e.clientY));
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { state.mouse.over = false; if (!state.drag) state.hovered = null; });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    zoomAt(e.clientX, e.clientY, Math.exp(-dy * 0.0012));
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('dblclick', (e) => {
    const s = pick(e.clientX, e.clientY);
    if (s) { select(s); focusOn(s, 40); }
  });

  window.addEventListener('keydown', (e) => {
    if (e.target === ui.search) {
      if (e.key === 'Escape') { ui.search.value = ''; renderList(); ui.search.blur(); }
      if (e.key === 'Enter') {
        const first = ui.list.querySelector('li[data-id]');
        if (first) { const s = byId.get(first.dataset.id); select(s); focusOn(s, 30); }
      }
      return;
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    const step = 80;
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': panBy(step, 0, true); break;
      case 'ArrowRight': case 'd': case 'D': panBy(-step, 0, true); break;
      case 'ArrowUp': case 'w': case 'W': panBy(0, step, true); break;
      case 'ArrowDown': case 's': case 'S': panBy(0, -step, true); break;
      case 'q': case 'Q': camT.yaw -= 0.15; break;
      case 'e': case 'E': camT.yaw += 0.15; break;
      case '+': case '=': zoomAt(state.w / 2, state.h / 2, 1.25); break;
      case '-': case '_': zoomAt(state.w / 2, state.h / 2, 0.8); break;
      case 't': case 'T': toggleTopDown(); break;
      case 'r': case 'R': resetView(); break;
      case 'c': case 'C': focusOn(state.current); break;
      case 'f': case 'F': if (state.selected) focusOn(state.selected, 40); break;
      case 'j': case 'J': jump(); break;
      case '/': e.preventDefault(); ui.search.focus(); ui.search.select(); break;
      case '?': case 'h': case 'H': ui.help.classList.toggle('hidden'); break;
      case 'Escape':
        if (!ui.help.classList.contains('hidden')) ui.help.classList.add('hidden');
        else select(null);
        break;
      default: return;
    }
    e.preventDefault();
  });

  function toggleTopDown() { camT.pitch = camT.pitch > 0.05 ? 0 : DEFAULT_VIEW.pitch; }

  /* ---- UI wiring ------------------------------------------------------- */
  ui.range.addEventListener('input', () => {
    state.jumpRange = parseFloat(ui.range.value);
    ui.rangeOut.textContent = `${fmt(state.jumpRange)} ly`;
    computeReachable();
    if (state.selected) state.route = findRoute(state.current, state.selected, state.jumpRange);
    renderInfo(); renderList(); renderStatus();
  });
  ui.tgLabels.addEventListener('change', () => (state.showLabels = ui.tgLabels.checked));
  ui.tgStalks.addEventListener('change', () => (state.showStalks = ui.tgStalks.checked));
  ui.tgGrid.addEventListener('change', () => (state.showGrid = ui.tgGrid.checked));
  ui.tgRings.addEventListener('change', () => (state.showRings = ui.tgRings.checked));
  ui.btnTop.addEventListener('click', toggleTopDown);
  ui.btnReset.addEventListener('click', resetView);
  ui.btnHelp.addEventListener('click', () => ui.help.classList.toggle('hidden'));
  ui.btnHelpClose.addEventListener('click', () => ui.help.classList.add('hidden'));
  ui.closeInfo.addEventListener('click', () => select(null));
  ui.btnFocus.addEventListener('click', () => state.selected && focusOn(state.selected, 40));
  ui.btnJump.addEventListener('click', jump);
  ui.search.addEventListener('input', renderList);
  ui.list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const s = byId.get(li.dataset.id);
    select(s); focusOn(s, 30);
  });

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = window.innerWidth; state.h = window.innerHeight;
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    canvas.style.width = `${state.w}px`; canvas.style.height = `${state.h}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  /* ---- boot ------------------------------------------------------------ */
  makeBackground();
  resize();
  computeReachable();
  renderList();
  renderInfo();
  renderStatus();
  requestAnimationFrame(frame);
})();

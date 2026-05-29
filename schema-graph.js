/* ============================================================
   SchemaGraph — lightweight force-directed ERD graph (SVG)
   Pan / zoom / drag / select. No dependencies.
   ============================================================ */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  var _measure = document.createElement('canvas').getContext('2d');
  _measure.font = '600 13px "IBM Plex Mono", monospace';
  function textW(s) { return _measure.measureText(s).width; }

  function SchemaGraph(svg, model, opts) {
    this.svg = svg;
    this.opts = opts || {};
    this.onSelect = this.opts.onSelect || function () {};
    this.t = { x: 0, y: 0, k: 1 };
    this.selected = null;
    this._build(model);
    this._render();
    this._wire();
  }

  SchemaGraph.prototype._build = function (model) {
    var self = this;
    this.nodes = model.tables.map(function (t) {
      var w = Math.max(120, textW(t.name) + 40);
      return { id: t.id, name: t.name, cols: t.cols.length, w: w, h: 38, x: 0, y: 0, dx: 0, dy: 0, deg: 0 };
    });
    this.nodeById = {};
    this.nodes.forEach(function (n) { self.nodeById[n.id] = n; });
    this.edges = [];
    this.adj = {};
    model.relations.forEach(function (r) {
      var s = self.nodeById[r.parent], t = self.nodeById[r.child];
      if (!s || !t) return;
      s.deg++; t.deg++;
      var e = { s: s, t: t, rel: r };
      self.edges.push(e);
      (self.adj[s.id] = self.adj[s.id] || []).push({ node: t, edge: e });
      (self.adj[t.id] = self.adj[t.id] || []).push({ node: s, edge: e });
    });
    this._layout();
  };

  SchemaGraph.prototype._layout = function () {
    var nodes = this.nodes, edges = this.edges;
    var W = 1600, H = 1100;
    var k = Math.sqrt((W * H) / nodes.length) * 0.82;
    nodes.forEach(function (n, i) {
      var a = (i / nodes.length) * Math.PI * 2;
      n.x = W / 2 + Math.cos(a) * 300 + (Math.random() - 0.5) * 120;
      n.y = H / 2 + Math.sin(a) * 300 + (Math.random() - 0.5) * 120;
    });
    var self = this;
    var temp = W * 0.09;
    for (var it = 0; it < 450; it++) {
      for (var a = 0; a < nodes.length; a++) { nodes[a].dx = 0; nodes[a].dy = 0; }
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var ni = nodes[i], nj = nodes[j];
          var dx = ni.x - nj.x, dy = ni.y - nj.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var f = (k * k) / dist;
          var ux = dx / dist, uy = dy / dist;
          ni.dx += ux * f; ni.dy += uy * f;
          nj.dx -= ux * f; nj.dy -= uy * f;
        }
      }
      for (var e = 0; e < edges.length; e++) {
        var s = edges[e].s, tt = edges[e].t;
        var dx2 = s.x - tt.x, dy2 = s.y - tt.y;
        var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 0.01;
        var f2 = (d2 * d2) / k;
        var ux2 = dx2 / d2, uy2 = dy2 / d2;
        s.dx -= ux2 * f2; s.dy -= uy2 * f2;
        tt.dx += ux2 * f2; tt.dy += uy2 * f2;
      }
      for (var g = 0; g < nodes.length; g++) {
        var n = nodes[g];
        var grav = self.adj[n.id] ? 0.022 : 0.06; // pull standalone files inward harder
        n.dx += (W / 2 - n.x) * grav;
        n.dy += (H / 2 - n.y) * grav;
        var dd = Math.sqrt(n.dx * n.dx + n.dy * n.dy) || 0.01;
        var lim = Math.min(dd, temp);
        n.x += (n.dx / dd) * lim;
        n.y += (n.dy / dd) * lim;
      }
      temp *= 0.985;
    }
    // bounds
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x - n.w / 2); maxX = Math.max(maxX, n.x + n.w / 2);
      minY = Math.min(minY, n.y - n.h / 2); maxY = Math.max(maxY, n.y + n.h / 2);
    });
    this.bounds = { minX: minX, minY: minY, w: maxX - minX, h: maxY - minY };
  };

  SchemaGraph.prototype._render = function () {
    var self = this;
    this.svg.innerHTML = '';
    var defs = el('defs');
    defs.innerHTML = '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#B7C0CC"/></marker>';
    this.svg.appendChild(defs);
    this.vp = el('g');
    this.svg.appendChild(this.vp);

    this.edgeLayer = el('g'); this.vp.appendChild(this.edgeLayer);
    this.nodeLayer = el('g'); this.vp.appendChild(this.nodeLayer);

    this.edgeEls = this.edges.map(function (e) {
      var p = el('path', { 'class': 'sg-edge', 'marker-end': 'url(#ah)', fill: 'none' });
      self.edgeLayer.appendChild(p);
      e.el = p;
      return p;
    });

    this.nodes.forEach(function (n) {
      var g = el('g', { 'class': 'sg-node', 'data-id': n.id });
      g.style.cursor = 'pointer';
      var hue = n.deg >= 6 ? 'hub' : (n.deg === 0 ? 'iso' : '');
      var rect = el('rect', { x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: 8, 'class': 'sg-rect ' + hue });
      var accent = el('rect', { x: -n.w / 2, y: -n.h / 2, width: 4, height: n.h, rx: 2, 'class': 'sg-accent ' + hue });
      var label = el('text', { x: -n.w / 2 + 16, y: 1, 'class': 'sg-label', 'dominant-baseline': 'middle' });
      label.textContent = n.name;
      g.appendChild(rect); g.appendChild(accent); g.appendChild(label);
      n.el = g; n.rectEl = rect;
      self.nodeLayer.appendChild(g);
    });
    this._positions();
    this.fit();
  };

  SchemaGraph.prototype._positions = function () {
    this.nodes.forEach(function (n) { n.el.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')'); });
    this.edges.forEach(function (e) {
      var x1 = e.s.x, y1 = e.s.y, x2 = e.t.x, y2 = e.t.y;
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      var dx = x2 - x1, dy = y2 - y1;
      var off = Math.sqrt(dx * dx + dy * dy) * 0.12;
      var nx = -dy, ny = dx, nl = Math.sqrt(nx * nx + ny * ny) || 1;
      var cx = mx + (nx / nl) * off, cy = my + (ny / nl) * off;
      e.el.setAttribute('d', 'M' + x1 + ' ' + y1 + ' Q' + cx + ' ' + cy + ' ' + x2 + ' ' + y2);
    });
  };

  SchemaGraph.prototype._apply = function () {
    this.vp.setAttribute('transform', 'translate(' + this.t.x + ',' + this.t.y + ') scale(' + this.t.k + ')');
  };

  SchemaGraph.prototype.fit = function (pad) {
    pad = pad == null ? 80 : pad;
    var r = this.svg.getBoundingClientRect();
    var b = this.bounds;
    var k = Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h);
    k = Math.max(0.2, Math.min(k, 2.0));
    this.t.k = k;
    this.t.x = (r.width - b.w * k) / 2 - b.minX * k;
    this.t.y = (r.height - b.h * k) / 2 - b.minY * k;
    this._apply();
  };

  SchemaGraph.prototype.zoom = function (factor) {
    var r = this.svg.getBoundingClientRect();
    this._zoomAt(r.width / 2, r.height / 2, factor);
  };

  SchemaGraph.prototype._zoomAt = function (px, py, factor) {
    var k2 = Math.max(0.2, Math.min(3, this.t.k * factor));
    var f = k2 / this.t.k;
    this.t.x = px - (px - this.t.x) * f;
    this.t.y = py - (py - this.t.y) * f;
    this.t.k = k2;
    this._apply();
  };

  SchemaGraph.prototype.select = function (id, center) {
    this.selected = id;
    var neigh = {};
    if (id && this.adj[id]) this.adj[id].forEach(function (a) { neigh[a.node.id] = 1; });
    this.nodes.forEach(function (n) {
      n.el.classList.toggle('sel', n.id === id);
      n.el.classList.toggle('neigh', !!neigh[n.id]);
      n.el.classList.toggle('dim', !!id && n.id !== id && !neigh[n.id]);
    });
    this.edges.forEach(function (e) {
      var on = id && (e.s.id === id || e.t.id === id);
      e.el.classList.toggle('on', !!on);
      e.el.classList.toggle('dim', !!id && !on);
    });
    if (center && id) this.centerOn(id);
  };

  SchemaGraph.prototype.centerOn = function (id) {
    var n = this.nodeById[id]; if (!n) return;
    var r = this.svg.getBoundingClientRect();
    var k = Math.max(this.t.k, 0.9);
    this.t.k = k;
    this.t.x = r.width / 2 - n.x * k;
    this.t.y = r.height / 2 - n.y * k;
    this._apply();
  };

  SchemaGraph.prototype._wire = function () {
    var self = this, svg = this.svg;
    var dragNode = null, panning = false, last = null, moved = false;

    svg.addEventListener('mousedown', function (ev) {
      var g = ev.target.closest ? ev.target.closest('.sg-node') : null;
      moved = false;
      last = { x: ev.clientX, y: ev.clientY };
      if (g) { dragNode = self.nodeById[g.getAttribute('data-id')]; }
      else { panning = true; svg.classList.add('grabbing'); }
    });
    window.addEventListener('mousemove', function (ev) {
      if (!last) return;
      var ddx = ev.clientX - last.x, ddy = ev.clientY - last.y;
      if (Math.abs(ddx) + Math.abs(ddy) > 3) moved = true;
      if (dragNode) {
        dragNode.x += ddx / self.t.k; dragNode.y += ddy / self.t.k;
        self._positions();
      } else if (panning) {
        self.t.x += ddx; self.t.y += ddy; self._apply();
      }
      last = { x: ev.clientX, y: ev.clientY };
    });
    window.addEventListener('mouseup', function (ev) {
      if (dragNode && !moved) self.onSelect(dragNode.id);
      else if (panning && !moved && ev.target === svg) self.onSelect(null);
      dragNode = null; panning = false; last = null; svg.classList.remove('grabbing');
    });
    svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var r = svg.getBoundingClientRect();
      self._zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.12 : 0.89);
    }, { passive: false });

    // hover -> highlight (only when nothing selected)
    this.nodes.forEach(function (n) {
      n.el.addEventListener('mouseenter', function () {
        if (self.selected) return;
        n.el.classList.add('hover');
        if (self.adj[n.id]) self.adj[n.id].forEach(function (a) { a.edge.el.classList.add('on'); a.node.el.classList.add('neigh'); });
      });
      n.el.addEventListener('mouseleave', function () {
        if (self.selected) return;
        n.el.classList.remove('hover');
        if (self.adj[n.id]) self.adj[n.id].forEach(function (a) { a.edge.el.classList.remove('on'); a.node.el.classList.remove('neigh'); });
      });
    });
  };

  window.SchemaGraph = SchemaGraph;
})();

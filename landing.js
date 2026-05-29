/* ============================================================
   Landing page interactions
   - Hero node-graph + RF pulse canvas animation
   - Count-up stats
   - Searchable JSON file list (from window.SCHEMA)
   ============================================================ */
(function () {
  'use strict';
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------------- HERO CANVAS ---------------- */
  (function heroGraph() {
    var canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var nodes = [], pulses = [];
    var BLUE = '#0B6FE8', SKY = '#29A7F0';

    function resize() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }

    function build() {
      nodes = [];
      var N = Math.max(14, Math.min(22, Math.round(W * H / 14000)));
      for (var i = 0; i < N; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
          r: Math.random() < 0.22 ? 4.5 : 2.4,
          hub: Math.random() < 0.22
        });
      }
    }

    function step() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < 8 || n.x > W - 8) n.vx *= -1;
        if (n.y < 8 || n.y > H - 8) n.vy *= -1;
        n.x = Math.max(8, Math.min(W - 8, n.x));
        n.y = Math.max(8, Math.min(H - 8, n.y));
      }
      var maxD = Math.min(W, H) * 0.34;
      for (i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxD) {
            var a = (1 - d / maxD) * 0.55;
            ctx.strokeStyle = 'rgba(11,111,232,' + a.toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      for (i = pulses.length - 1; i >= 0; i--) {
        var p = pulses[i];
        p.rad += 0.9; p.life -= 0.012;
        if (p.life <= 0) { pulses.splice(i, 1); continue; }
        ctx.strokeStyle = 'rgba(41,167,240,' + (p.life * 0.5).toFixed(3) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (i = 0; i < nodes.length; i++) {
        var nn = nodes[i];
        if (nn.hub) {
          ctx.fillStyle = 'rgba(11,111,232,0.12)';
          ctx.beginPath(); ctx.arc(nn.x, nn.y, nn.r + 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = nn.hub ? BLUE : SKY;
        ctx.beginPath(); ctx.arc(nn.x, nn.y, nn.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
      }
      requestAnimationFrame(step);
    }

    function emit() {
      var hubs = nodes.filter(function (n) { return n.hub; });
      if (hubs.length) {
        var s = hubs[Math.floor(Math.random() * hubs.length)];
        pulses.push({ x: s.x, y: s.y, rad: s.r, life: 1 });
      }
      setTimeout(emit, 1100 + Math.random() * 1200);
    }

    window.addEventListener('resize', resize);
    resize(); step(); setTimeout(emit, 600);
  })();

  /* ---------------- COUNT-UP STATS ---------------- */
  (function counts() {
    var els = document.querySelectorAll('.stat-n[data-count]');
    var done = false;
    function run() {
      if (done) return; done = true;
      els.forEach(function (el) {
        var target = +el.getAttribute('data-count'), t0 = null;
        function frame(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / 900, 1);
          var e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * e);
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    }
    var hero = document.querySelector('.hero-stats');
    if ('IntersectionObserver' in window && hero) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) run(); });
      }, { threshold: 0.4 }).observe(hero);
    } else { run(); }
  })();

  /* ---------------- FILE SEARCH / LIST ---------------- */
  (function fileList() {
    var schema = window.SCHEMA;
    if (!schema) return;
    var listEl = document.getElementById('file-list');
    var input = document.getElementById('file-search');
    var countEl = document.getElementById('search-count');
    var tables = schema.tables.slice();

    function esc(s) { return s.replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
    function hl(text, q) {
      if (!q) return esc(text);
      var i = text.toLowerCase().indexOf(q);
      if (i < 0) return esc(text);
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
    }
    var fileIcon = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3.5 1.5h6L13 5v9.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5Z" stroke="#0B6FE8" stroke-width="1.2"/><path d="M9.2 1.6V5h3.6" stroke="#0B6FE8" stroke-width="1.2"/></svg>';
    var arrow = '<svg class="fc-arrow" width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M5 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function render(q) {
      q = (q || '').trim().toLowerCase();
      var rows = [];
      tables.forEach(function (t) {
        var nameMatch = t.name.toLowerCase().indexOf(q) >= 0;
        var fieldHits = q ? t.cols.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }) : [];
        if (!q || nameMatch || fieldHits.length) {
          rows.push({ t: t, fieldHits: fieldHits });
        }
      });
      listEl.innerHTML = '';
      if (!rows.length) {
        listEl.innerHTML = '<div class="file-empty">No files or fields match "' + esc(q) + '".</div>';
        countEl.textContent = '0 / ' + tables.length;
        return;
      }
      countEl.textContent = rows.length + ' / ' + tables.length;
      rows.forEach(function (row) {
        var t = row.t;
        var a = document.createElement('a');
        a.className = 'file-card';
        a.href = 'schema.html#' + encodeURIComponent(t.name);
        var hits = '';
        if (q && row.fieldHits.length) {
          var names = row.fieldHits.slice(0, 3).map(function (c) { return hl(c.name, q); }).join(', ');
          var extra = row.fieldHits.length > 3 ? ' +' + (row.fieldHits.length - 3) : '';
          hits = '<div class="fc-hits">↳ ' + names + extra + '</div>';
        }
        a.innerHTML =
          '<span class="fc-ic">' + fileIcon + '</span>' +
          '<span class="fc-body">' +
            '<span class="fc-name">' + hl(t.name, q) + '</span>' +
            '<span class="fc-meta"><b>' + t.cols.length + '</b> fields</span>' +
            hits +
          '</span>' + arrow;
        listEl.appendChild(a);
      });
    }

    var tmr;
    input.addEventListener('input', function () {
      clearTimeout(tmr);
      var v = input.value;
      tmr = setTimeout(function () { render(v); }, 60);
    });
    render('');
  })();
})();

/* ============================================================
   Schema viewer app — sidebar, search, detail, deep-linking
   ============================================================ */
(function () {
  'use strict';
  var model = window.SCHEMA;
  var tableById = {};
  model.tables.forEach(function (t) { tableById[t.id] = t; });
  var nameToId = {};
  model.tables.forEach(function (t) { nameToId[t.name] = t.id; });

  // relations grouped per table id
  var relByTable = {};
  model.tables.forEach(function (t) { relByTable[t.id] = []; });
  model.relations.forEach(function (r) {
    if (relByTable[r.parent]) relByTable[r.parent].push({ rel: r, role: 'parent', other: r.child });
    if (relByTable[r.child]) relByTable[r.child].push({ rel: r, role: 'child', other: r.parent });
  });
  // degree
  var deg = {};
  model.tables.forEach(function (t) { deg[t.id] = relByTable[t.id].length; });

  var listEl = document.getElementById('vside-list');
  var emptyEl = document.getElementById('vdetail-empty');
  var bodyEl = document.getElementById('vdetail-body');
  var sideCount = document.getElementById('side-count');
  var hint = document.getElementById('vhint');

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function hl(text, q) {
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q);
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  /* ---------- GRAPH ---------- */
  var graph = new window.SchemaGraph(document.getElementById('graph'), model, {
    onSelect: function (id) { selectTable(id, false); }
  });

  /* ---------- SIDEBAR LIST ---------- */
  function renderList(q) {
    q = (q || '').trim().toLowerCase();
    listEl.innerHTML = '';
    var shown = 0;
    model.tables.forEach(function (t) {
      var nameMatch = t.name.toLowerCase().indexOf(q) >= 0;
      var fieldHits = q ? t.cols.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }) : [];
      if (q && !nameMatch && !fieldHits.length) return;
      shown++;
      var d = deg[t.id];
      var cls = d >= 6 ? 'hub' : (d === 0 ? 'iso' : '');
      var row = document.createElement('div');
      row.className = 'vfile' + (t.id === graph.selected ? ' active' : '');
      row.setAttribute('data-id', t.id);
      var sub = (q && fieldHits.length && !nameMatch)
        ? '<span class="ct">' + fieldHits.length + ' fld</span>'
        : '<span class="ct">' + t.cols.length + '</span>';
      row.innerHTML = '<span class="dot ' + cls + '"></span><span class="nm">' + hl(t.name, q) + '</span>' + sub;
      row.addEventListener('click', function () { selectTable(t.id, true); });
      listEl.appendChild(row);
    });
    sideCount.textContent = shown;
    if (!shown) listEl.innerHTML = '<div class="vside-empty">No files or fields match “' + esc(q) + '”.</div>';
  }

  function syncListActive() {
    [].forEach.call(listEl.querySelectorAll('.vfile'), function (r) {
      r.classList.toggle('active', r.getAttribute('data-id') === graph.selected);
    });
  }

  /* ---------- DETAIL PANEL ---------- */
  function badges(c) {
    var b = '';
    if (c.pk) b += '<span class="badge badge-pk">PK</span> ';
    if (c.fk) b += '<span class="badge badge-fk">FK</span> ';
    if (c.list) b += '<span class="badge badge-list">List</span> ';
    return b;
  }

  function renderDetail(t) {
    var rels = relByTable[t.id];
    var pkCount = t.cols.filter(function (c) { return c.pk; }).length;
    var fkCount = t.cols.filter(function (c) { return c.fk; }).length;

    var colsHtml = t.cols.map(function (c) {
      return '<div class="vcol"><span class="cn">' + esc(c.name) + '</span>' +
        badges(c) + '<span class="ct">' + esc(c.type.replace(' [LIST]', '')) + '</span></div>';
    }).join('');

    var relHtml;
    if (!rels.length) {
      relHtml = '<div class="vd-none">No relationships — this file stands on its own.</div>';
    } else {
      relHtml = rels.map(function (rr) {
        var otherT = tableById[rr.other];
        var out = rr.role === 'child'; // current references other
        var via = (rr.rel.cols || []).map(function (cc) {
          var mine = out ? cc.c : cc.p;
          var theirs = out ? cc.p : cc.c;
          return '<code>' + esc(mine) + '</code> → <code>' + esc(theirs) + '</code>';
        }).join(', ');
        return '<div class="vrel" data-id="' + rr.other + '">' +
          '<div class="vr-top"><span class="vr-dir ' + (out ? 'out' : '') + '">' + (out ? 'references' : 'referenced by') + '</span>' +
          '<span class="vr-name">' + esc(otherT ? otherT.name : '?') + '</span></div>' +
          (via ? '<div class="vr-via">' + via + '</div>' : '') +
          '</div>';
      }).join('');
    }

    bodyEl.innerHTML =
      '<div class="vd-head">' +
        '<div class="vd-kind">JSON file</div>' +
        '<div class="vd-name">' + esc(t.name) + '</div>' +
        '<div class="vd-stats">' +
          '<span><b>' + t.cols.length + '</b> fields</span>' +
          '<span><b>' + rels.length + '</b> links</span>' +
          (pkCount ? '<span><b>' + pkCount + '</b> PK</span>' : '') +
          (fkCount ? '<span><b>' + fkCount + '</b> FK</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="vd-sec"><h4>Fields</h4>' + colsHtml + '</div>' +
      '<div class="vd-sec"><h4>Relationships (' + rels.length + ')</h4>' + relHtml + '</div>';

    [].forEach.call(bodyEl.querySelectorAll('.vrel'), function (r) {
      r.addEventListener('click', function () { selectTable(r.getAttribute('data-id'), true); });
    });
    emptyEl.style.display = 'none';
    bodyEl.style.display = 'block';
    bodyEl.parentElement.scrollTop = 0;
  }

  /* ---------- SELECT ---------- */
  function selectTable(id, center) {
    if (!id || !tableById[id]) {
      graph.select(null);
      emptyEl.style.display = 'block';
      bodyEl.style.display = 'none';
      syncListActive();
      history.replaceState(null, '', location.pathname);
      return;
    }
    graph.select(id, center);
    renderDetail(tableById[id]);
    syncListActive();
    if (hint) hint.style.opacity = '0';
    var open = document.getElementById('vdetail');
    if (window.innerWidth <= 720) open.classList.add('open');
    history.replaceState(null, '', '#' + encodeURIComponent(tableById[id].name));
  }

  /* ---------- SEARCH ---------- */
  var search = document.getElementById('v-search');
  var tmr;
  search.addEventListener('input', function () {
    clearTimeout(tmr);
    var v = search.value;
    tmr = setTimeout(function () {
      renderList(v);
      // if exactly one file-name match, focus it on graph
    }, 60);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === '/' && document.activeElement !== search) { ev.preventDefault(); search.focus(); }
    if (ev.key === 'Escape') { search.blur(); selectTable(null); }
  });

  /* ---------- TOOLS ---------- */
  document.getElementById('zoom-in').addEventListener('click', function () { graph.zoom(1.25); });
  document.getElementById('zoom-out').addEventListener('click', function () { graph.zoom(0.8); });
  document.getElementById('zoom-fit').addEventListener('click', function () { graph.fit(); graph.select(graph.selected); });
  var sideToggle = document.getElementById('toggle-side');
  if (sideToggle) sideToggle.addEventListener('click', function () { document.getElementById('vside').classList.toggle('open'); });

  window.addEventListener('resize', function () { graph.fit(); if (graph.selected) graph.centerOn(graph.selected); });

  /* ---------- INIT + HASH ---------- */
  renderList('');
  function fromHash() {
    var h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (h && nameToId[h]) selectTable(nameToId[h], true);
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);
})();

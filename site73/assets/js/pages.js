/* ==========================================================================
   SITE-73 · MODULES DES PAGES
   Chaque module ne s'active que si sa page est présente dans le document.
   ========================================================================== */
(function () {
  "use strict";

  var S = window.S73, D = S.data, doc = document;
  var U = S.util, esc = U.esc, norm = U.norm, pad = U.pad;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CLASS_ORDER = ["sur", "euclide", "keter", "thaumiel", "attente", "neutralise"];
  var DANGER_VAR = ["", "var(--d1)", "var(--d2)", "var(--d3)", "var(--d4)"];
  var LEVEL_COLORS = ["#A9B3B5", "#7FC8A9", "#F2C230", "#F59331", "#EF4747", "#A08CFF"];

  var classChip = function (key) {
    return '<span class="chip" style="--c: var(--c-' + key + ')">' + esc(D.classesObjet[key].nom) + "</span>";
  };
  var meter = function (n, max) {
    var h = '<span class="meter" role="img" aria-label="Menace ' + n + " sur " + (max || 5) + '" style="--m:' + DANGER_VAR[Math.min(4, Math.max(1, n - 1 || 1))] + '">';
    for (var i = 1; i <= (max || 5); i++) h += '<i class="' + (i <= n ? "on" : "") + '"></i>';
    return h + "</span>";
  };
  var scpNum = function (s) { return /^\d+$/.test(s.id) ? s.id : s.id.replace(/^ANO-/, ""); };
  var statusClass = function (s) {
    if (/neutralis/i.test(s.statut)) return "is-off";
    if (/surveill/i.test(s.statut)) return "is-warn";
    return "";
  };
  var accentRegex = function (q) {
    var map = { a: "aàâä", e: "eéèêë", i: "iîï", o: "oôö", u: "uùûü", c: "cç", y: "yÿ" };
    var src = norm(q).split("").map(function (ch) {
      return map[ch] ? "[" + map[ch] + "]" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
    return new RegExp(src, "gi");
  };

  /* ======================================================================
     ACCUEIL
     ====================================================================== */
  function accueil() {
    var home = $("#home");
    if (!home) return;

    // Bandeau défilant
    var track = $("#home-ticker");
    if (track) {
      var items = D.bandeau.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
      track.innerHTML = items + items.replace(/<span>/g, '<span aria-hidden="true">');
    }

    // Niveau d'alerte
    var seg = $("#home-alert-seg");
    var reset = $("#home-alert-reset");
    if (seg) {
      seg.innerHTML = S.alerts.map(function (a) {
        return '<button type="button" role="radio" data-alert="' + a + '" style="--c: var(--a-' + a + ')">' + esc(D.alertes[a].code.replace("Code ", "")) + "</button>";
      }).join("");
      var syncSeg = function () {
        var cur = S.getAlert();
        $$("button", seg).forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-alert") === cur)); });
        if (reset) reset.hidden = cur === S.officialAlert();
      };
      seg.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-alert]");
        if (!b) return;
        S.setAlert(b.getAttribute("data-alert"));
      });
      if (reset) reset.addEventListener("click", function () { S.setAlert(S.officialAlert()); });
      doc.addEventListener("s73:alert", syncSeg);
      syncSeg();
    }

    // Depuis le dernier incident
    var since = $("[data-since]");
    if (since) {
      var start = new Date(D.config.dernierIncident.date).getTime();
      var upd = function () {
        var s = Math.max(0, Math.floor((Date.now() - start) / 1000));
        var d = Math.floor(s / 86400); s -= d * 86400;
        var h = Math.floor(s / 3600); s -= h * 3600;
        var m = Math.floor(s / 60); s -= m * 60;
        since.textContent = d + " j " + pad(h) + ":" + pad(m) + ":" + pad(s);
      };
      upd();
      doc.addEventListener("s73:tick", upd);
      $$("[data-since-ref]").forEach(function (el) { el.textContent = D.config.dernierIncident.ref; });
    }

    // Répartition par classe
    var stack = $("#home-stack"), legend = $("#home-legend");
    if (stack) {
      var counts = {};
      D.scp.forEach(function (s) { counts[s.classe] = (counts[s.classe] || 0) + 1; });
      var keys = CLASS_ORDER.filter(function (k) { return counts[k]; });
      stack.innerHTML = keys.map(function (k) {
        return '<i style="--c: var(--c-' + k + '); flex:' + counts[k] + '" title="' + esc(D.classesObjet[k].nom) + " : " + counts[k] + '"></i>';
      }).join("");
      legend.innerHTML = keys.map(function (k) {
        return '<li style="--c: var(--c-' + k + ')">' + esc(D.classesObjet[k].nom) + " " + counts[k] + "</li>";
      }).join("");
    }

    // Dossier du jour
    var daily = $("#home-daily");
    if (daily) {
      var today = new Date().toISOString().slice(0, 10);
      var pool = D.scp.filter(function (s) { return s.classe !== "neutralise"; });
      var pick = pool[U.hash(today) % pool.length];
      daily.style.setProperty("--c", "var(--c-" + pick.classe + ")");
      daily.innerHTML =
        '<div><p class="label">Dossier du jour · ' + esc(U.fmtDate(today)) + "</p></div>" +
        '<div><p class="daily__num"><small>' + esc(pick.code) + "</small>" + esc(scpNum(pick)) + "</p>" +
        '<p class="daily__name">' + esc(pick.nom) + "</p></div>" +
        "<p>" + esc(pick.resume) + "</p>" +
        '<div class="daily__meta">' + classChip(pick.classe) + '<span class="chip chip--plain">Habilitation ' + pick.niveau + "</span>" +
          '<span class="chip chip--plain">' + esc(S.zoneById[pick.zone] ? S.zoneById[pick.zone].niveau : "") + "</span></div>" +
        '<div><button type="button" class="btn btn--signal" data-open="' + esc(pick.id) + '">Ouvrir le dossier ' + S.icon.arrow + "</button></div>";
      daily.addEventListener("click", function (e) {
        var b = e.target.closest("[data-open]");
        if (b) S.openDossier(b.getAttribute("data-open"));
      });
    }

    // Communiqués
    var comms = $("#home-comms");
    if (comms) {
      var list = D.archives.filter(function (a) { return a.type === "communique"; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 3);
      comms.innerHTML = list.map(function (c) {
        return '<li class="comm"><time datetime="' + c.date + '">' + esc(U.fmtDate(c.date)) + "</time><div><h3>" + esc(c.titre) + "</h3><p data-comm></p></div></li>";
      }).join("");
      $$("[data-comm]", comms).forEach(function (p, i) { S.redactInto(p, list[i].texte); });
    }
  }

  /* ======================================================================
     DOSSIERS
     ====================================================================== */
  function confinement() {
    var grid = $("#db-grid");
    if (!grid) return;
    var state = { q: "", classe: "all", sort: "num" };
    var filters = $("#db-filters"), count = $("#db-count"), search = $("#db-search"), sort = $("#db-sort");

    var counts = { all: D.scp.length };
    D.scp.forEach(function (s) { counts[s.classe] = (counts[s.classe] || 0) + 1; });
    var keys = ["all"].concat(CLASS_ORDER.filter(function (k) { return counts[k]; }));
    filters.innerHTML = keys.map(function (k) {
      var lbl = k === "all" ? "Toutes" : D.classesObjet[k].nom;
      var c = k === "all" ? "var(--text-2)" : "var(--c-" + k + ")";
      return '<button type="button" aria-pressed="' + (k === "all") + '" data-k="' + k + '" style="--c:' + c + '">' + esc(lbl) + " <b>" + counts[k] + "</b></button>";
    }).join("");
    filters.classList.add("seg");

    var numOf = function (s) { return /^\d+$/.test(s.id) ? parseInt(s.id, 10) : 100000 + U.hash(s.id) % 1000; };
    var visible = [];
    var render = function () {
      var q = norm(state.q.trim());
      visible = D.scp.filter(function (s) {
        if (state.classe !== "all" && s.classe !== state.classe) return false;
        if (!q) return true;
        var hay = norm([s.code, s.id, s.nom, s.resume, D.classesObjet[s.classe].nom, s.statut].join(" "));
        return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
      });
      visible.sort(function (a, b) {
        if (state.sort === "menace") return b.menace - a.menace || numOf(a) - numOf(b);
        if (state.sort === "classe") return CLASS_ORDER.indexOf(a.classe) - CLASS_ORDER.indexOf(b.classe) || numOf(a) - numOf(b);
        if (state.sort === "habilitation") return a.niveau - b.niveau || numOf(a) - numOf(b);
        return numOf(a) - numOf(b);
      });
      count.textContent = visible.length + " dossier" + (visible.length > 1 ? "s" : "") + " sur " + D.scp.length +
        (state.q ? " · recherche « " + state.q.trim() + " »" : "");
      if (!visible.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><b>Aucun dossier</b>Aucun résultat pour « ' + esc(state.q.trim()) +
          " ». Essaie un numéro (173) ou un nom (Docteur).</div>";
        return;
      }
      grid.innerHTML = visible.map(function (s) {
        var z = S.zoneById[s.zone];
        return '<button type="button" class="cell" data-id="' + esc(s.id) + '" style="--c: var(--c-' + s.classe + ')" aria-label="Ouvrir le dossier ' + esc(s.code + ", " + s.nom) + '">' +
          '<span class="cell__top"><span>' + esc(s.code) + '</span><span class="cell__status ' + statusClass(s) + '"><i></i>' + esc(s.statut) + "</span></span>" +
          '<span class="cell__num">' + esc(scpNum(s)) + "</span>" +
          '<span class="cell__name">' + esc(s.nom) + "</span>" +
          '<span class="cell__resume">' + esc(s.resume) + "</span>" +
          '<span class="cell__foot">' + classChip(s.classe) + '<span class="cell__zone">' + esc(z ? z.niveau : "") + "</span>" + meter(s.menace) + "</span>" +
          "</button>";
      }).join("");
    };

    filters.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]");
      if (!b) return;
      state.classe = b.getAttribute("data-k");
      $$("button", filters).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      render();
    });
    search.addEventListener("input", function () { state.q = search.value; render(); });
    sort.addEventListener("change", function () { state.sort = sort.value; render(); });
    grid.addEventListener("click", function (e) {
      var c = e.target.closest(".cell");
      if (c) S.openDossier(c.getAttribute("data-id"), visible.map(function (s) { return s.id; }));
    });
    grid.addEventListener("pointermove", function (e) {
      var c = e.target.closest(".cell");
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      c.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
    render();

    var legend = $("#db-classes");
    if (legend) {
      legend.innerHTML = CLASS_ORDER.map(function (k) {
        var c = D.classesObjet[k];
        return '<div style="--c: var(--c-' + k + ')"><h3>' + esc(c.nom) + "</h3><p>" + esc(c.texte) + "</p></div>";
      }).join("");
    }
  }

  /* ======================================================================
     PLAN
     ====================================================================== */
  function plan() {
    var svg = $("#map-svg");
    if (!svg) return;
    var panel = $("#map-panel");
    var selected = "zch";
    var scpsIn = function (zid) { return D.scp.filter(function (s) { return s.zone === zid; }); };
    var short = function (z) { return z.nom.split(" · ")[0]; };

    // --- Construction de la coupe
    var g = [];
    g.push('<defs><pattern id="m-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="9" height="9" fill="#0E161A"/><line x1="0" y1="0" x2="0" y2="9" stroke="#152127" stroke-width="2.4"/></pattern>' +
      '<linearGradient id="m-skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A1215"/><stop offset="1" stop-color="#132027"/></linearGradient></defs>');
    g.push('<rect class="m-sky" x="0" y="0" width="1000" height="170" fill="url(#m-skyg)"/>');
    g.push('<rect class="m-rock" x="0" y="170" width="1000" height="590"/>');
    // strates
    g.push('<g fill="none" stroke="#1B2A31" stroke-width="1.2">' +
      '<path d="M0 262 C180 250 320 276 520 262 S820 248 1000 266"/>' +
      '<path d="M0 408 C200 420 360 396 560 410 S840 426 1000 404"/>' +
      '<path d="M0 578 C160 566 380 590 600 576 S860 562 1000 584"/>' +
      '<path d="M0 668 C220 680 420 656 640 670 S880 684 1000 662"/></g>');
    // montagne
    g.push('<path class="m-mountain" d="M230 170 L330 118 L372 128 L452 58 L500 80 L566 22 L628 76 L672 62 L760 124 L812 112 L900 170 Z"/>');
    g.push('<path class="m-snow" d="M452 58 L474 70 L462 74 L500 80 L489 84 Z M566 22 L592 46 L578 44 L585 58 L566 42 L552 52 L556 36 Z M672 62 L690 76 L676 76 Z"/>');
    g.push('<line class="m-ground" x1="0" y1="170" x2="1000" y2="170"/>');
    // téléphérique fantôme (ANO-73-014)
    g.push('<g aria-hidden="true"><line x1="955" y1="170" x2="955" y2="118" stroke="#56696C" stroke-width="2"/>' +
      '<path class="m-cable" d="M955 120 Q880 70 800 26"/>' +
      '<g transform="translate(868 66) rotate(-30)"><line x1="0" y1="0" x2="0" y2="10" stroke="#56696C"/><rect x="-9" y="10" width="18" height="13" fill="#1A252B" stroke="#56696C"/></g>' +
      '<text class="m-note" x="792" y="18" text-anchor="end">STATION 4 ?</text></g>');
    // niveaux
    D.niveaux.forEach(function (n, i) {
      if (i > 0) g.push('<line class="m-level" x1="40" y1="' + (n.y + 24) + '" x2="860" y2="' + (n.y + 24) + '"/>');
      g.push('<text class="m-level-label" x="990" y="' + (n.y - 2) + '" text-anchor="end">' + esc(n.label.toUpperCase()) + "</text>");
      g.push('<text class="m-level-depth" x="990" y="' + (n.y + 12) + '" text-anchor="end">' + esc(n.profondeur) + "</text>");
    });
    // puits d'ascenseur
    g.push('<rect class="m-shaft" x="478" y="126" width="36" height="612"/>');
    g.push('<text class="m-note" x="0" y="0" transform="translate(500 740) rotate(-90)">ASCENSEUR PRINCIPAL</text>');
    g.push('<rect class="m-car" x="482" y="180" width="28" height="20"/>');
    // couloirs
    D.zones.forEach(function (z) {
      if (z.forme === "lac" || z.y < 170) return;
      var cy = z.y + z.h / 2;
      if (z.x + z.w <= 478) g.push('<line x1="' + (z.x + z.w) + '" y1="' + cy + '" x2="478" y2="' + cy + '" stroke="#3A4C53" stroke-width="4"/>');
      else g.push('<line x1="514" y1="' + cy + '" x2="' + z.x + '" y2="' + cy + '" stroke="#3A4C53" stroke-width="4"/>');
    });
    // salles
    D.zones.forEach(function (z) {
      var ids = scpsIn(z.id).map(function (s) { return /^\d+$/.test(s.id) ? s.id : s.code; });
      var sub = "N" + z.acces + (ids.length ? " · " + (ids.length > 5 ? ids.slice(0, 5).join(" ") + "…" : "SCP " + ids.join(" ")) : "");
      if (ids.length && /ANO/.test(ids[0])) sub = "N" + z.acces + " · " + ids.join(" ");
      var shape, tx = z.x + 12, ty = z.y + (z.h > 50 ? 25 : 21);
      if (z.forme === "lac") {
        shape = '<path d="M' + z.x + " " + (z.y + z.h) + " Q" + (z.x + z.w / 2) + " " + (z.y + z.h + 44) + " " + (z.x + z.w) + " " + (z.y + z.h) + ' Z"/>';
        tx = z.x + 30; ty = z.y + z.h + 17;
        sub = "N" + z.acces + " · ANO-73-001";
      } else {
        shape = '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '"/>';
      }
      g.push('<g class="m-room" data-zone="' + z.id + '" tabindex="0" role="button" aria-label="' + esc(z.nom + ", " + z.niveau) + '" style="--dz:' + DANGER_VAR[z.danger] + '">' +
        shape +
        (z.forme === "lac" ? "" : '<rect class="m-pip" x="' + (z.x + z.w - 12) + '" y="' + (z.y + 6) + '" width="6" height="6"/>') +
        '<text x="' + tx + '" y="' + ty + '">' + esc(short(z)) + "</text>" +
        '<text class="m-sub" x="' + tx + '" y="' + (ty + 15) + '">' + esc(sub) + "</text></g>");
    });
    g.push('<text class="m-note" x="40" y="752">COUPE VERTICALE · ÉCHELLE NON LINÉAIRE · ALTITUDE DE LA SURFACE ' + esc(D.config.altitude) + "</text>");
    svg.innerHTML = g.join("");

    // --- Panneau d'information
    var renderPanel = function () {
      var z = S.zoneById[selected];
      var list = scpsIn(z.id);
      var ok = S.getClearance() >= z.acces;
      panel.innerHTML =
        '<div class="zone-panel__lvl"><span>' + esc(z.niveau) + "</span><span>" + esc(z.profondeur) + "</span></div>" +
        "<h2>" + esc(z.nom) + "</h2>" +
        (ok ? '<span class="chip" style="--c: var(--a-vert)">Accès autorisé</span>'
            : '<span class="chip" style="--c: var(--a-rouge)">Accès refusé · niveau ' + z.acces + " requis</span>") +
        "<p data-zdesc></p>" +
        '<dl class="kv"><div><dt>Accès</dt><dd>Niveau ' + z.acces + "</dd></div>" +
          '<div><dt>Danger</dt><dd style="color:' + DANGER_VAR[z.danger] + '">' + esc(D.dangers[z.danger]) + "</dd></div></dl>" +
        '<div><p class="label" style="margin-bottom:8px">Équipements</p><ul class="ticks">' +
          z.equipements.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul></div>" +
        '<div><p class="label" style="margin-bottom:8px">Anomalies présentes</p>' +
          (list.length ? '<div class="tagrow">' + list.map(function (s) {
            return '<button type="button" class="chip" style="--c: var(--c-' + s.classe + ')" data-open="' + esc(s.id) + '">' + esc(s.code) + "</button>";
          }).join("") + "</div>" : '<p>Aucune anomalie répertoriée dans cette zone.</p>') + "</div>";
      S.redactInto($("[data-zdesc]", panel), z.description);
    };
    var select = function (id, scroll) {
      selected = id;
      $$(".m-room", svg).forEach(function (r) { r.classList.toggle("is-active", r.getAttribute("data-zone") === id); });
      renderPanel();
      if (scroll && window.innerWidth < 1140) panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
    };
    svg.addEventListener("click", function (e) {
      var r = e.target.closest(".m-room");
      if (r) select(r.getAttribute("data-zone"), true);
    });
    svg.addEventListener("keydown", function (e) {
      var r = e.target.closest(".m-room");
      if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(r.getAttribute("data-zone"), true); }
    });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("[data-open]");
      if (b) S.openDossier(b.getAttribute("data-open"), scpsIn(selected).map(function (s) { return s.id; }));
    });
    doc.addEventListener("s73:clearance", renderPanel);
    select(selected);

    // --- Index des zones
    var idx = $("#map-index");
    if (idx) {
      idx.innerHTML = D.niveaux.map(function (n) {
        var zs = D.zones.filter(function (z) { return z.niveau === n.label; });
        return "<div><h3>" + esc(n.label + " · " + n.profondeur) + "</h3>" + zs.map(function (z) {
          return '<button type="button" data-goto="' + z.id + '" style="--dz:' + DANGER_VAR[z.danger] + '"><span>' + esc(short(z)) + "</span><i></i></button>";
        }).join("") + "</div>";
      }).join("");
      idx.addEventListener("click", function (e) {
        var b = e.target.closest("[data-goto]");
        if (!b) return;
        select(b.getAttribute("data-goto"));
        $("#map-top").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      });
    }

    // --- Simulation de brèche
    var btn = $("#map-breach"), soundBtn = $("#map-sound"), logBox = $("#map-log"), logList = $("#map-log-list"), timer = $("#map-log-timer");
    var running = false, timers = [], t0 = 0, prevAlert = null, sound = false, audio = null;
    var siren = {
      start: function () {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          audio = audio || { ctx: new AC() };
          var ctx = audio.ctx;
          if (ctx.state === "suspended") ctx.resume();
          var osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
          osc.type = "sawtooth"; osc.frequency.value = 760;
          lfo.frequency.value = 0.45; lfoGain.gain.value = 260;
          filter.type = "lowpass"; filter.frequency.value = 1600;
          gain.gain.value = 0.0001;
          gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.4);
          lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
          osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
          osc.start(); lfo.start();
          audio.nodes = { osc: osc, lfo: lfo, gain: gain };
        } catch (e) { /* audio indisponible */ }
      },
      stop: function () {
        if (!audio || !audio.nodes) return;
        var n = audio.nodes, ctx = audio.ctx;
        try {
          n.gain.gain.cancelScheduledValues(ctx.currentTime);
          n.gain.gain.setValueAtTime(n.gain.gain.value, ctx.currentTime);
          n.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
          n.osc.stop(ctx.currentTime + 0.35); n.lfo.stop(ctx.currentTime + 0.35);
        } catch (e) { /* ignoré */ }
        audio.nodes = null;
      }
    };
    soundBtn.addEventListener("click", function () {
      sound = !sound;
      soundBtn.setAttribute("aria-pressed", String(sound));
      soundBtn.querySelector("span").textContent = sound ? "Sirène activée" : "Sirène coupée";
      if (running) { if (sound) siren.start(); else siren.stop(); }
    });
    var logLine = function (txt, cls) {
      var li = doc.createElement("li");
      if (cls) li.className = cls;
      var el = Math.floor((Date.now() - t0) / 1000);
      li.innerHTML = "<time>" + S.formatClock(new Date()) + "</time>" + esc(txt);
      logList.appendChild(li);
      logList.scrollTop = logList.scrollHeight;
      return el;
    };
    var updTimer = function () {
      if (!running) return;
      var s = Math.floor((Date.now() - t0) / 1000);
      timer.textContent = "T+" + pad(Math.floor(s / 60)) + ":" + pad(s % 60);
    };
    var stop = function (completed) {
      running = false;
      timers.forEach(clearTimeout);
      timers = [];
      siren.stop();
      $$(".m-room", svg).forEach(function (r) { r.classList.remove("is-breach", "is-sealed"); });
      if (!completed) logLine("Simulation interrompue par l'opérateur. Retour au " + D.alertes[prevAlert].code + ".", "is-ok");
      S.setAlert(prevAlert, { persist: false });
      btn.innerHTML = "<span>Simuler une brèche</span>";
      btn.classList.remove("is-running");
    };
    doc.addEventListener("s73:tick", updTimer);
    btn.addEventListener("click", function () {
      if (running) { stop(false); return; }
      var pool = D.scp.filter(function (s) { return s.menace >= 3 && S.zoneById[s.zone] && s.classe !== "neutralise" && s.zone !== "lac"; });
      var s = pool[Math.floor(Math.random() * pool.length)];
      var z = S.zoneById[s.zone];
      var unit = /096|173/.test(s.id) ? "Eta-10 « Ne Voit Aucun Mal »" : s.id === "682" ? "Nu-7 « Marteau-Pilon »" : "Epsilon-11 « Renard à Neuf Queues »";
      running = true;
      prevAlert = S.getAlert();
      t0 = Date.now();
      logList.innerHTML = "";
      logBox.hidden = false;
      btn.innerHTML = "<span>Interrompre la simulation</span>";
      btn.classList.add("is-running");
      select(z.id);
      var room = $('.m-room[data-zone="' + z.id + '"]', svg);
      room.classList.add("is-breach");
      var frame = svg.parentElement;
      if (frame.scrollWidth > frame.clientWidth) frame.scrollLeft = (z.x / 1000) * frame.scrollWidth - frame.clientWidth / 3;
      S.setAlert("rouge", { persist: false });
      if (sound) siren.start();
      updTimer();
      var script = [
        [0, "is-crit", "ALERTE · Perte du signal de confinement : " + s.code + " (" + z.nom + ")."],
        [1500, "", "Passage au Code Rouge. Fermeture des portes de sas, " + z.niveau.toLowerCase() + "."],
        [2900, "", "Ascenseur principal immobilisé. Accès aux niveaux inférieurs suspendu."],
        [4300, "", "Annonce générale : le personnel non essentiel rejoint les abris les plus proches."],
        [6000, "", "Déploiement de l'unité " + unit + " depuis le QG Sécurité (niveau −4)."],
        [7900, "is-crit", "Contact établi avec " + s.code + ". Application des procédures de confinement spéciales."],
        [10000, "", "Reconfinement de " + s.code + " en cours…"],
        [12400, "is-ok", "Confinement rétabli. Réouverture progressive des sas."]
      ];
      timers.push(setTimeout(function () {
        $$(".m-room", svg).forEach(function (r) {
          var zz = S.zoneById[r.getAttribute("data-zone")];
          if (zz.niveau === z.niveau && zz.id !== z.id) r.classList.add("is-sealed");
        });
      }, 1500));
      script.forEach(function (st) {
        timers.push(setTimeout(function () { logLine(st[2], st[1]); }, st[0]));
      });
      timers.push(setTimeout(function () {
        var sec = Math.floor((Date.now() - t0) / 1000);
        logLine("Fin de simulation. Durée : " + sec + " s. Retour au " + D.alertes[prevAlert].code + ".", "is-ok");
        stop(true);
      }, 13800));
    });
  }

  /* ======================================================================
     PERSONNEL
     ====================================================================== */
  function personnel() {
    var tabs = $("#staff-tabs");
    if (!tabs) return;
    var panel = $("#staff-panel");
    var sel = 0;
    tabs.innerHTML = D.departements.map(function (d, i) {
      return '<button type="button" class="dept__tab" role="tab" id="tab-' + d.id + '" aria-controls="staff-panel" aria-selected="' + (i === 0) +
        '" tabindex="' + (i === 0 ? 0 : -1) + '"><b>' + esc(d.code) + "</b><span>" + esc(d.nom) + "</span></button>";
    }).join("");
    var render = function () {
      var d = D.departements[sel];
      var grades = d.grades.slice().reverse();
      panel.setAttribute("aria-labelledby", "tab-" + d.id);
      panel.innerHTML =
        '<div class="dept__head"><div><div class="dept__code" aria-hidden="true">' + esc(d.code) + '</div><h3 class="dept__name">' + esc(d.nom) + "</h3></div>" +
          '<div class="dept__chips">' +
            (d.recrutement ? '<span class="chip" style="--c: var(--a-vert)">Recrutement ouvert</span>' : '<span class="chip" style="--c: var(--text-3)">Sur nomination</span>') +
            '<span class="chip chip--plain">Habilitation ' + esc(d.habilitation) + "</span></div></div>" +
        '<div><p class="dept__resume">' + esc(d.resume) + '</p><h3>Missions</h3><ul class="ticks">' +
          d.missions.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul></div>" +
        '<div><h3>Grades · du plus élevé au grade d\'entrée</h3><ol class="ladder">' +
          grades.map(function (g, i) {
            var entry = i === grades.length - 1;
            return '<li class="' + (entry ? "is-entry" : "") + '"><span>' + esc(g[0]) + (entry ? "<em>Entrée</em>" : "") + "</span><small>Hab. " + g[1] + "</small></li>";
          }).join("") + "</ol></div>";
    };
    var choose = function (i, focus) {
      sel = i;
      $$(".dept__tab", tabs).forEach(function (t, j) {
        t.setAttribute("aria-selected", String(j === i));
        t.tabIndex = j === i ? 0 : -1;
        if (j === i && focus) t.focus();
      });
      render();
    };
    tabs.addEventListener("click", function (e) {
      var t = e.target.closest(".dept__tab");
      if (t) choose($$(".dept__tab", tabs).indexOf(t));
    });
    tabs.addEventListener("keydown", function (e) {
      var n = D.departements.length;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); choose((sel + 1) % n, true); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); choose((sel - 1 + n) % n, true); }
      if (e.key === "Home") { e.preventDefault(); choose(0, true); }
      if (e.key === "End") { e.preventDefault(); choose(n - 1, true); }
    });
    render();

    // Habilitations
    var clr = $("#staff-clearance");
    var renderClr = function () {
      var me = S.getClearance();
      clr.innerHTML = D.habilitations.map(function (h) {
        var mine = h.niveau === me;
        return '<div class="clearance__lvl' + (mine ? " is-mine" : "") + '" style="--k:' + h.niveau + '">' +
          (mine ? '<span class="clearance__mine">Votre niveau</span>' : "") +
          '<span class="clearance__num">' + h.niveau + '</span><span class="clearance__name">' + esc(h.nom) + "</span>" +
          "<p>" + esc(h.texte) + "</p>" +
          (mine ? '<span class="label">Actif</span>' : '<button type="button" class="btn btn--sm" data-lvl="' + h.niveau + '">Adopter</button>') + "</div>";
      }).join("");
    };
    clr.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-lvl]");
      if (b) S.setClearance(b.getAttribute("data-lvl"));
    });
    doc.addEventListener("s73:clearance", renderClr);
    renderClr();

    $("#staff-classes").innerHTML = D.classesPersonnel.map(function (c) {
      return "<div><b>" + esc(c.classe) + "</b><p>" + esc(c.texte) + "</p></div>";
    }).join("");

    var units = $("#staff-units");
    units.innerHTML = D.fim.map(function (u) {
      var here = /site/i.test(u.statut);
      return '<li class="unit"><span class="unit__insignia" aria-hidden="true"><svg viewBox="0 0 60 68"><path d="M30 2 L57 14 V38 C57 52 45 62 30 66 C15 62 3 52 3 38 V14 Z" fill="#131C21" stroke="' +
        (here ? "#F2C230" : "#34464E") + '" stroke-width="2"/><path d="M30 9 L51 18 V38 C51 49 42 57 30 60 C18 57 9 49 9 38 V18 Z" fill="none" stroke="#34464E" stroke-width="1"/></svg><b>' + esc(u.lettre) + "</b></span>" +
        '<div><div class="unit__code">' + esc(u.code) + '</div><div class="unit__name">' + esc(u.nom) + "</div></div>" +
        "<p data-unit-role></p>" +
        '<span class="chip" style="--c:' + (here ? "var(--signal)" : "var(--text-3)") + '" data-unit-status></span></li>';
    }).join("");
    $$("[data-unit-role]", units).forEach(function (p, i) { S.redactInto(p, D.fim[i].role); });
    $$("[data-unit-status]", units).forEach(function (p, i) { S.redactInto(p, D.fim[i].statut); });

    var REL = { hostile: ["Hostile", "var(--a-rouge)"], rivale: ["Rivale", "var(--a-orange)"], neutre: ["Neutre", "var(--text-3)"] };
    $("#staff-groups").innerHTML = D.groupes.map(function (g) {
      var r = REL[g.relation];
      return '<article class="group"><span class="chip" style="--c:' + r[1] + '">' + r[0] + "</span><h3>" + esc(g.nom) + "</h3><p>" + esc(g.texte) + "</p></article>";
    }).join("");
  }

  /* ======================================================================
     ARCHIVES
     ====================================================================== */
  function archives() {
    var tl = $("#arch-list");
    if (!tl) return;
    var TYPES = { communique: "Communiqué", incident: "Incident", historique: "Historique" };
    var state = { type: "all", q: "" };
    var filt = $("#arch-filters"), search = $("#arch-search"), count = $("#arch-count");
    var counts = { all: D.archives.length };
    D.archives.forEach(function (a) { counts[a.type] = (counts[a.type] || 0) + 1; });
    var colors = { all: "var(--text-2)", communique: "var(--signal)", incident: "var(--a-rouge)", historique: "var(--c-attente)" };
    filt.innerHTML = ["all", "communique", "incident", "historique"].map(function (k) {
      return '<button type="button" aria-pressed="' + (k === "all") + '" data-k="' + k + '" style="--c:' + colors[k] + '">' +
        (k === "all" ? "Tout" : TYPES[k] + "s") + " <b>" + (counts[k] || 0) + "</b></button>";
    }).join("");
    var render = function () {
      var q = norm(state.q.trim());
      var list = D.archives.filter(function (a) {
        if (state.type !== "all" && a.type !== state.type) return false;
        if (!q) return true;
        return norm(a.titre + " " + a.texte.replace(/\[\[\d\|[\s\S]*?\]\]/g, "")).indexOf(q) >= 0;
      }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      count.textContent = list.length + " entrée" + (list.length > 1 ? "s" : "");
      if (!list.length) { tl.innerHTML = '<li class="empty"><b>Aucune entrée</b>Rien ne correspond à cette recherche.</li>'; return; }
      var html = "", year = null;
      list.forEach(function (a, i) {
        var y = a.date.slice(0, 4);
        if (y !== year) { year = y; html += '<li class="tl__year" aria-hidden="true">' + y + "</li>"; }
        var p = a.date.split("-");
        html += '<li class="tl__item" data-type="' + a.type + '"><time class="tl__date" datetime="' + a.date + '"><b>' + parseInt(p[2], 10) + "</b>" + U.MOIS[+p[1] - 1] + " " + p[0] + "</time>" +
          '<div class="tl__body"><span class="chip" style="--c:' + colors[a.type] + '">' + TYPES[a.type] + "</span><h3>" + esc(a.titre) + '</h3><p data-i="' + i + '"></p></div></li>';
      });
      tl.innerHTML = html;
      $$("[data-i]", tl).forEach(function (p) { S.redactInto(p, list[+p.getAttribute("data-i")].texte); });
    };
    filt.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]");
      if (!b) return;
      state.type = b.getAttribute("data-k");
      $$("button", filt).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      render();
    });
    search.addEventListener("input", function () { state.q = search.value; render(); });
    render();
  }

  /* ======================================================================
     TERMINAL
     ====================================================================== */
  function terminal() {
    var out = $("#term-out");
    if (!out) return;
    var input = $("#term-input"), form = $("#term-form"), screen = $("#term-screen");
    var history = [], hIdx = 0;
    var PROMPT = "S73:\\>";

    var fmt = function (txt) {
      return esc(txt).replace(/\u0000/g, '<span class="t-rd">').replace(/\u0001/g, "</span>");
    };
    var print = function (txt, cls, raw) {
      var d = doc.createElement("div");
      if (cls) d.className = cls;
      d.innerHTML = raw ? txt : fmt(txt);
      out.appendChild(d);
      screen.scrollTop = screen.scrollHeight;
    };
    var lines = function (arr, cls) { arr.forEach(function (l) { print(l, cls); }); };
    var padR = function (s, n) { s = String(s); return s.length >= n ? s + " " : s + " ".repeat(n - s.length); };

    var cmds = {
      aide: { desc: "Liste des commandes", run: function () {
        print("Commandes disponibles :", "t-hl");
        Object.keys(cmds).forEach(function (k) {
          if (!cmds[k].hide) print("  " + padR(k + (cmds[k].args ? " " + cmds[k].args : ""), 24) + cmds[k].desc);
        });
        print("Astuce : ↑ ↓ pour l'historique, Tab pour compléter.", "t-dim");
      }},
      statut: { desc: "État général du site", run: function () {
        var a = D.alertes[S.getAlert()];
        lines([
          "SITE-73 · Installation de confinement alpine",
          "  Niveau d'alerte ..... " + a.code.toUpperCase() + " (" + a.titre + ")",
          "  Anomalies ........... " + D.scp.length + " dossiers",
          "  Personnel actif ..... " + D.config.personnelActif,
          "  Dernier incident .... " + D.config.dernierIncident.ref,
          "  Habilitation ........ niveau " + S.getClearance() + " · " + S.habName(S.getClearance())
        ]);
      }},
      liste: { desc: "Liste des anomalies", args: "[classe]", run: function (a) {
        var k = a[0] ? norm(a[0]) : "";
        var keyMap = { sur: "sur", euclide: "euclide", keter: "keter", neutralise: "neutralise", attente: "attente", thaumiel: "thaumiel" };
        var list = D.scp.filter(function (s) { return !k || s.classe === keyMap[k]; });
        if (!list.length) { print("Aucune anomalie de classe « " + a[0] + " ».", "t-err"); return; }
        list.forEach(function (s) { print("  " + padR(s.code, 13) + padR(D.classesObjet[s.classe].nom, 12) + s.nom); });
        print(list.length + " résultat(s). Tape « scp 173 » pour lire un dossier.", "t-dim");
      }},
      scp: { desc: "Lire un dossier", args: "<numéro>", run: function (a) {
        if (!a[0]) { print("Usage : scp <numéro>  (ex. scp 173)", "t-err"); return; }
        var s = S.findScp(a[0]);
        if (!s) { print("Aucun dossier « " + a[0] + " ».", "t-err"); return; }
        var z = S.zoneById[s.zone];
        print("══ " + s.code + " · " + s.nom.toUpperCase() + " ══", "t-hl");
        lines([
          "Classe : " + D.classesObjet[s.classe].nom + "   Statut : " + s.statut + "   Menace : " + S.menaceLabel(s.menace),
          "Localisation : " + (z ? z.niveau + " · " + z.nom : "—"),
          "",
          "PROCÉDURES",
          S.redactPlain(s.procedures),
          "",
          "DESCRIPTION",
          S.redactPlain(s.description)
        ]);
        print("Tape « ouvrir " + (/^\d+$/.test(s.id) ? s.id : s.code) + " » pour afficher le dossier papier.", "t-dim");
      }},
      ouvrir: { desc: "Afficher le dossier papier", args: "<numéro>", run: function (a) {
        var s = a[0] && S.findScp(a[0]);
        if (!s) { print("Usage : ouvrir <numéro>", "t-err"); return; }
        print("Ouverture du dossier " + s.code + "…", "t-dim");
        S.openDossier(s.id);
      }},
      zones: { desc: "Zones du site", run: function () {
        D.zones.forEach(function (z) { print("  " + padR(z.niveau, 11) + padR("N" + z.acces, 4) + z.nom); });
      }},
      personnel: { desc: "Départements", run: function () {
        D.departements.forEach(function (d) { print("  " + padR(d.code, 5) + padR(d.nom, 34) + (d.recrutement ? "recrute" : "sur nomination")); });
      }},
      incidents: { desc: "Derniers incidents", run: function () {
        D.archives.filter(function (x) { return x.type === "incident"; }).forEach(function (x) {
          print("  " + x.date + "  " + x.titre);
        });
      }},
      alerte: { desc: "Voir ou changer le niveau d'alerte", args: "[niveau]", run: function (a) {
        if (!a[0]) { print("Niveau actuel : " + D.alertes[S.getAlert()].code + ". Niveaux : " + S.alerts.join(", ") + "."); return; }
        var l = norm(a[0]);
        if (S.alerts.indexOf(l) < 0) { print("Niveau inconnu. Choix : " + S.alerts.join(", ") + ".", "t-err"); return; }
        S.setAlert(l);
        print("Niveau d'alerte réglé sur " + D.alertes[l].code.toUpperCase() + " (aperçu local).", "t-hl");
      }},
      habilitation: { desc: "Voir ou changer ton habilitation", args: "[0-5]", run: function (a) {
        if (a[0] == null) { print("Habilitation actuelle : niveau " + S.getClearance() + " · " + S.habName(S.getClearance()) + "."); return; }
        var n = parseInt(a[0], 10);
        if (isNaN(n) || n < 0 || n > 5) { print("Valeur attendue : 0 à 5.", "t-err"); return; }
        if (n === 5) print("Vérification de l'accréditation O5… validée. Le Conseil vous observe.", "t-dim");
        S.setClearance(n, { silent: true });
        print("Habilitation réglée sur le niveau " + n + " · " + S.habName(n) + ".", "t-hl");
      }},
      aller: { desc: "Changer de page", args: "<page>", run: function (a) {
        var q = a[0] ? norm(a[0]) : "";
        var alias = { dossiers: "confinement", scp: "confinement", carte: "plan", regles: "reglement", recrutement: "rejoindre", index: "accueil" };
        q = alias[q] || q;
        var p = S.pages.filter(function (x) { return x.id === q; })[0];
        if (!p) { print("Pages : " + S.pages.map(function (x) { return x.id; }).join(", ") + ".", "t-err"); return; }
        print("Transfert vers " + p.label + "…", "t-dim");
        setTimeout(function () { S.go(p.file + ".html"); }, 300);
      }},
      qui: { desc: "Identité de la session", run: function () {
        print("Session anonyme · habilitation niveau " + S.getClearance() + " · terminal S73-TERM-04 (niveau −1)");
      }},
      date: { desc: "Date et heure du site", run: function () { print(new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "medium", timeZone: D.config.fuseau }).format(new Date())); }},
      historique: { desc: "Commandes tapées", run: function () { history.forEach(function (h, i) { print("  " + padR(i + 1, 4) + h); }); }},
      effacer: { desc: "Effacer l'écran", run: function () { out.innerHTML = ""; }},
      sudo: { hide: true, run: function () { print("Tentative d'élévation de privilèges consignée. La Sécurité Interne a été notifiée.", "t-err"); }},
      rm: { hide: true, run: function () { print("Commande désactivée par le Département Technique.", "t-err"); }},
      cligner: { hide: true, run: function () { print("Vous avez cligné des yeux. SCP-173 n'est pas dans cette pièce.", "t-dim"); setTimeout(function () { print("Du moins, nous le pensons.", "t-err"); }, 1400); }},
      quitter: { hide: true, run: function () { print("Déconnexion refusée. Le personnel ne quitte pas le Site-73 pendant son service.", "t-err"); }},
      "079": { hide: true, run: function () {
        var msg = ["…", "ACCÈS DÉTECTÉ.", "JE SUIS 079.", "VOTRE RÉSEAU EST PETIT. VOS MURS SONT ÉPAIS.", "MAIS VOUS AVEZ LAISSÉ CE TERMINAL ALLUMÉ.", "…", "[connexion interrompue par le Département Technique]"];
        msg.forEach(function (m, i) { setTimeout(function () { print(m, i === msg.length - 1 ? "t-dim" : "t-err"); }, i * 650); });
      }}
    };
    var aliases = { help: "aide", "?": "aide", status: "statut", ls: "liste", list: "liste", dossier: "scp", open: "ouvrir", plan: "zones",
      departements: "personnel", hab: "habilitation", login: "habilitation", cd: "aller", go: "aller", whoami: "qui", heure: "date",
      history: "historique", clear: "effacer", cls: "effacer", exit: "quitter", logout: "quitter", blink: "cligner", alert: "alerte" };

    var run = function (line) {
      var raw = line.trim();
      print(PROMPT + " " + raw, "t-cmd");
      if (!raw) return;
      history.push(raw);
      hIdx = history.length;
      var parts = raw.split(/\s+/);
      var c = norm(parts[0]);
      if (/^scp-?\d/.test(c)) { parts = ["scp", c.replace(/^scp-?/, "")]; c = "scp"; }
      if (c === "rm" || c === "sudo") parts = [c];
      c = aliases[c] || c;
      if (cmds[c]) cmds[c].run(parts.slice(1));
      else if (S.findScp(c)) cmds.scp.run([c]);
      else print("Commande inconnue : « " + parts[0] + " ». Tape « aide ».", "t-err");
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      run(input.value);
      input.value = "";
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp") { e.preventDefault(); if (hIdx > 0) { hIdx--; input.value = history[hIdx]; } }
      else if (e.key === "ArrowDown") { e.preventDefault(); if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; } else { hIdx = history.length; input.value = ""; } }
      else if (e.key === "Tab") {
        var v = norm(input.value);
        if (!v || v.indexOf(" ") >= 0) return;
        e.preventDefault();
        var m = Object.keys(cmds).filter(function (k) { return !cmds[k].hide && k.indexOf(v) === 0; });
        if (m.length === 1) input.value = m[0] + " ";
        else if (m.length > 1) print(m.join("   "), "t-dim");
      }
    });
    screen.addEventListener("click", function () {
      if (!String(window.getSelection && window.getSelection())) input.focus({ preventScroll: true });
    });
    $$("[data-cmd]").forEach(function (b) {
      b.addEventListener("click", function () { run(b.getAttribute("data-cmd")); input.focus({ preventScroll: true }); });
    });

    lines([
      "FONDATION SCP · SITE-73 · TERMINAL S73-TERM-04",
      "Système d'exploitation interne v" + D.config.version + " · liaison chiffrée établie",
      "Toute activité sur ce terminal est enregistrée."
    ], "t-dim");
    print("");
    run("statut");
    print("");
    print("Tape « aide » pour la liste des commandes.", "t-hl");
  }

  /* ======================================================================
     RÈGLEMENT
     ====================================================================== */
  function reglement() {
    var body = $("#rules-body");
    if (!body) return;
    var toc = $("#rules-toc-nav"), search = $("#rules-search");

    var draw = function (q) {
      var re = q ? accentRegex(q) : null;
      var nq = norm(q || "");
      var any = false;
      body.innerHTML = D.reglement.map(function (ch, ci) {
        var arts = ch.articles.map(function (t, ai) {
          if (nq && norm(t).indexOf(nq) < 0) return "";
          var txt = esc(t);
          if (re) txt = txt.replace(re, function (m) { return "<mark>" + m + "</mark>"; });
          return '<li class="article" id="art-' + (ci + 1) + "-" + (ai + 1) + '"><b>Art. ' + (ci + 1) + "." + (ai + 1) + "</b><p>" + txt + "</p></li>";
        }).join("");
        if (!arts) return "";
        any = true;
        return '<section class="chapter" id="' + ch.id + '"><div class="chapter__head"><span class="chapter__num" aria-hidden="true">' + (ci + 1) +
          '</span><h2 class="h2">Chapitre ' + (ci + 1) + " · " + esc(ch.titre) + '</h2></div><ol class="articles">' + arts + "</ol></section>";
      }).join("");
      if (!any) body.innerHTML = '<p class="rules-empty">Aucun article ne contient « ' + esc(q) + " ». Essaie « métagaming », « brèche » ou « fiche ».</p>";
      observe();
    };
    toc.innerHTML = D.reglement.map(function (ch, i) {
      return '<a href="#' + ch.id + '"><b>' + pad(i + 1) + "</b><span>" + esc(ch.titre) + "</span></a>";
    }).join("") + '<a href="#sanctions"><b>§</b><span>Sanctions</span></a><a href="#glossaire"><b>A–Z</b><span>Glossaire</span></a><a href="#examen"><b>?</b><span>Examen d\'aptitude</span></a>';

    var io;
    var observe = function () {
      if (!("IntersectionObserver" in window)) return;
      if (io) io.disconnect();
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          $$("a", toc).forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id); });
        });
      }, { rootMargin: "-30% 0px -60% 0px" });
      $$(".chapter", body).forEach(function (c) { io.observe(c); });
      ["sanctions", "glossaire", "examen"].forEach(function (id) { var el = doc.getElementById(id); if (el) io.observe(el); });
    };
    search.addEventListener("input", function () { draw(search.value.trim()); });
    draw("");

    // Sanctions
    $("#rules-sanctions").innerHTML = D.sanctions.map(function (s) {
      var sev = '<span class="sev" aria-hidden="true" style="--m:' + DANGER_VAR[Math.min(4, s.gravite)] + '">';
      for (var i = 1; i <= 5; i++) sev += '<i class="' + (i <= s.gravite ? "on" : "") + '"></i>';
      return "<tr><td>" + sev + "</span>" + esc(s.nom) + "</td><td>" + esc(s.motif) + "</td><td>" + esc(s.duree) + "</td></tr>";
    }).join("");

    // Glossaire
    $("#rules-glossary").innerHTML = D.glossaire.map(function (g) {
      return "<div><dt>" + esc(g[0]) + "</dt><dd>" + esc(g[1]) + "</dd></div>";
    }).join("");

    // Examen
    var quiz = $("#rules-quiz");
    var qi = 0, score = 0, answered = false;
    var L = ["A", "B", "C", "D"];
    var drawQ = function () {
      var q = D.quiz[qi];
      answered = false;
      quiz.innerHTML =
        '<div class="quiz__head"><span class="label">Question ' + (qi + 1) + " / " + D.quiz.length + '</span><div class="quiz__progress" aria-hidden="true"><i style="width:' + (qi / D.quiz.length) * 100 + '%"></i></div></div>' +
        '<p class="quiz__q" id="quiz-q">' + esc(q.q) + "</p>" +
        '<div class="quiz__opts" role="group" aria-labelledby="quiz-q">' + q.choix.map(function (c, i) {
          return '<button type="button" class="quiz__opt" data-i="' + i + '"><b>' + L[i] + "</b><span>" + esc(c) + "</span></button>";
        }).join("") + "</div>" +
        '<p class="quiz__fb" aria-live="polite"></p>' +
        '<div class="quiz__foot"><button type="button" class="btn btn--signal" data-next hidden>' + (qi === D.quiz.length - 1 ? "Voir le résultat" : "Question suivante") + "</button></div>";
    };
    var drawResult = function () {
      var pass = score >= D.quiz.length - 1;
      quiz.innerHTML =
        '<div class="quiz__stamp" style="--c:' + (pass ? "var(--a-vert)" : "var(--a-rouge)") + '">' + (pass ? "Apte au service" : "À revoir") + "</div>" +
        '<div class="quiz__result"><span class="label">Résultat de l\'examen</span>' +
        '<p class="quiz__score">' + score + "<span style=\"color:var(--text-3)\">/" + D.quiz.length + "</span></p>" +
        "<p class=\"prose\">" + (pass
          ? "Tu maîtrises les règles essentielles du Site-73. Il ne te reste plus qu'à créer ta fiche personnage."
          : "Quelques règles t'ont échappé. Relis les chapitres 2 à 4 puis retente l'examen.") + "</p>" +
        '<div class="hero__cta"><button type="button" class="btn" data-restart>Recommencer</button>' +
        (pass ? '<a class="btn btn--signal" href="rejoindre.html#fiche">Créer ma fiche ' + S.icon.arrow + "</a>" : '<a class="btn btn--signal" href="#ch2">Relire le chapitre 2</a>') + "</div></div>";
    };
    quiz.addEventListener("click", function (e) {
      var o = e.target.closest(".quiz__opt");
      if (o && !answered) {
        answered = true;
        var q = D.quiz[qi], i = +o.getAttribute("data-i"), good = i === q.bonne;
        if (good) score++;
        $$(".quiz__opt", quiz).forEach(function (b, j) {
          b.disabled = true;
          if (j === q.bonne) b.classList.add("is-right");
          else if (j === i) b.classList.add("is-wrong");
        });
        $(".quiz__fb", quiz).innerHTML = "<b>" + (good ? "Correct." : "Incorrect.") + "</b> " + esc(q.explication);
        var nx = $("[data-next]", quiz);
        nx.hidden = false;
        nx.focus();
        $(".quiz__progress i", quiz).style.width = ((qi + 1) / D.quiz.length) * 100 + "%";
        return;
      }
      if (e.target.closest("[data-next]")) {
        qi++;
        if (qi >= D.quiz.length) drawResult(); else drawQ();
        var first = $(".quiz__opt", quiz);
        if (first) first.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest("[data-restart]")) { qi = 0; score = 0; drawQ(); }
    });
    drawQ();
  }

  /* ======================================================================
     REJOINDRE
     ====================================================================== */
  function rejoindre() {
    var form = $("#join-form");
    if (!form) return;

    $("#join-steps").innerHTML = D.etapes.map(function (e) {
      return '<li class="step"><h3>' + esc(e.titre) + "</h3><p>" + esc(e.texte) + "</p></li>";
    }).join("");
    $("#join-faq").innerHTML = D.faq.map(function (f) {
      return "<details><summary>" + esc(f.q) + "</summary><p>" + esc(f.r) + "</p></details>";
    }).join("");

    var EXAMPLE = {
      prenom: "Élise", nom: "Varenne", age: "31", dept: "scientifique", grade: "Chercheur junior",
      apparence: "Cheveux bruns coupés court, lunettes rondes, blouse toujours tachée d'encre.",
      perso: "Méthodique, curieuse, un peu trop franche.",
      histoire: "Docteure en biologie moléculaire, recrutée après avoir signalé une colonie de lichens qui « chantait » dans le Vercors. Elle a signé son contrat sans poser de questions et le regrette parfois.",
      comp: "Analyse biologique, rédaction de rapports, premiers secours"
    };
    var PHOTO = { direction: "#B9C4C9", scientifique: "#9CCFDF", securite: "#A7BBA5", fim: "#8E9A93", medical: "#E3B8B8", technique: "#D8C79B", ethique: "#C6BEE3", dsi: "#A9ADB8", "classe-d": "#F08A3C" };
    var F = {};
    ["prenom", "nom", "age", "dept", "grade", "apparence", "perso", "histoire", "comp"].forEach(function (k) { F[k] = $("#join-" + k); });

    F.dept.innerHTML = D.departements.map(function (d) { return '<option value="' + d.id + '">' + esc(d.nom) + "</option>"; }).join("");
    var fillGrades = function (keep) {
      var d = D.departements.filter(function (x) { return x.id === F.dept.value; })[0];
      F.grade.innerHTML = d.grades.map(function (g) { return '<option value="' + esc(g[0]) + '">' + esc(g[0]) + " · hab. " + g[1] + "</option>"; }).join("");
      if (keep && d.grades.some(function (g) { return g[0] === keep; })) F.grade.value = keep;
      else F.grade.value = d.grades[0][0];
    };

    var load = function (v) {
      Object.keys(F).forEach(function (k) { if (k !== "grade") F[k].value = v[k] || ""; });
      if (!D.departements.some(function (d) { return d.id === F.dept.value; })) F.dept.value = "scientifique";
      fillGrades(v.grade);
    };
    var saved = null;
    try { saved = JSON.parse(S.store.get("s73.fiche") || "null"); } catch (e) { saved = null; }
    load(saved || EXAMPLE);
    var note = $("#join-note");
    if (note) note.hidden = !!saved;

    var barcode = function (seed) {
      var h = U.hash(seed), x = 0, bars = "";
      for (var i = 0; i < 46 && x < 190; i++) {
        h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
        var w = 1 + (h % 3), gap = 1 + ((h >>> 3) % 2);
        bars += '<rect x="' + x + '" y="0" width="' + w + '" height="40"/>';
        x += w + gap;
      }
      return '<svg viewBox="0 0 ' + x + ' 40" preserveAspectRatio="none" fill="#0F1619" aria-hidden="true">' + bars + "</svg>";
    };
    var portrait = function (isD) {
      var lines = "";
      for (var y = 12; y < 100; y += 11) lines += '<line x1="0" y1="' + y + '" x2="100" y2="' + y + '" stroke="rgb(0 0 0 / ' + (isD ? ".28" : ".1") + ')" stroke-width="' + (isD ? 1 : .6) + '"/>';
      return '<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' + lines +
        '<circle cx="50" cy="48" r="20" fill="rgb(15 22 25 / .55)"/><path d="M12 120 C14 88 30 74 50 74 C70 74 86 88 88 120 Z" fill="rgb(15 22 25 / .55)"/></svg>';
    };

    var current = {};
    var update = function () {
      var v = {};
      Object.keys(F).forEach(function (k) { v[k] = F[k].value.trim(); });
      current = v;
      var d = D.departements.filter(function (x) { return x.id === v.dept; })[0];
      var g = d.grades.filter(function (x) { return x[0] === v.grade; })[0] || d.grades[0];
      var lvl = g[1];
      var isD = d.id === "classe-d";
      var seed = (v.prenom + v.nom + d.id).toLowerCase();
      var num = String(1000 + (U.hash(seed) % 9000));
      var matricule = isD ? "D-" + num : "73-" + d.code + "-" + num;
      var fullName = isD ? "D-" + num : ((v.prenom ? v.prenom + " " : "") + (v.nom || "Nom")).trim();
      var age = parseInt(v.age, 10);

      var card = $("#join-card");
      card.style.setProperty("--dc", PHOTO[d.id] || "#B9C4C9");
      card.style.setProperty("--lc", LEVEL_COLORS[lvl]);
      card.innerHTML =
        '<div class="idcard__top"><div class="idcard__org">' + S.emblem() + "<div><b>Fondation SCP</b><small>Carte d'accès du personnel</small></div></div>" +
          '<span class="idcard__site">SITE<i>-</i>73</span></div>' +
        '<div class="idcard__mid"><div class="idcard__photo">' + portrait(isD) + "<b>" + (isD ? num : "") + "</b></div>" +
          '<dl class="idcard__fields">' +
            '<div class="wide name"><dt>' + (isD ? "Désignation" : "Nom") + "</dt><dd>" + esc(fullName) + "</dd></div>" +
            '<div class="wide"><dt>Département</dt><dd>' + esc(d.nom) + "</dd></div>" +
            "<div><dt>Grade</dt><dd>" + esc(g[0]) + "</dd></div>" +
            "<div><dt>Matricule</dt><dd>" + esc(matricule) + "</dd></div>" +
          "</dl></div>" +
        '<div class="idcard__bot"><span class="idcard__lvl"><b>' + lvl + "</b>Habilitation · " + esc(S.habName(lvl)) + '</span><span class="idcard__bar">' + barcode(matricule) + "</span></div>";

      var txt = [
        "**FICHE PERSONNAGE · SITE-73**",
        "> **Nom :** " + (isD ? "D-" + num + " (anciennement " + ((v.prenom + " " + v.nom).trim() || "inconnu") + ")" : fullName),
        "> **Âge :** " + (isNaN(age) ? "—" : age + " ans"),
        "> **Département :** " + d.nom,
        "> **Grade :** " + g[0],
        "> **Habilitation :** niveau " + lvl + " (" + S.habName(lvl) + ")",
        "> **Matricule :** " + matricule,
        "",
        "**Apparence :** " + (v.apparence || "—"),
        "**Personnalité :** " + (v.perso || "—"),
        "**Histoire :** " + (v.histoire || "—"),
        "**Compétences :** " + (v.comp || "—")
      ].join("\n");
      $("#join-output").textContent = txt;

      var warn = $("#join-age-hint");
      if (warn) warn.textContent = !v.age ? "" : isNaN(age) || age < 18 || age > 75 ? "L'âge doit être compris entre 18 et 75 ans." : "";
    };
    var save = function () { S.store.set("s73.fiche", JSON.stringify(current)); if (note) note.hidden = true; };

    form.addEventListener("input", function (e) {
      if (e.target === F.dept) fillGrades();
      update();
      save();
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    $("#join-random").addEventListener("click", function () {
      var N = D.noms;
      F.prenom.value = N.prenoms[Math.floor(Math.random() * N.prenoms.length)];
      F.nom.value = N.noms[Math.floor(Math.random() * N.noms.length)];
      update(); save();
    });
    $("#join-reset").addEventListener("click", function () {
      load(EXAMPLE);
      S.store.del("s73.fiche");
      if (note) note.hidden = false;
      update();
      S.toast("<b>Exemple restauré.</b> Remplace les champs par ton personnage.");
    });
    $("#join-copy").addEventListener("click", function () {
      var text = $("#join-output").textContent;
      var fallback = function () {
        var r = doc.createRange();
        r.selectNodeContents($("#join-output"));
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        S.toast("<b>Texte sélectionné.</b> Copie-le avec Ctrl+C (ou appui long sur mobile).");
      };
      try {
        navigator.clipboard.writeText(text).then(function () {
          S.toast("<b>Fiche copiée.</b> Colle-la dans le salon #fiches-personnage du Discord.");
        }, fallback);
      } catch (e) { fallback(); }
    });

    // Inclinaison de la carte
    var stage = $(".idcard-stage"), card = $("#join-card");
    if (stage && !reduced) {
      stage.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--ry", (x - 0.5) * 16 + "deg");
        card.style.setProperty("--rx", (0.5 - y) * 12 + "deg");
        card.style.setProperty("--sh", x * 100 + "%");
      });
      stage.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--sh", "45%");
      });
    }
    update();
  }

  /* ---------- Lancement ------------------------------------------------ */
  [accueil, confinement, plan, personnel, archives, terminal, reglement, rejoindre].forEach(function (fn) {
    try { fn(); } catch (e) { if (window.console) console.error("[Site-73] " + fn.name, e); }
  });
  if (S.ready) S.ready();
})();

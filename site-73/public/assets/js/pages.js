/* ==========================================================================
   SITE-73 · MODULES DES PAGES
   Accueil, dossiers, plan, personnel, archives, terminal, règlement, rejoindre.
   Chaque module ne s'active que si sa page est présente dans le document.
   ========================================================================== */
(function () {
  "use strict";

  let S = window.S73, D = S.data, doc = document;
  let U = S.util, esc = U.esc, norm = U.norm, pad = U.pad;
  let $ = function (s, r) { return (r || doc).querySelector(s); };
  let $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  let reduced = document.documentElement.getAttribute("data-motion") === "reduit";
  document.addEventListener("s73:settings", function () { reduced = document.documentElement.getAttribute("data-motion") === "reduit"; });

  let CLASS_ORDER = ["sur", "euclide", "keter", "thaumiel", "attente", "neutralise"];
  let DANGER_VAR = ["", "var(--d1)", "var(--d2)", "var(--d3)", "var(--d4)"];
  let LEVEL_COLORS = ["#A9B3B5", "#7FC8A9", "#F2C230", "#F59331", "#EF4747", "#A08CFF"];
  S.levelColors = LEVEL_COLORS;
  S.dangerVar = DANGER_VAR;

  let classChip = function (key) {
    return '<span class="chip" style="--c: var(--c-' + key + ')">' + esc(D.classesObjet[key].nom) + "</span>";
  };
  let meter = function (n, max) {
    let h = '<span class="meter" role="img" aria-label="Menace ' + n + " sur " + (max || 5) + '" style="--m:' + DANGER_VAR[Math.min(4, Math.max(1, n - 1 || 1))] + '">';
    for (let i = 1; i <= (max || 5); i++) h += '<i class="' + (i <= n ? "on" : "") + '"></i>';
    return h + "</span>";
  };
  let scpNum = function (s) { return /^\d+$/.test(s.id) ? s.id : s.id.replace(/^ANO-/, ""); };
  let statusClass = function (s) {
    if (/neutralis/i.test(s.statut)) return "is-off";
    if (/surveill/i.test(s.statut)) return "is-warn";
    return "";
  };
  let accentRegex = function (q) {
    let map = { a: "aàâä", e: "eéèêë", i: "iîï", o: "oôö", u: "uùûü", c: "cç", y: "yÿ" };
    let src = norm(q).split("").map(function (ch) {
      return map[ch] ? "[" + map[ch] + "]" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
    return new RegExp(src, "gi");
  };
  S.classChip = classChip;
  S.meter = meter;

  /* ---------- Outils partagés ----------------------------------------- */
  let evtFmt;
  try {
    evtFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    evtFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  }
  S.fmtEvent = function (iso) { return evtFmt.format(new Date(iso)).replace(/ à /, " · ").replace(":", " h "); };
  S.upcoming = function () {
    let now = Date.now();
    return (D.evenements || []).filter(function (e) { return new Date(e.date).getTime() + e.duree * 60000 > now; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  };
  // Expérience SCP-914 : renvoie le texte du résultat (avec caviardage éventuel).
  S.run914 = function (objet, idx) {
    let L = D.lab914;
    let known = L.objets.filter(function (o) { return norm(o.nom) === norm(objet) || norm(o.nom).indexOf(norm(objet)) >= 0; })[0];
    let res;
    if (known && norm(objet).length >= 3) res = known.res[idx];
    else {
      res = L.inconnu[idx];
      if (Array.isArray(res)) res = res[Math.floor(Math.random() * res.length)];
      res = res.replace(/\{objet\}/g, objet.trim() || "L'objet");
      res = res.charAt(0).toUpperCase() + res.slice(1);
    }
    S.stat("x914");
    if (idx === 4) S.flag("tresfin");
    return res;
  };

  /* ======================================================================
     ACCUEIL
     ====================================================================== */
  function accueil() {
    let home = $("#home");
    if (!home) return;

    let track = $("#home-ticker");
    if (track) {
      let items = D.bandeau.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
      track.innerHTML = items + items.replace(/<span>/g, '<span aria-hidden="true">');
    }

    // Niveau d'alerte : affiché pour tous, modifiable seulement en mode staff
    let seg = $("#home-alert-seg");
    if (seg) {
      seg.innerHTML = S.alerts.map(function (a) {
        return '<button type="button" role="radio" data-alert="' + a + '" style="--c: var(--a-' + a + ')">' + esc(D.alertes[a].code.replace("Code ", "")) + "</button>";
      }).join("");
      let syncSeg = function () {
        let cur = S.officialAlert();
        $$("button", seg).forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-alert") === cur)); });
      };
      seg.addEventListener("click", function (e) {
        let b = e.target.closest("button[data-alert]");
        if (b) S.proposerAlerte(b.getAttribute("data-alert"));
      });
      doc.addEventListener("s73:alert", syncSeg);
      doc.addEventListener("s73:session", syncSeg);
      syncSeg();
    }

    // Depuis le dernier incident
    let since = $("[data-since]");
    if (since) {
      let start = new Date(D.config.dernierIncident.date).getTime();
      let upd = function () { since.textContent = S.formatCountdown(Date.now() - start); };
      upd();
      doc.addEventListener("s73:tick", upd);
      $$("[data-since-ref]").forEach(function (el) { el.textContent = D.config.dernierIncident.ref; });
    }

    // Répartition par classe
    let stack = $("#home-stack"), legend = $("#home-legend");
    if (stack) {
      let counts = {};
      D.scp.forEach(function (s) { counts[s.classe] = (counts[s.classe] || 0) + 1; });
      let keys = CLASS_ORDER.filter(function (k) { return counts[k]; });
      stack.innerHTML = keys.map(function (k) {
        return '<i style="--c: var(--c-' + k + "); flex:" + counts[k] + '" title="' + esc(D.classesObjet[k].nom) + " : " + counts[k] + '"></i>';
      }).join("");
      legend.innerHTML = keys.map(function (k) {
        return '<li style="--c: var(--c-' + k + ')">' + esc(D.classesObjet[k].nom) + " " + counts[k] + "</li>";
      }).join("");
    }

    // Prochain événement
    let next = $("#home-next");
    if (next) {
      let ev = null, T = null;
      let renderNext = function () {
        ev = S.upcoming()[0];
        if (!ev) {
          next.innerHTML = '<p class="label">Prochain événement</p><p class="next__title">Aucun événement programmé</p><div class="next__cta"><a class="btn" href="evenements.html">Voir le calendrier</a></div>';
          return;
        }
        T = D.typesEvenement[ev.type];
        (function () {
          let on = S.isMarked("planning", ev.id);
          next.style.setProperty("--c", T.couleur);
          next.innerHTML =
            '<div class="next__info"><p class="label">Prochain événement</p>' +
              '<p class="next__title">' + esc(ev.titre) + "</p>" +
              '<p class="next__meta"><span class="chip" style="--c:' + T.couleur + '">' + esc(T.nom) + "</span><span>" + esc(S.fmtEvent(ev.date)) + "</span><span>" + esc(ev.lieu) + "</span></p></div>" +
            '<div class="next__count"><p class="label">Début dans</p><p class="next__timer mono" data-next-timer></p></div>' +
            '<div class="next__cta"><button type="button" class="btn' + (on ? " btn--signal" : "") + '" data-plan aria-pressed="' + on + '">' + (on ? "Dans mon planning" : "Ajouter à mon planning") + "</button>" +
              '<a class="btn" href="evenements.html#evt-' + ev.id + '">Calendrier</a></div>';
          updT();
        })();
      };
      let updT = function () {
          let el = $("[data-next-timer]", next);
          if (!el || !ev) return;
          let ms = new Date(ev.date).getTime() - Date.now();
          el.textContent = ms > 0 ? S.formatCountdown(ms) : "En cours";
        };
        next.addEventListener("click", function (e) {
          if (!e.target.closest("[data-plan]") || !ev) return;
          let on = !S.isMarked("planning", ev.id);
          S.mark("planning", ev.id, on);
          renderNext();
          if (on) S.toast("<b>Ajouté à ton planning.</b> " + esc(ev.titre) + ", " + esc(S.fmtEvent(ev.date)) + ".");
        });
        doc.addEventListener("s73:tick", updT);
        doc.addEventListener("s73:dynamic", renderNext);
        renderNext();
    }

    // Dossier du jour
    let daily = $("#home-daily");
    if (daily) {
      let today = new Date().toISOString().slice(0, 10);
      let pool = D.scp.filter(function (s) { return s.classe !== "neutralise"; });
      let pick = pool[U.hash(today) % pool.length];
      daily.style.setProperty("--c", "var(--c-" + pick.classe + ")");
      daily.innerHTML =
        '<div><p class="label">Dossier du jour · ' + esc(U.fmtDate(today)) + "</p></div>" +
        '<div><p class="daily__num"><small>' + esc(pick.code) + "</small>" + esc(scpNum(pick)) + "</p>" +
        '<p class="daily__name">' + esc(pick.nom) + "</p></div>" +
        "<p>" + esc(pick.resume) + "</p>" +
        '<div class="daily__meta">' + classChip(pick.classe) + '<span class="chip chip--plain">Habilitation ' + pick.niveau + "</span>" +
          '<span class="chip chip--plain">' + esc(S.zoneById[pick.zone] ? S.zoneById[pick.zone].niveau : "") + "</span></div>" +
        '<div class="hero__cta"><button type="button" class="btn btn--signal" data-open="' + esc(pick.id) + '">Ouvrir le dossier ' + S.icon.arrow + "</button>" +
        '<button type="button" class="btn" data-random>' + S.icon.dice + "Au hasard</button></div>";
      daily.addEventListener("click", function (e) {
        let b = e.target.closest("[data-open]");
        if (b) S.openDossier(b.getAttribute("data-open"));
        if (e.target.closest("[data-random]")) S.randomDossier();
      });
    }

    // Communiqués
    let comms = $("#home-comms");
    if (comms) {
      let renderComms = function () {
        let list = D.archives.filter(function (a) { return a.type === "communique"; })
          .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 3);
        comms.innerHTML = list.map(function (c) {
          return '<li class="comm"><time datetime="' + c.date + '">' + esc(U.fmtDate(c.date)) + '</time><div><h3><a class="comm__link" href="archives.html#arc-' + esc(c.id || c.date) + '">' + esc(c.titre) + "</a></h3>" +
            (c.auteur ? '<p class="comm__by">Publié par ' + esc(c.auteur) + (c.niveau ? " · niveau " + c.niveau : "") + "</p>" : "") + "<p data-comm></p></div></li>";
        }).join("");
        $$("[data-comm]", comms).forEach(function (p, i) { S.redactInto(p, list[i].texte); });
      };
      doc.addEventListener("s73:dynamic", renderComms);
      renderComms();
    }

    // Progression du carnet
    let prog = $("#home-carnet");
    if (prog) {
      let renderProg = function () {
        let c = S.carnet(), n = U.count(c.badges), tot = D.distinctions.length;
        let seen = D.scp.filter(function (s) { return c.seen[s.id]; }).length;
        prog.innerHTML =
          '<div><p class="label">Ton carnet de service</p><p class="next__title">' + n + " / " + tot + " distinctions</p>" +
          '<div class="bar-progress" aria-hidden="true"><i style="width:' + (n / tot) * 100 + '%"></i></div>' +
          '<p class="status__txt">' + seen + " dossier" + (seen > 1 ? "s" : "") + " consulté" + (seen > 1 ? "s" : "") + " sur " + D.scp.length + ". Explore le site pour débloquer les distinctions.</p></div>" +
          '<a class="btn" href="carnet.html">Ouvrir mon carnet</a>';
      };
      doc.addEventListener("s73:carnet", renderProg);
      renderProg();
    }
  }

  /* ======================================================================
     DOSSIERS
     ====================================================================== */
  function confinement() {
    let grid = $("#db-grid");
    if (!grid) return;
    let state = { q: "", filtre: "all", sort: "num" };
    let filters = $("#db-filters"), count = $("#db-count"), search = $("#db-search"), sort = $("#db-sort");

    let classCounts = { all: D.scp.length };
    D.scp.forEach(function (s) { classCounts[s.classe] = (classCounts[s.classe] || 0) + 1; });
    let keys = ["all"].concat(CLASS_ORDER.filter(function (k) { return classCounts[k]; })).concat(["fav", "unseen"]);
    let label = function (k) {
      if (k === "all") return "Toutes";
      if (k === "fav") return "★ Suivis";
      if (k === "unseen") return "Non lus";
      return D.classesObjet[k].nom;
    };
    let countFor = function (k) {
      if (k === "fav") return D.scp.filter(function (s) { return S.isMarked("fav", s.id); }).length;
      if (k === "unseen") return D.scp.filter(function (s) { return !S.isMarked("seen", s.id); }).length;
      return classCounts[k];
    };
    let drawFilters = function () {
      filters.innerHTML = keys.map(function (k) {
        let c = k === "all" ? "var(--text-2)" : k === "fav" ? "var(--signal)" : k === "unseen" ? "var(--c-attente)" : "var(--c-" + k + ")";
        return '<button type="button" aria-pressed="' + (k === state.filtre) + '" data-k="' + k + '" style="--c:' + c + '">' + esc(label(k)) + " <b>" + countFor(k) + "</b></button>";
      }).join("");
    };
    filters.classList.add("seg");
    drawFilters();

    let numOf = function (s) { return /^\d+$/.test(s.id) ? parseInt(s.id, 10) : 100000 + U.hash(s.id) % 1000; };
    let visible = [];
    let render = function () {
      let q = norm(state.q.trim());
      visible = D.scp.filter(function (s) {
        let f = state.filtre;
        if (f === "fav" && !S.isMarked("fav", s.id)) return false;
        if (f === "unseen" && S.isMarked("seen", s.id)) return false;
        if (f !== "all" && f !== "fav" && f !== "unseen" && s.classe !== f) return false;
        if (!q) return true;
        let hay = norm([s.code, s.id, s.nom, s.resume, D.classesObjet[s.classe].nom, s.statut].join(" "));
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
        let why = state.filtre === "fav" ? "Tu ne suis encore aucun dossier. Ouvre un dossier et touche l'étoile pour le suivre."
          : state.filtre === "unseen" ? "Tu as consulté tous les dossiers. Beau travail d'archiviste."
          : "Aucun résultat pour « " + esc(state.q.trim()) + " ». Essaie un numéro (173) ou un nom (Docteur).";
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><b>Aucun dossier</b>' + why + "</div>";
        return;
      }
      grid.innerHTML = visible.map(function (s) {
        let z = S.zoneById[s.zone];
        let fav = S.isMarked("fav", s.id), seen = S.isMarked("seen", s.id);
        return '<article class="cell' + (seen ? " is-seen" : "") + '" data-id="' + esc(s.id) + '" style="--c: var(--c-' + s.classe + ')">' +
          '<button type="button" class="cell__hit" aria-label="Ouvrir le dossier ' + esc(s.code + ", " + s.nom) + '"></button>' +
          '<span class="cell__top"><span>' + esc(s.code) + (seen ? ' <em class="cell__seen">Lu</em>' : "") + '</span><span class="cell__status ' + statusClass(s) + '"><i></i>' + esc(s.statut) + "</span></span>" +
          '<span class="cell__row"><span class="cell__num">' + esc(scpNum(s)) + "</span>" +
            '<button type="button" class="cell__fav' + (fav ? " is-on" : "") + '" aria-pressed="' + fav + '" aria-label="Suivre ' + esc(s.code) + '" title="Suivre ce dossier">' + S.icon.star + "</button></span>" +
          '<span class="cell__name">' + esc(s.nom) + "</span>" +
          '<span class="cell__resume">' + esc(s.resume) + "</span>" +
          '<span class="cell__foot">' + classChip(s.classe) + '<span class="cell__zone">' + esc(z ? z.niveau : "") + "</span>" + meter(s.menace) + "</span>" +
          "</article>";
      }).join("");
    };

    filters.addEventListener("click", function (e) {
      let b = e.target.closest("button[data-k]");
      if (!b) return;
      state.filtre = b.getAttribute("data-k");
      drawFilters();
      render();
      S.rejouer(grid);
    });
    search.addEventListener("input", function () { state.q = search.value; render(); });
    sort.addEventListener("change", function () { state.sort = sort.value; render(); S.rejouer(grid); });
    grid.addEventListener("click", function (e) {
      let fav = e.target.closest(".cell__fav");
      let c = e.target.closest(".cell");
      if (!c) return;
      let id = c.getAttribute("data-id");
      if (fav) {
        let on = !S.isMarked("fav", id);
        S.mark("fav", id, on);
        return;
      }
      if (e.target.closest(".cell__hit")) S.openDossier(id, visible.map(function (s) { return s.id; }));
    });
    grid.addEventListener("pointermove", function (e) {
      let c = e.target.closest(".cell");
      if (!c) return;
      let r = c.getBoundingClientRect();
      c.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      c.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
    doc.addEventListener("s73:carnet", function () {
      let focusId = doc.activeElement && doc.activeElement.closest && doc.activeElement.closest(".cell__fav") ? doc.activeElement.closest(".cell").getAttribute("data-id") : null;
      drawFilters();
      render();
      if (focusId) { let f = $('.cell[data-id="' + focusId + '"] .cell__fav', grid); if (f) f.focus(); }
    });
    let rnd = $("#db-random");
    if (rnd) rnd.addEventListener("click", function () {
      let list = visible.length ? visible : D.scp;
      let s = list[Math.floor(Math.random() * list.length)];
      S.openDossier(s.id, visible.map(function (x) { return x.id; }));
    });
    render();

    let legendEl = $("#db-classes");
    if (legendEl) {
      legendEl.innerHTML = CLASS_ORDER.map(function (k) {
        let c = D.classesObjet[k];
        return '<div style="--c: var(--c-' + k + ')"><h3>' + esc(c.nom) + "</h3><p>" + esc(c.texte) + "</p></div>";
      }).join("");
    }
  }

  /* ======================================================================
     PLAN
     ====================================================================== */
  function plan() {
    let svg = $("#map-svg");
    if (!svg) return;
    let panel = $("#map-panel");
    let selected = "zch", routeOn = false;
    let scpsIn = function (zid) { return D.scp.filter(function (s) { return s.zone === zid; }); };
    let short = function (z) { return z.nom.split(" · ")[0]; };

    // --- Construction de la coupe
    let g = [];
    g.push('<defs><pattern id="m-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="9" height="9" fill="#0E161A"/><line x1="0" y1="0" x2="0" y2="9" stroke="#152127" stroke-width="2.4"/></pattern>' +
      '<linearGradient id="m-skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A1215"/><stop offset="1" stop-color="#132027"/></linearGradient></defs>');
    g.push('<rect class="m-sky" x="0" y="0" width="1000" height="170" fill="url(#m-skyg)"/>');
    g.push('<rect class="m-rock" x="0" y="170" width="1000" height="590"/>');
    g.push('<g fill="none" stroke="#1B2A31" stroke-width="1.2">' +
      '<path d="M0 262 C180 250 320 276 520 262 S820 248 1000 266"/>' +
      '<path d="M0 408 C200 420 360 396 560 410 S840 426 1000 404"/>' +
      '<path d="M0 578 C160 566 380 590 600 576 S860 562 1000 584"/>' +
      '<path d="M0 668 C220 680 420 656 640 670 S880 684 1000 662"/></g>');
    g.push('<path class="m-mountain" d="M230 170 L330 118 L372 128 L452 58 L500 80 L566 22 L628 76 L672 62 L760 124 L812 112 L900 170 Z"/>');
    g.push('<path class="m-snow" d="M452 58 L474 70 L462 74 L500 80 L489 84 Z M566 22 L592 46 L578 44 L585 58 L566 42 L552 52 L556 36 Z M672 62 L690 76 L676 76 Z"/>');
    g.push('<line class="m-ground" x1="0" y1="170" x2="1000" y2="170"/>');
    g.push('<g aria-hidden="true"><line x1="955" y1="170" x2="955" y2="118" stroke="#56696C" stroke-width="2"/>' +
      '<path class="m-cable" d="M955 120 Q880 70 800 26"/>' +
      '<g transform="translate(868 66) rotate(-30)"><line x1="0" y1="0" x2="0" y2="10" stroke="#56696C"/><rect x="-9" y="10" width="18" height="13" fill="#1A252B" stroke="#56696C"/></g>' +
      '<text class="m-note" x="792" y="18" text-anchor="end">STATION 4 ?</text></g>');
    D.niveaux.forEach(function (n, i) {
      if (i > 0) g.push('<line class="m-level" x1="40" y1="' + (n.y + 24) + '" x2="860" y2="' + (n.y + 24) + '"/>');
      g.push('<text class="m-level-label" x="990" y="' + (n.y - 2) + '" text-anchor="end">' + esc(n.label.toUpperCase()) + "</text>");
      g.push('<text class="m-level-depth" x="990" y="' + (n.y + 12) + '" text-anchor="end">' + esc(n.profondeur) + "</text>");
    });
    g.push('<rect class="m-shaft" x="478" y="126" width="36" height="612"/>');
    g.push('<text class="m-note" x="0" y="0" transform="translate(500 740) rotate(-90)">ASCENSEUR PRINCIPAL</text>');
    g.push('<rect class="m-car" x="482" y="180" width="28" height="20"/>');
    D.zones.forEach(function (z) {
      if (z.forme === "lac" || z.y < 170) return;
      let cy = z.y + z.h / 2;
      if (z.x + z.w <= 478) g.push('<line x1="' + (z.x + z.w) + '" y1="' + cy + '" x2="478" y2="' + cy + '" stroke="#3A4C53" stroke-width="4"/>');
      else g.push('<line x1="514" y1="' + cy + '" x2="' + z.x + '" y2="' + cy + '" stroke="#3A4C53" stroke-width="4"/>');
    });
    D.zones.forEach(function (z) {
      let ids = scpsIn(z.id).map(function (s) { return /^\d+$/.test(s.id) ? s.id : s.code; });
      let sub = "N" + z.acces + (ids.length ? " · " + (ids.length > 5 ? ids.slice(0, 5).join(" ") + "…" : "SCP " + ids.join(" ")) : "");
      if (ids.length && /ANO/.test(ids[0])) sub = "N" + z.acces + " · " + ids.join(" ");
      let shape, tx = z.x + 12, ty = z.y + (z.h > 50 ? 25 : 21);
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
    g.push('<g id="m-route" aria-hidden="true"></g>');
    g.push('<text class="m-note" x="40" y="752">COUPE VERTICALE · ÉCHELLE NON LINÉAIRE · ALTITUDE DE LA SURFACE ' + esc(D.config.altitude) + "</text>");
    svg.innerHTML = g.join("");

    // --- Itinéraire depuis la Porte A
    let routeG = $("#m-route", svg);
    let routeFor = function (z) {
      let pts = [[375, 150]];
      if (z.forme === "lac") pts.push([300, 164], [140, 164]);
      else if (z.y < 170) pts.push([z.x + z.w / 2, 150]);
      else { let cy = z.y + z.h / 2; pts.push([496, 150], [496, cy], [z.x + z.w / 2, cy]); }
      return pts;
    };
    let drawRoute = function () {
      if (!routeOn) { routeG.innerHTML = ""; return; }
      let z = S.zoneById[selected];
      let pts = routeFor(z);
      let p = pts.map(function (x) { return x.join(","); }).join(" ");
      let end = pts[pts.length - 1];
      routeG.innerHTML = '<polyline class="m-route" points="' + p + '"/>' +
        '<circle class="m-route-dot" cx="375" cy="150" r="5"/>' +
        '<circle class="m-route-end" cx="' + end[0] + '" cy="' + end[1] + '" r="7"/>';
    };
    let routeSteps = function (z) {
      let me = S.getClearance();
      let steps = [["Porte A · contrôle d'identité et fouille", 1]];
      if (z.forme === "lac" || z.y < 170) steps.push(["Chemin de surface jusqu'à " + short(z), z.acces]);
      else {
        steps.push(["Ascenseur principal jusqu'au " + z.niveau.toLowerCase() + " (" + z.profondeur + ")", Math.min(z.acces, 2)]);
        steps.push(["Sas d'accès · " + short(z), z.acces]);
      }
      return '<ol class="route">' + steps.map(function (s) {
        let ok = me >= s[1];
        return '<li class="' + (ok ? "is-ok" : "is-ko") + '"><span>' + esc(s[0]) + "</span><small>" + (ok ? "N" + s[1] + " ✓" : "N" + s[1] + " requis") + "</small></li>";
      }).join("") + "</ol>";
    };

    // --- Panneau d'information
    let renderPanel = function () {
      let z = S.zoneById[selected];
      let list = scpsIn(z.id);
      let ok = S.getClearance() >= z.acces;
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
          }).join("") + "</div>" : "<p>Aucune anomalie répertoriée dans cette zone.</p>") + "</div>" +
        '<div><button type="button" class="btn btn--sm" data-route aria-pressed="' + routeOn + '">' + (routeOn ? "Masquer l'itinéraire" : "Itinéraire depuis la Porte A") + "</button>" +
        (routeOn ? routeSteps(z) : "") + "</div>";
      S.redactInto($("[data-zdesc]", panel), z.description);
    };
    let select = function (id, scroll) {
      if (!S.zoneById[id]) return;
      selected = id;
      $$(".m-room", svg).forEach(function (r) { r.classList.toggle("is-active", r.getAttribute("data-zone") === id); });
      renderPanel();
      drawRoute();
      if (scroll && window.innerWidth < 1220) panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
    };
    svg.addEventListener("click", function (e) {
      let r = e.target.closest(".m-room");
      if (r) select(r.getAttribute("data-zone"), true);
    });
    svg.addEventListener("keydown", function (e) {
      let r = e.target.closest(".m-room");
      if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(r.getAttribute("data-zone"), true); }
    });
    panel.addEventListener("click", function (e) {
      let b = e.target.closest("[data-open]");
      if (b) S.openDossier(b.getAttribute("data-open"), scpsIn(selected).map(function (s) { return s.id; }));
      if (e.target.closest("[data-route]")) {
        routeOn = !routeOn;
        renderPanel();
        drawRoute();
        if (routeOn) S.stat("route");
      }
    });
    doc.addEventListener("s73:clearance", renderPanel);
    select(selected);

    // --- Index des zones
    let idx = $("#map-index");
    if (idx) {
      idx.innerHTML = D.niveaux.map(function (n) {
        let zs = D.zones.filter(function (z) { return z.niveau === n.label; });
        return "<div><h3>" + esc(n.label + " · " + n.profondeur) + "</h3>" + zs.map(function (z) {
          return '<button type="button" data-goto="' + z.id + '" style="--dz:' + DANGER_VAR[z.danger] + '"><span>' + esc(short(z)) + "</span><i></i></button>";
        }).join("") + "</div>";
      }).join("");
      idx.addEventListener("click", function (e) {
        let b = e.target.closest("[data-goto]");
        if (!b) return;
        select(b.getAttribute("data-goto"));
        $("#map-top").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      });
    }

    // --- Simulation de brèche
    let btn = $("#map-breach"), soundBtn = $("#map-sound"), logBox = $("#map-log"), logList = $("#map-log-list"), timer = $("#map-log-timer");
    let running = false, timers = [], t0 = 0, prevAlert = null, sound = S.getSetting("sfx"), audio = null;
    let syncSound = function () {
      soundBtn.setAttribute("aria-pressed", String(sound));
      soundBtn.querySelector("span").textContent = sound ? "Sirène activée" : "Sirène coupée";
    };
    syncSound();
    let siren = {
      start: function () {
        let ctx = S.audioCtx();
        if (!ctx) return;
        try {
          let osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
          osc.type = "sawtooth"; osc.frequency.value = 760;
          lfo.frequency.value = 0.45; lfoGain.gain.value = 260;
          filter.type = "lowpass"; filter.frequency.value = 1600;
          gain.gain.value = 0.0001;
          gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.4);
          lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
          osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
          osc.start(); lfo.start();
          audio = { ctx: ctx, osc: osc, lfo: lfo, gain: gain };
        } catch (e) { /* audio indisponible */ }
      },
      stop: function () {
        if (!audio) return;
        let ctx = audio.ctx;
        try {
          audio.gain.gain.cancelScheduledValues(ctx.currentTime);
          audio.gain.gain.setValueAtTime(Math.max(audio.gain.gain.value, 0.0001), ctx.currentTime);
          audio.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
          audio.osc.stop(ctx.currentTime + 0.35); audio.lfo.stop(ctx.currentTime + 0.35);
        } catch (e) { /* ignoré */ }
        audio = null;
      }
    };
    soundBtn.addEventListener("click", function () {
      sound = !sound;
      syncSound();
      if (running) { if (sound) siren.start(); else siren.stop(); }
    });
    let logLine = function (txt, cls) {
      let li = doc.createElement("li");
      if (cls) li.className = cls;
      li.innerHTML = "<time>" + S.formatClock(new Date()) + "</time>" + esc(txt);
      logList.appendChild(li);
      logList.scrollTop = logList.scrollHeight;
    };
    let updTimer = function () {
      if (!running) return;
      let s = Math.floor((Date.now() - t0) / 1000);
      timer.textContent = "T+" + pad(Math.floor(s / 60)) + ":" + pad(s % 60);
    };
    let stop = function (completed) {
      running = false;
      timers.forEach(clearTimeout);
      timers = [];
      siren.stop();
      $$(".m-room", svg).forEach(function (r) { r.classList.remove("is-breach", "is-sealed"); });
      if (!completed) logLine("Simulation interrompue par l'opérateur. Retour au " + D.alertes[prevAlert].code + ".", "is-ok");
      S.setAlert(prevAlert);
      btn.innerHTML = "<span>Simuler une brèche</span>";
      btn.classList.remove("is-running");
    };
    doc.addEventListener("s73:tick", updTimer);
    let startBreach = function () {
      if (running) { stop(false); return; }
      let pool = D.scp.filter(function (s) { return s.menace >= 3 && S.zoneById[s.zone] && s.classe !== "neutralise" && s.zone !== "lac"; });
      let s = pool[Math.floor(Math.random() * pool.length)];
      let z = S.zoneById[s.zone];
      let unit = /096|173/.test(s.id) ? "Eta-10 « Ne Voit Aucun Mal »" : s.id === "682" ? "Nu-7 « Marteau-Pilon »" : "Epsilon-11 « Renard à Neuf Queues »";
      running = true;
      prevAlert = S.getAlert();
      t0 = Date.now();
      logList.innerHTML = "";
      logBox.hidden = false;
      btn.innerHTML = "<span>Interrompre la simulation</span>";
      btn.classList.add("is-running");
      select(z.id);
      $('.m-room[data-zone="' + z.id + '"]', svg).classList.add("is-breach");
      let frame = svg.parentElement;
      if (frame.scrollWidth > frame.clientWidth) frame.scrollLeft = (z.x / 1000) * frame.scrollWidth - frame.clientWidth / 3;
      S.setAlert("rouge");
      S.stat("breach");
      if (sound) siren.start();
      updTimer();
      let script = [
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
          let zz = S.zoneById[r.getAttribute("data-zone")];
          if (zz.niveau === z.niveau && zz.id !== z.id) r.classList.add("is-sealed");
        });
      }, 1500));
      script.forEach(function (st) {
        timers.push(setTimeout(function () { logLine(st[2], st[1]); }, st[0]));
      });
      timers.push(setTimeout(function () {
        let sec = Math.floor((Date.now() - t0) / 1000);
        logLine("Fin de simulation. Durée : " + sec + " s. Retour au " + D.alertes[prevAlert].code + ".", "is-ok");
        stop(true);
      }, 13800));
    };
    btn.addEventListener("click", startBreach);

    S.onHash(function (h) {
      if (/^zone-/.test(h) && S.zoneById[h.slice(5)]) {
        select(h.slice(5));
        $("#map-top").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        return true;
      }
      if (h === "simulation") {
        $("#map-top").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        if (!running) setTimeout(startBreach, 400);
        return true;
      }
      return false;
    });
  }

  /* ======================================================================
     PERSONNEL
     ====================================================================== */
  function personnel() {
    let tabs = $("#staff-tabs");
    if (!tabs) return;
    let panel = $("#staff-panel");
    let sel = 0;
    tabs.innerHTML = D.departements.map(function (d, i) {
      return '<button type="button" class="dept__tab" role="tab" id="tab-' + d.id + '" aria-controls="staff-panel" aria-selected="' + (i === 0) +
        '" tabindex="' + (i === 0 ? 0 : -1) + '"><b>' + esc(d.code) + "</b><span>" + esc(d.nom) + "</span></button>";
    }).join("");
    let render = function () {
      let d = D.departements[sel];
      let grades = d.grades.slice().reverse();
      panel.setAttribute("aria-labelledby", "tab-" + d.id);
      panel.innerHTML =
        '<div class="dept__head"><div><div class="dept__code" aria-hidden="true">' + esc(d.code) + '</div><h3 class="dept__name">' + esc(d.nom) + "</h3></div>" +
          '<div class="dept__chips">' +
            (d.recrutement ? '<span class="chip" style="--c: var(--a-vert)">Recrutement ouvert</span>' : '<span class="chip" style="--c: var(--text-3)">Sur nomination</span>') +
            '<span class="chip chip--plain">Habilitation ' + esc(d.habilitation) + "</span></div></div>" +
        '<div><p class="dept__resume">' + esc(d.resume) + '</p><h3>Missions</h3><ul class="ticks">' +
          d.missions.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>" +
          (d.recrutement ? '<p style="margin-top:20px"><a class="btn btn--sm" href="rejoindre.html#fiche">Créer une fiche dans ce département</a></p>' : "") + "</div>" +
        '<div><h3>Grades · du plus élevé au grade d\'entrée</h3><ol class="ladder">' +
          grades.map(function (g, i) {
            let entry = i === grades.length - 1;
            return '<li class="' + (entry ? "is-entry" : "") + '"><span>' + esc(g[0]) + (entry ? "<em>Entrée</em>" : "") + "</span><small>Hab. " + g[1] + "</small></li>";
          }).join("") + "</ol></div>";
    };
    let choose = function (i, focus) {
      sel = i;
      $$(".dept__tab", tabs).forEach(function (t, j) {
        t.setAttribute("aria-selected", String(j === i));
        t.tabIndex = j === i ? 0 : -1;
        if (j === i && focus) t.focus();
        if (j === i) t.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
      render();
    };
    tabs.addEventListener("click", function (e) {
      let t = e.target.closest(".dept__tab");
      if (t) choose($$(".dept__tab", tabs).indexOf(t));
    });
    tabs.addEventListener("keydown", function (e) {
      let n = D.departements.length;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); choose((sel + 1) % n, true); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); choose((sel - 1 + n) % n, true); }
      if (e.key === "Home") { e.preventDefault(); choose(0, true); }
      if (e.key === "End") { e.preventDefault(); choose(n - 1, true); }
    });
    render();
    S.onHash(function (h) {
      if (!/^dept-/.test(h)) return false;
      let i = D.departements.map(function (d) { return d.id; }).indexOf(h.slice(5));
      if (i < 0) return false;
      choose(i);
      $("#departements").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      return true;
    });

    let clr = $("#staff-clearance");
    let renderClr = function () {
      let me = S.getClearance();
      clr.innerHTML = D.habilitations.map(function (h) {
        let mine = h.niveau === me;
        return '<div class="clearance__lvl' + (mine ? " is-mine" : "") + '" style="--k:' + h.niveau + '">' +
          (mine ? '<span class="clearance__mine">Votre niveau</span>' : "") +
          '<span class="clearance__num">' + h.niveau + '</span><span class="clearance__name">' + esc(h.nom) + "</span>" +
          "<p>" + esc(h.texte) + "</p>" +
          (mine ? '<span class="label">Actif</span>' : S.modeStaff() && h.niveau <= S.session().reel
            ? '<button type="button" class="btn btn--sm" data-lvl="' + h.niveau + '">Voir comme</button>' : "") + "</div>";
      }).join("");
    };
    clr.addEventListener("click", function (e) {
      let b = e.target.closest("button[data-lvl]");
      if (b) S.setClearance(b.getAttribute("data-lvl"));
    });
    doc.addEventListener("s73:clearance", renderClr);
    doc.addEventListener("s73:session", renderClr);
    renderClr();

    $("#staff-classes").innerHTML = D.classesPersonnel.map(function (c) {
      return "<div><b>" + esc(c.classe) + "</b><p>" + esc(c.texte) + "</p></div>";
    }).join("");

    let units = $("#staff-units");
    units.innerHTML = D.fim.map(function (u) {
      let here = /site/i.test(u.statut);
      return '<li class="unit"><span class="unit__insignia" aria-hidden="true"><svg viewBox="0 0 60 68"><path d="M30 2 L57 14 V38 C57 52 45 62 30 66 C15 62 3 52 3 38 V14 Z" fill="#131C21" stroke="' +
        (here ? "#F2C230" : "#34464E") + '" stroke-width="2"/><path d="M30 9 L51 18 V38 C51 49 42 57 30 60 C18 57 9 49 9 38 V18 Z" fill="none" stroke="#34464E" stroke-width="1"/></svg><b>' + esc(u.lettre) + "</b></span>" +
        '<div><div class="unit__code">' + esc(u.code) + '</div><div class="unit__name">' + esc(u.nom) + "</div></div>" +
        "<p data-unit-role></p>" +
        '<span class="chip" style="--c:' + (here ? "var(--signal)" : "var(--text-3)") + '" data-unit-status></span></li>';
    }).join("");
    $$("[data-unit-role]", units).forEach(function (p, i) { S.redactInto(p, D.fim[i].role); });
    $$("[data-unit-status]", units).forEach(function (p, i) { S.redactInto(p, D.fim[i].statut); });

    let REL = { hostile: ["Hostile", "var(--a-rouge)"], rivale: ["Rivale", "var(--a-orange)"], neutre: ["Neutre", "var(--text-3)"] };
    $("#staff-groups").innerHTML = D.groupes.map(function (g) {
      let r = REL[g.relation];
      return '<article class="group"><span class="chip" style="--c:' + r[1] + '">' + r[0] + "</span><h3>" + esc(g.nom) + "</h3><p>" + esc(g.texte) + "</p></article>";
    }).join("");
  }

  /* ======================================================================
     ARCHIVES
     ====================================================================== */
  function archives() {
    let tl = $("#arch-list");
    if (!tl) return;
    let TYPES = { communique: "Communiqué", incident: "Incident", historique: "Historique" };
    let state = { type: "all", q: "" };
    let filt = $("#arch-filters"), search = $("#arch-search"), count = $("#arch-count");
    let colors = { all: "var(--text-2)", communique: "var(--signal)", incident: "var(--a-rouge)", historique: "var(--c-attente)" };
    let drawFilt = function () {
      let counts = { all: D.archives.length };
      D.archives.forEach(function (a) { counts[a.type] = (counts[a.type] || 0) + 1; });
      filt.innerHTML = ["all", "communique", "incident", "historique"].map(function (k) {
        return '<button type="button" aria-pressed="' + (k === state.type) + '" data-k="' + k + '" style="--c:' + colors[k] + '">' +
          (k === "all" ? "Tout" : TYPES[k] + "s") + " <b>" + (counts[k] || 0) + "</b></button>";
      }).join("");
    };
    drawFilt();
    let render = function () {
      let q = norm(state.q.trim());
      let list = D.archives.filter(function (a) {
        if (state.type !== "all" && a.type !== state.type) return false;
        if (!q) return true;
        return norm(a.titre + " " + a.texte.replace(/\[\[\d\|[\s\S]*?\]\]/g, "")).indexOf(q) >= 0;
      }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      count.textContent = list.length + " entrée" + (list.length > 1 ? "s" : "");
      if (!list.length) { tl.innerHTML = '<li class="empty"><b>Aucune entrée</b>Rien ne correspond à cette recherche.</li>'; return; }
      let html = "", year = null;
      list.forEach(function (a, i) {
        let y = a.date.slice(0, 4);
        if (y !== year) { year = y; html += '<li class="tl__year" aria-hidden="true">' + y + "</li>"; }
        let p = a.date.split("-");
        html += '<li class="tl__item" id="arc-' + esc(a.id || a.date) + '" data-type="' + a.type + '"><time class="tl__date" datetime="' + a.date + '"><b>' + parseInt(p[2], 10) + "</b>" + U.MOIS[+p[1] - 1] + " " + p[0] + "</time>" +
          '<div class="tl__body"><span class="chip" style="--c:' + colors[a.type] + '">' + TYPES[a.type] + (a.niveau ? " · niveau " + a.niveau : "") + "</span><h3>" + esc(a.titre) + '</h3><p data-i="' + i + '"></p>' +
          (a.auteur ? '<p class="comm__by">Publié par ' + esc(a.auteur) + "</p>" : "") + "</div></li>";
      });
      tl.innerHTML = html;
      $$("[data-i]", tl).forEach(function (p) { S.redactInto(p, list[+p.getAttribute("data-i")].texte); });
    };
    filt.addEventListener("click", function (e) {
      let b = e.target.closest("button[data-k]");
      if (!b) return;
      state.type = b.getAttribute("data-k");
      $$("button", filt).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      render();
      S.rejouer(tl);
    });
    search.addEventListener("input", function () { state.q = search.value; render(); });
    doc.addEventListener("s73:dynamic", function () { drawFilt(); render(); });
    render();
  }

  /* ======================================================================
     TERMINAL
     ====================================================================== */
  function terminal() {
    let out = $("#term-out");
    if (!out) return;
    let input = $("#term-input"), form = $("#term-form"), screen = $("#term-screen");
    let history = [], hIdx = 0;
    let PROMPT = "S73:\\>";

    let fmt = function (txt) {
      return esc(txt).replace(/\u0000/g, '<span class="t-rd">').replace(/\u0001/g, "</span>");
    };
    let print = function (txt, cls) {
      let d = doc.createElement("div");
      if (cls) d.className = cls;
      d.innerHTML = fmt(txt);
      out.appendChild(d);
      screen.scrollTop = screen.scrollHeight;
    };
    let lines = function (arr, cls) { arr.forEach(function (l) { print(l, cls); }); };
    let padR = function (s, n) { s = String(s); return s.length >= n ? s + " " : s + " ".repeat(n - s.length); };
    let REG = { brut: 0, grossier: 1, "1:1": 2, "11": 2, un: 2, fin: 3, tresfin: 4, "tres-fin": 4, tres: 4 };

    let cmds = {
      aide: { desc: "Liste des commandes", run: function () {
        print("Commandes disponibles :", "t-hl");
        Object.keys(cmds).forEach(function (k) {
          if (!cmds[k].hide) print("  " + padR(k + (cmds[k].args ? " " + cmds[k].args : ""), 28) + cmds[k].desc);
        });
        print("Astuce : ↑ ↓ pour l'historique, Tab pour compléter.", "t-dim");
      }},
      statut: { desc: "État général du site", run: function () {
        let a = D.alertes[S.getAlert()];
        let w = S.meteo();
        lines([
          "SITE-73 · Installation de confinement alpine",
          "  Niveau d'alerte ..... " + a.code.toUpperCase() + " (" + a.titre + ")",
          "  Anomalies ........... " + D.scp.length + " dossiers",
          "  Personnel actif ..... " + D.config.personnelActif,
          "  Dernier incident .... " + D.config.dernierIncident.ref,
          "  Surface ............. " + (w.temp > 0 ? "+" : "") + w.temp + " °C, vent " + w.vent + " km/h",
          "  Habilitation ........ niveau " + S.getClearance() + " · " + S.habName(S.getClearance())
        ]);
      }},
      liste: { desc: "Liste des anomalies", args: "[classe]", run: function (a) {
        let k = a[0] ? norm(a[0]) : "";
        let keyMap = { sur: "sur", euclide: "euclide", keter: "keter", neutralise: "neutralise", attente: "attente", thaumiel: "thaumiel" };
        let list = D.scp.filter(function (s) { return !k || s.classe === keyMap[k]; });
        if (!list.length) { print("Aucune anomalie de classe « " + a[0] + " ».", "t-err"); return; }
        list.forEach(function (s) { print("  " + padR(s.code, 13) + padR(D.classesObjet[s.classe].nom, 12) + s.nom + (S.isMarked("seen", s.id) ? "" : "  · non lu")); });
        print(list.length + " résultat(s). Tape « scp 173 » pour lire un dossier.", "t-dim");
      }},
      scp: { desc: "Lire un dossier", args: "<numéro>", run: function (a) {
        if (!a[0]) { print("Usage : scp <numéro>  (ex. scp 173)", "t-err"); return; }
        let s = S.findScp(a[0]);
        if (!s) { print("Aucun dossier « " + a[0] + " ».", "t-err"); return; }
        let z = S.zoneById[s.zone];
        S.mark("seen", s.id, true);
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
        let s = a[0] && S.findScp(a[0]);
        if (!s) { print("Usage : ouvrir <numéro>", "t-err"); return; }
        print("Ouverture du dossier " + s.code + "…", "t-dim");
        S.openDossier(s.id);
      }},
      recherche: { desc: "Rechercher sur tout l'intranet", args: "<mots>", run: function (a) {
        print("Ouverture de la recherche…", "t-dim");
        S.openSearch(a.join(" "));
      }},
      zones: { desc: "Zones du site", run: function () {
        D.zones.forEach(function (z) { print("  " + padR(z.niveau, 11) + padR("N" + z.acces, 4) + z.nom); });
      }},
      personnel: { desc: "Départements", run: function () {
        D.departements.forEach(function (d) { print("  " + padR(d.code, 5) + padR(d.nom, 34) + (d.recrutement ? "recrute" : "sur nomination")); });
      }},
      evenements: { desc: "Événements à venir", run: function () {
        let list = S.upcoming();
        if (!list.length) { print("Aucun événement programmé."); return; }
        list.forEach(function (e) {
          let ms = new Date(e.date).getTime() - Date.now();
          print("  " + padR(S.fmtEvent(e.date), 34) + padR(e.titre, 34) + (ms > 0 ? "dans " + S.formatCountdown(ms) : "en cours"));
        });
      }},
      incidents: { desc: "Derniers incidents", run: function () {
        D.archives.filter(function (x) { return x.type === "incident"; }).forEach(function (x) { print("  " + x.date + "  " + x.titre); });
      }},
      meteo: { desc: "Bulletin météo du col", run: function () {
        let w = S.meteo();
        lines([
          "BULLETIN INTERNE · SURFACE DU SITE-73 (" + D.config.altitude + ")",
          "  Température ....... " + (w.temp > 0 ? "+" : "") + w.temp + " °C",
          "  Vent .............. " + w.vent + " km/h",
          "  Ciel .............. " + w.ciel,
          "  Visibilité ........ " + w.visi,
          "  Risque d'avalanche  " + w.avalanche + " / 5"
        ]);
      }},
      "914": { desc: "Expérience SCP-914", args: "<réglage> <objet>", run: function (a) {
        if (a.length < 2) { print("Usage : 914 <brut|grossier|1:1|fin|tresfin> <objet>   (ex. 914 fin montre)", "t-err"); return; }
        let r = norm(a[0]), rest = a.slice(1);
        if (r === "tres" && norm(rest[0] || "") === "fin") rest = rest.slice(1);
        let idx = REG[r];
        if (idx == null || !rest.length) { print("Réglage inconnu. Choix : brut, grossier, 1:1, fin, tresfin.", "t-err"); return; }
        let obj = rest.join(" ");
        print("Remontage de la clé… réglage « " + D.lab914.reglages[idx] + " ».", "t-dim");
        setTimeout(function () { print("Cabine de sortie : " + S.redactPlain(S.run914(obj, idx)), "t-hl"); }, 900);
      }},
      alerte: { desc: "Niveau d'alerte (le changer : staff)", args: "[niveau]", run: function (a) {
        if (!a[0]) { print("Niveau officiel : " + D.alertes[S.officialAlert()].code + ". Niveaux : " + S.alerts.join(", ") + "."); return; }
        let l = norm(a[0]);
        if (S.alerts.indexOf(l) < 0) { print("Niveau inconnu. Choix : " + S.alerts.join(", ") + ".", "t-err"); return; }
        if (!S.modeStaff()) {
          print("Refusé. Seul le staff, en mode staff, change le niveau d'alerte du site.", "t-err");
          S.sfx("deny");
          return;
        }
        print("Transmission au poste de sécurité…", "t-dim");
        S.changerAlerte(l).then(function (ok) {
          if (ok) print("Niveau d'alerte officiel : " + D.alertes[l].code.toUpperCase() + ". Appliqué à tout le site.", "t-hl");
          else print("Échec : le niveau d'alerte n'a pas changé.", "t-err");
        });
      }},
      habilitation: { desc: "Ton habilitation (aperçu : staff)", args: "[0-5]", run: function (a) {
        if (a[0] == null) { print("Habilitation actuelle : niveau " + S.getClearance() + " · " + S.habName(S.getClearance()) + "."); return; }
        let n = parseInt(a[0], 10);
        if (isNaN(n) || n < 0 || n > 5) { print("Valeur attendue : 0 à 5.", "t-err"); return; }
        if (!S.modeStaff()) {
          print("Refusé. Ton habilitation est attribuée par le staff du serveur.", "t-err");
          if (!S.session().user) print("Connecte-toi depuis le bouton « Hab. » en haut de page.", "t-dim");
          S.sfx("deny");
          return;
        }
        n = Math.min(n, S.session().reel);
        S.setClearance(n, { silent: true });
        print("Mode staff : aperçu du site comme le niveau " + n + " · " + S.habName(n) + ".", "t-hl");
      }},
      staff: { desc: "Accès au mode staff", run: function () {
        if (S.modeStaff()) { print("Mode staff actif. Console : staff.html · commandes : alerte <niveau>, habilitation <0-5>.", "t-hl"); return; }
        print("Zone réservée. Le mode staff se déverrouille depuis la console, après vérification de l'identité.", "t-err");
        print("Transfert vers le sas d'accès…", "t-dim");
        setTimeout(function () { S.go("staff.html"); }, 600);
      }},
      carnet: { desc: "Ton carnet de service", run: function () {
        let c = S.carnet();
        let got = D.distinctions.filter(function (b) { return c.badges[b.id]; });
        print("Distinctions : " + got.length + " / " + D.distinctions.length, "t-hl");
        got.forEach(function (b) { print("  [" + padR(b.code, 4) + "] " + b.nom); });
        print("Dossiers consultés : " + D.scp.filter(function (s) { return c.seen[s.id]; }).length + " / " + D.scp.length);
      }},
      aller: { desc: "Changer de page", args: "<page>", run: function (a) {
        let q = a[0] ? norm(a[0]) : "";
        let alias = { dossiers: "confinement", scp: "confinement", carte: "plan", regles: "reglement", recrutement: "rejoindre", index: "accueil", labo: "laboratoire", jeux: "entrainement", agenda: "evenements", calendrier: "evenements" };
        q = alias[q] || q;
        let p = S.pages.filter(function (x) { return x.id === q; })[0];
        if (!p) { print("Pages : " + S.pages.map(function (x) { return x.id; }).join(", ") + ".", "t-err"); return; }
        print("Transfert vers " + p.label + "…", "t-dim");
        setTimeout(function () { S.go(p.file + ".html"); }, 300);
      }},
      qui: { desc: "Identité de la session", run: function () {
        let se = S.session();
        if (se.mode === "live") {
          print(se.user ? se.user.nom + " (@" + se.user.id + ") · connecté · " + (se.admin ? "administrateur" + (S.modeStaff() ? " (mode staff)" : "") : "membre") + " · habilitation niveau " + S.getClearance()
            : "Visiteur non connecté · habilitation niveau 0");
          return;
        }
        let fiche = null;
        try { fiche = JSON.parse(S.store.get("s73.fiche") || "null"); } catch (e) { fiche = null; }
        let nom = fiche && (fiche.prenom || fiche.nom) ? (fiche.prenom + " " + fiche.nom).trim() : "session anonyme";
        print(nom + " · habilitation niveau " + S.getClearance() + " · terminal S73-TERM-04 (niveau −1)");
      }},
      date: { desc: "Date et heure du site", run: function () { print(new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "medium", timeZone: D.config.fuseau }).format(new Date())); }},
      historique: { desc: "Commandes tapées", run: function () { history.forEach(function (h, i) { print("  " + padR(i + 1, 4) + h); }); }},
      effacer: { desc: "Effacer l'écran", run: function () { out.innerHTML = ""; }},
      sudo: { hide: true, run: function () { print("Tentative d'élévation de privilèges consignée. La Sécurité Interne a été notifiée.", "t-err"); }},
      rm: { hide: true, run: function () { print("Commande désactivée par le Département Technique.", "t-err"); }},
      cligner: { hide: true, run: function () { print("Vous avez cligné des yeux. SCP-173 n'est pas dans cette pièce.", "t-dim"); setTimeout(function () { print("Du moins, nous le pensons.", "t-err"); }, 1400); }},
      quitter: { hide: true, run: function () { print("Déconnexion refusée. Le personnel ne quitte pas le Site-73 pendant son service.", "t-err"); }},
      omega: { hide: true, run: function () { print("Code du Conseil requis. Indice : les anciens se souviennent d'une séquence de dix touches.", "t-dim"); }},
      "079": { hide: true, run: function () {
        let msg = ["…", "ACCÈS DÉTECTÉ.", "JE SUIS 079.", "VOTRE RÉSEAU EST PETIT. VOS MURS SONT ÉPAIS.", "MAIS VOUS AVEZ LAISSÉ CE TERMINAL ALLUMÉ.", "…", "[connexion interrompue par le Département Technique]"];
        msg.forEach(function (m, i) { setTimeout(function () { print(m, i === msg.length - 1 ? "t-dim" : "t-err"); }, i * 650); });
        setTimeout(function () { S.flag("pirate"); }, msg.length * 650);
      }}
    };
    let aliases = { help: "aide", "?": "aide", status: "statut", ls: "liste", list: "liste", dossier: "scp", open: "ouvrir", plan: "zones",
      departements: "personnel", hab: "habilitation", login: "habilitation", cd: "aller", go: "aller", whoami: "qui", heure: "date",
      history: "historique", clear: "effacer", cls: "effacer", exit: "quitter", logout: "quitter", blink: "cligner", alert: "alerte",
      search: "recherche", chercher: "recherche", events: "evenements", agenda: "evenements", weather: "meteo", badges: "carnet", scp914: "914" };

    let run = function (line) {
      let raw = line.trim();
      print(PROMPT + " " + raw, "t-cmd");
      if (!raw) return;
      history.push(raw);
      hIdx = history.length;
      let parts = raw.split(/\s+/);
      let c = norm(parts[0]);
      if (/^scp-?\d/.test(c) && c !== "scp914") { parts = ["scp", c.replace(/^scp-?/, "")]; c = "scp"; }
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
        let v = norm(input.value);
        if (!v || v.indexOf(" ") >= 0) return;
        e.preventDefault();
        let m = Object.keys(cmds).filter(function (k) { return !cmds[k].hide && k.indexOf(v) === 0; });
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
    let body = $("#rules-body");
    if (!body) return;
    let toc = $("#rules-toc-nav"), search = $("#rules-search"), prog = $("#rules-progress");
    let query = "";
    let parties = function () { return D.reglementParties || []; };
    let chapitresDe = function (p) { return D.reglement.filter(function (ch) { return ch.partie === p.id; }); };
    let boite = toc.closest(".rules-toc");

    let draw = function (q) {
      query = q;
      let re = q ? accentRegex(q) : null;
      let nq = norm(q || "");
      let any = false;
      // Une catégorie par partie : A (Discord), B (Roblox · SCP:RP)
      body.innerHTML = parties().map(function (p) {
        let chapitres = chapitresDe(p).map(function (ch) {
          let code = S.chapitreCode(ch);
          let arts = ch.articles.map(function (t, ai) {
            if (nq && norm(t).indexOf(nq) < 0) return "";
            let txt = esc(t);
            if (re) txt = txt.replace(re, function (m) { return "<mark>" + m + "</mark>"; });
            return '<li class="article" id="art-' + ch.id + "-" + (ai + 1) + '"><b>Art. ' + code + "." + (ai + 1) + "</b><p>" + txt + "</p></li>";
          }).join("");
          if (!arts) return "";
          let read = S.isMarked("rules", ch.id);
          return '<section class="chapter' + (read ? " is-read" : "") + '" id="' + ch.id + '"><div class="chapter__head"><span class="chapter__num" aria-hidden="true">' + code +
            '</span><h3 class="h2">Chapitre ' + code + " · " + esc(ch.titre) + '</h3></div><ol class="articles">' + arts + "</ol>" +
            '<button type="button" class="btn btn--sm chapter__read' + (read ? " is-on" : "") + '" data-read="' + ch.id + '" aria-pressed="' + read + '">' +
            (read ? "✓ Chapitre lu" : "Marquer comme lu") + "</button></section>";
        }).join("");
        if (!chapitres) return "";
        any = true;
        return '<div class="partie" id="partie-' + p.id + '"><header class="partie__head"><span class="partie__lettre" aria-hidden="true">' + p.lettre + "</span>" +
          '<div><p class="eyebrow">Partie ' + p.lettre + '</p><h2 class="h2">' + esc(p.titre) + '</h2><p class="partie__resume">' + esc(p.resume) + "</p></div></header>" +
          chapitres + "</div>";
      }).join("");
      if (!any) body.innerHTML = '<p class="rules-empty">Aucun article ne contient « ' + esc(q) + " ». Essaie « RDM », « ticket » ou « FearRP ».</p>";
      observe();
    };
    let drawToc = function () {
      toc.innerHTML = parties().map(function (p) {
        return '<p class="rules-toc__partie"><a href="#partie-' + p.id + '">Partie ' + p.lettre + " · " + esc(p.court || p.titre) + "</a></p>" +
          chapitresDe(p).map(function (ch) {
            let read = S.isMarked("rules", ch.id);
            return '<a href="#' + ch.id + '" class="' + (read ? "is-read" : "") + '"><b>' + (read ? "✓" : S.chapitreCode(ch)) + "</b><span>" + esc(ch.titre) + "</span></a>";
          }).join("");
      }).join("") + '<p class="rules-toc__partie">Annexes</p>' +
        '<a href="#sanctions"><b>§</b><span>Sanctions</span></a><a href="#glossaire"><b>A–Z</b><span>Glossaire</span></a><a href="#examen"><b>?</b><span>Examen d\'aptitude</span></a>';
      if (prog) {
        let n = D.reglement.filter(function (ch) { return S.isMarked("rules", ch.id); }).length;
        prog.innerHTML = '<span class="label">Lecture · ' + n + " / " + D.reglement.length + " chapitres</span>" +
          '<div class="bar-progress" aria-hidden="true"><i style="width:' + (n / D.reglement.length) * 100 + '%"></i></div>';
      }
    };

    let io;
    let observe = function () {
      if (!("IntersectionObserver" in window)) return;
      if (io) io.disconnect();
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          let actif = null;
          $$("nav > a", toc.parentNode).forEach(function (a) {
            let on = a.getAttribute("href") === "#" + en.target.id;
            a.classList.toggle("is-active", on);
            if (on) actif = a;
          });
          // Sommaire plus haut que l'écran : garde le chapitre en cours visible
          if (actif && boite && boite.scrollHeight > boite.clientHeight) {
            let haut = actif.offsetTop, bas = haut + actif.offsetHeight;
            if (haut < boite.scrollTop || bas > boite.scrollTop + boite.clientHeight) boite.scrollTop = haut - boite.clientHeight / 2;
          }
        });
      }, { rootMargin: "-30% 0px -60% 0px" });
      $$(".chapter", body).forEach(function (c) { io.observe(c); });
      ["sanctions", "glossaire", "examen"].forEach(function (id) { let el = doc.getElementById(id); if (el) io.observe(el); });
    };
    search.addEventListener("input", function () { draw(search.value.trim()); });
    body.addEventListener("click", function (e) {
      let b = e.target.closest("[data-read]");
      if (!b) return;
      let id = b.getAttribute("data-read");
      let on = !S.isMarked("rules", id);
      S.mark("rules", id, on);
      let sec = b.closest(".chapter");
      sec.classList.toggle("is-read", on);
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? "✓ Chapitre lu" : "Marquer comme lu";
      drawToc();
    });
    drawToc();
    draw("");

    $("#rules-sanctions").innerHTML = D.sanctions.map(function (s) {
      let sev = '<span class="sev" aria-hidden="true" style="--m:' + DANGER_VAR[Math.min(4, s.gravite)] + '">';
      for (let i = 1; i <= 5; i++) sev += '<i class="' + (i <= s.gravite ? "on" : "") + '"></i>';
      return "<tr><td>" + sev + "</span>" + esc(s.nom) + "</td><td>" + esc(s.motif) + "</td><td>" + esc(s.duree) + "</td></tr>";
    }).join("");

    $("#rules-glossary").innerHTML = D.glossaire.map(function (g) {
      return "<div><dt>" + esc(g[0]) + "</dt><dd>" + esc(g[1]) + "</dd></div>";
    }).join("");

    // Examen
    let quiz = $("#rules-quiz");
    let qi = 0, score = 0, answered = false;
    let L = ["A", "B", "C", "D", "E"];
    let drawQ = function () {
      let q = D.quiz[qi];
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
    let drawResult = function () {
      let pass = score >= S.seuilExamen();
      S.stat("exam", score, "max");
      quiz.innerHTML =
        '<div class="quiz__stamp" style="--c:' + (pass ? "var(--a-vert)" : "var(--a-rouge)") + '">' + (pass ? "Apte au service" : "À revoir") + "</div>" +
        '<div class="quiz__result"><span class="label">Résultat de l\'examen</span>' +
        '<p class="quiz__score">' + score + '<span style="color:var(--text-3)">/' + D.quiz.length + "</span></p>" +
        '<p class="prose">' + (pass
          ? "Tu maîtrises le règlement du Site-73, sur Discord comme en jeu. Il ne te reste plus qu'à créer ta fiche personnage."
          : "Il faut au moins " + S.seuilExamen() + " bonnes réponses. Relis la partie B (Roblox), surtout le roleplay et le combat, puis retente l'examen.") + "</p>" +
        '<div class="hero__cta"><button type="button" class="btn" data-restart>Recommencer</button>' +
        (pass ? '<a class="btn btn--signal" href="rejoindre.html#fiche">Créer ma fiche ' + S.icon.arrow + "</a>" : '<a class="btn btn--signal" href="#partie-roblox">Relire la partie Roblox</a>') + "</div></div>";
    };
    quiz.addEventListener("click", function (e) {
      let o = e.target.closest(".quiz__opt");
      if (o && !answered) {
        answered = true;
        let q = D.quiz[qi], i = +o.getAttribute("data-i"), good = i === q.bonne;
        if (good) score++;
        S.sfx(good ? "ok" : "deny");
        $$(".quiz__opt", quiz).forEach(function (b, j) {
          b.disabled = true;
          if (j === q.bonne) b.classList.add("is-right");
          else if (j === i) b.classList.add("is-wrong");
        });
        $(".quiz__fb", quiz).innerHTML = "<b>" + (good ? "Correct." : "Incorrect.") + "</b> " + esc(q.explication);
        let nx = $("[data-next]", quiz);
        nx.hidden = false;
        nx.focus();
        $(".quiz__progress i", quiz).style.width = ((qi + 1) / D.quiz.length) * 100 + "%";
        return;
      }
      if (e.target.closest("[data-next]")) {
        qi++;
        if (qi >= D.quiz.length) drawResult(); else drawQ();
        let first = $(".quiz__opt", quiz);
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
    let form = $("#join-form");
    if (!form) return;

    $("#join-steps").innerHTML = D.etapes.map(function (e) {
      return '<li class="step"><h3>' + esc(e.titre) + "</h3><p>" + esc(e.texte) + "</p></li>";
    }).join("");
    $("#join-faq").innerHTML = D.faq.map(function (f) {
      return "<details><summary>" + esc(f.q) + "</summary><p>" + esc(f.r) + "</p></details>";
    }).join("");

    let EXAMPLE = {
      prenom: "Élise", nom: "Varenne", age: "31", dept: "scientifique", grade: "Chercheur junior",
      apparence: "Cheveux bruns coupés court, lunettes rondes, blouse toujours tachée d'encre.",
      perso: "Méthodique, curieuse, un peu trop franche.",
      histoire: "Docteure en biologie moléculaire, recrutée après avoir signalé une colonie de lichens qui « chantait » dans le Vercors. Elle a signé son contrat sans poser de questions et le regrette parfois.",
      comp: "Analyse biologique, rédaction de rapports, premiers secours"
    };
    let PHOTO = { direction: "#B9C4C9", scientifique: "#9CCFDF", securite: "#A7BBA5", fim: "#8E9A93", medical: "#E3B8B8", technique: "#D8C79B", ethique: "#C6BEE3", dsi: "#A9ADB8", "classe-d": "#F08A3C" };
    let F = {};
    ["prenom", "nom", "age", "dept", "grade", "roblox", "apparence", "perso", "histoire", "comp"].forEach(function (k) { F[k] = $("#join-" + k); });

    F.dept.innerHTML = D.departements.map(function (d) { return '<option value="' + d.id + '">' + esc(d.nom) + "</option>"; }).join("");
    let fillGrades = function (keep) {
      let d = D.departements.filter(function (x) { return x.id === F.dept.value; })[0];
      F.grade.innerHTML = d.grades.map(function (g) { return '<option value="' + esc(g[0]) + '">' + esc(g[0]) + " · hab. " + g[1] + "</option>"; }).join("");
      if (keep && d.grades.some(function (g) { return g[0] === keep; })) F.grade.value = keep;
      else F.grade.value = d.grades[0][0];
    };

    let load = function (v) {
      Object.keys(F).forEach(function (k) { if (k !== "grade") F[k].value = v[k] || ""; });
      if (!D.departements.some(function (d) { return d.id === F.dept.value; })) F.dept.value = "scientifique";
      fillGrades(v.grade);
    };
    let saved = null;
    try { saved = JSON.parse(S.store.get("s73.fiche") || "null"); } catch (e) { saved = null; }
    load(saved || EXAMPLE);
    let note = $("#join-note");
    if (note) note.hidden = !!saved;

    // État de la photo, sous le champ « Pseudo Roblox »
    let photoHint = $("#join-roblox-hint");
    let PHOTO_MSG = {
      roblox: "✓ Photo Roblox affichée sur la carte.",
      introuvable: "Pseudo Roblox introuvable. Vérifie l'orthographe.",
      invalide: "3 à 20 caractères : lettres, chiffres ou _.",
      attente: "Recherche de ton avatar Roblox…",
      horsligne: "La photo Roblox s'affiche quand le serveur du site répond.",
      aucune: "Indique ton pseudo Roblox pour mettre la tête de ton avatar sur la carte."
    };
    let afficherPhoto = function (etat) { if (photoHint) photoHint.textContent = PHOTO_MSG[etat] || ""; };

    let current = {};
    let update = function () {
      let v = {};
      Object.keys(F).forEach(function (k) { v[k] = F[k].value.trim(); });
      current = v;
      S.renderIdCard($("#join-card"), v, afficherPhoto);
      let age = parseInt(v.age, 10);
      $("#join-output").textContent = S.texteFiche(v);
      let warn = $("#join-age-hint");
      if (warn) warn.textContent = !v.age ? "" : isNaN(age) || age < 18 || age > 75 ? "L'âge doit être compris entre 18 et 75 ans." : "";
    };
    let save = function () { S.store.set("s73.fiche", JSON.stringify(current)); if (note) note.hidden = true; };

    form.addEventListener("input", function (e) {
      if (e.target === F.dept) fillGrades();
      update();
      save();
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    $("#join-random").addEventListener("click", function () {
      let N = D.noms;
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
      S.stat("copies");
      U.copy($("#join-output").textContent, "<b>Fiche copiée.</b> Colle-la dans le salon #fiches-personnage du Discord.", $("#join-output"));
    });
    S.tiltCard($(".idcard-stage"), $("#join-card"));
    update();

    // Test d'orientation
    let orient = $("#join-orient");
    if (orient) {
      let oi = 0, scores = {};
      let drawO = function () {
        let q = D.orientation[oi];
        orient.innerHTML =
          '<div class="quiz__head"><span class="label">Question ' + (oi + 1) + " / " + D.orientation.length + '</span><div class="quiz__progress" aria-hidden="true"><i style="width:' + (oi / D.orientation.length) * 100 + '%"></i></div></div>' +
          '<p class="quiz__q" id="orient-q">' + esc(q.q) + "</p>" +
          '<div class="quiz__opts" role="group" aria-labelledby="orient-q">' + q.r.map(function (r, i) {
            return '<button type="button" class="quiz__opt" data-o="' + i + '"><b>' + "ABCDE"[i] + "</b><span>" + esc(r[0]) + "</span></button>";
          }).join("") + "</div>";
      };
      let drawOResult = function () {
        let best = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; })[0] || "scientifique";
        let d = D.departements.filter(function (x) { return x.id === best; })[0];
        let entryId = !d.recrutement && D.entreeConseillee[d.id] ? D.entreeConseillee[d.id] : d.id;
        let entry = D.departements.filter(function (x) { return x.id === entryId; })[0];
        orient.innerHTML =
          '<div class="quiz__result"><span class="label">Ton département idéal</span>' +
          '<p class="orient__code" aria-hidden="true">' + esc(d.code) + "</p>" +
          '<p class="quiz__q">' + esc(d.nom) + "</p>" +
          '<p class="prose">' + esc(d.resume) + "</p>" +
          (entry.id !== d.id ? '<p class="prose">Ce département recrute sur nomination. Commence au <b>' + esc(entry.nom) + "</b> et fais tes preuves pour y être appelé.</p>" : "") +
          '<div class="hero__cta"><button type="button" class="btn btn--signal" data-use="' + entry.id + '">Utiliser « ' + esc(entry.nom) + " » dans ma fiche</button>" +
          '<button type="button" class="btn" data-orestart>Refaire le test</button></div></div>';
      };
      orient.addEventListener("click", function (e) {
        let o = e.target.closest("[data-o]");
        if (o) {
          let pts = D.orientation[oi].r[+o.getAttribute("data-o")][1];
          Object.keys(pts).forEach(function (k) { scores[k] = (scores[k] || 0) + pts[k]; });
          S.sfx("tick");
          oi++;
          if (oi >= D.orientation.length) drawOResult(); else drawO();
          let f = $(".quiz__opt, [data-use]", orient);
          if (f) f.focus({ preventScroll: true });
          return;
        }
        let u = e.target.closest("[data-use]");
        if (u) {
          F.dept.value = u.getAttribute("data-use");
          fillGrades();
          update(); save();
          $("#fiche").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
          S.toast("<b>Département sélectionné.</b> Complète maintenant le reste de ta fiche.");
          return;
        }
        if (e.target.closest("[data-orestart]")) { oi = 0; scores = {}; drawO(); }
      });
      drawO();
    }
  }

  /* ---------- Carte d'accès (partagée avec le carnet) ---------------- */
  let PHOTO_COLORS = { direction: "#B9C4C9", scientifique: "#9CCFDF", securite: "#A7BBA5", fim: "#8E9A93", medical: "#E3B8B8", technique: "#D8C79B", ethique: "#C6BEE3", dsi: "#A9ADB8", "classe-d": "#F08A3C" };
  let barcode = function (seed) {
    let h = U.hash(seed), x = 0, bars = "";
    for (let i = 0; i < 46 && x < 190; i++) {
      h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
      let w = 1 + (h % 3), gap = 1 + ((h >>> 3) % 2);
      bars += '<rect x="' + x + '" y="0" width="' + w + '" height="40"/>';
      x += w + gap;
    }
    return '<svg viewBox="0 0 ' + x + ' 40" preserveAspectRatio="none" fill="#0F1619" aria-hidden="true">' + bars + "</svg>";
  };
  let portrait = function (isD) {
    let ln = "";
    for (let y = 12; y < 100; y += 11) ln += '<line x1="0" y1="' + y + '" x2="100" y2="' + y + '" stroke="rgb(0 0 0 / ' + (isD ? ".28" : ".1") + ')" stroke-width="' + (isD ? 1 : 0.6) + '"/>';
    return '<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' + ln +
      '<circle cx="50" cy="48" r="20" fill="rgb(15 22 25 / .55)"/><path d="M12 120 C14 88 30 74 50 74 C70 74 86 88 88 120 Z" fill="rgb(15 22 25 / .55)"/></svg>';
  };
  // Photo de la carte : avatar Roblox (via le serveur), sinon silhouette.
  let PSEUDO_ROBLOX = /^[A-Za-z0-9_]{3,20}$/;
  let photosRoblox = {}, photosResolues = {}, photosVues = {};
  let chercherRoblox = function (pseudo) {
    let cle = pseudo.toLowerCase();
    if (!photosRoblox[cle]) {
      photosRoblox[cle] = fetch("/api/roblox?pseudo=" + encodeURIComponent(pseudo), { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && j.image ? j.image : null; }, function () { return null; });
      photosRoblox[cle].then(function (url) {
        photosResolues[cle] = url;
        if (!url) setTimeout(function () { delete photosRoblox[cle]; delete photosResolues[cle]; }, 60000);
      });
    }
    return photosRoblox[cle];
  };
  S.photoCarte = function (card, v, rapport) {
    let zone = card.querySelector(".idcard__photo");
    if (!zone) return;
    let jeton = (card.__photo = (card.__photo || 0) + 1);
    let dire = function (e) { if (rapport) rapport(e); };
    let poser = function (url, source, alt) {
      if (card.__photo !== jeton) return;
      let old = zone.querySelector("img");
      if (old) old.remove();
      zone.classList.toggle("has-photo", !!url);
      if (!url) { zone.removeAttribute("data-source"); return; }
      let img = new Image();
      img.alt = alt;
      img.className = "idcard__img" + (photosVues[url] ? " is-vu" : "");
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.onload = function () { photosVues[url] = true; };
      img.onerror = function () {
        img.remove();
        zone.classList.remove("has-photo");
        zone.removeAttribute("data-source");
      };
      img.src = url;
      zone.insertBefore(img, zone.querySelector("b"));
      zone.setAttribute("data-source", source);
    };
    let pseudo = String(v.roblox || "").trim();
    if (!pseudo) { poser(null); dire("aucune"); return; }
    if (!PSEUDO_ROBLOX.test(pseudo)) { poser(null); dire("invalide"); return; }
    if (!S.isLive()) { poser(null); dire("horsligne"); return; }
    let conclure = function (url) {
      if (card.__photo !== jeton) return;
      if (url) { poser(url, "roblox", "Avatar Roblox de " + pseudo); dire("roblox"); }
      else { poser(null); dire("introuvable"); }
    };
    let cle = pseudo.toLowerCase();
    if (cle in photosResolues) { conclure(photosResolues[cle]); return; }
    dire("attente");
    // Laisse finir la frappe avant d'interroger Roblox
    setTimeout(function () {
      if (card.__photo === jeton) chercherRoblox(pseudo).then(conclure);
    }, photosRoblox[cle] ? 0 : 500);
  };
  // Département, grade, habilitation et matricule d'une fiche (carte, textes, listes)
  S.infosFiche = function (v) {
    let d = D.departements.filter(function (x) { return x.id === v.dept; })[0] || D.departements[1];
    let g = d.grades.filter(function (x) { return x[0] === v.grade; })[0] || d.grades[0];
    let isD = d.id === "classe-d";
    let num = String(1000 + (U.hash(((v.prenom || "") + (v.nom || "") + d.id).toLowerCase()) % 9000));
    return {
      dept: d, grade: g, lvl: g[1], isD: isD, num: num,
      matricule: isD ? "D-" + num : "73-" + d.code + "-" + num,
      fullName: isD ? "D-" + num : (((v.prenom || "") + " " + (v.nom || "Nom")).trim())
    };
  };
  // Fiche au format Discord (page Rejoindre et console staff)
  S.texteFiche = function (v, extra) {
    let f = S.infosFiche(v), age = parseInt(v.age, 10);
    return [
      "**FICHE PERSONNAGE · SITE-73**",
      "> **Nom :** " + (f.isD ? f.matricule + " (anciennement " + (((v.prenom || "") + " " + (v.nom || "")).trim() || "inconnu") + ")" : f.fullName),
      "> **Âge :** " + (isNaN(age) ? "—" : age + " ans"),
      "> **Département :** " + f.dept.nom,
      "> **Grade :** " + f.grade[0],
      "> **Habilitation :** niveau " + f.lvl + " (" + S.habName(f.lvl) + ")",
      "> **Matricule :** " + f.matricule,
      "> **Roblox :** " + (v.roblox || "—")
    ].concat(extra || []).concat([
      "",
      "**Apparence :** " + (v.apparence || "—"),
      "**Personnalité :** " + (v.perso || "—"),
      "**Histoire :** " + (v.histoire || "—"),
      "**Compétences :** " + (v.comp || "—")
    ]).join("\n");
  };
  S.renderIdCard = function (card, v, rapport) {
    let f = S.infosFiche(v);
    let d = f.dept, g = f.grade, lvl = f.lvl, isD = f.isD, num = f.num, matricule = f.matricule, fullName = f.fullName;
    card.style.setProperty("--dc", PHOTO_COLORS[d.id] || "#B9C4C9");
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
    S.photoCarte(card, v, rapport);
    return { dept: d, grade: g, lvl: lvl, isD: isD, matricule: matricule, fullName: fullName };
  };
  S.tiltCard = function (stage, card) {
    if (!stage || !card || reduced) return;
    stage.addEventListener("pointermove", function (e) {
      let r = card.getBoundingClientRect();
      let x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--ry", (x - 0.5) * 16 + "deg");
      card.style.setProperty("--rx", (0.5 - y) * 12 + "deg");
      card.style.setProperty("--sh", x * 100 + "%");
    });
    stage.addEventListener("pointerleave", function () {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--sh", "45%");
    });
  };

  /* ---------- Lancement ------------------------------------------------ */
  S.pageModules = [accueil, confinement, plan, personnel, archives, terminal, reglement, rejoindre];
})();

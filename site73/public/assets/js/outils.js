/* ==========================================================================
   SITE-73 · MODULES DES PAGES OUTILS
   Événements, protocoles, laboratoire, entraînement et carnet de service.
   Ce fichier lance aussi tous les modules de pages (pages.js compris).
   ========================================================================== */
(function () {
  "use strict";

  var S = window.S73, D = S.data, doc = document;
  var U = S.util, esc = U.esc, norm = U.norm, pad = U.pad;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduced = document.documentElement.getAttribute("data-motion") === "reduit";
  document.addEventListener("s73:settings", function () { reduced = document.documentElement.getAttribute("data-motion") === "reduit"; });

  var dayKey;
  try {
    var dk = new Intl.DateTimeFormat("en-CA", { timeZone: D.config.fuseau, year: "numeric", month: "2-digit", day: "2-digit" });
    dayKey = function (d) { return dk.format(d); };
  } catch (e) {
    dayKey = function (d) { return d.toISOString().slice(0, 10); };
  }
  var MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  /* ======================================================================
     ÉVÉNEMENTS
     ====================================================================== */
  function evenements() {
    var list = $("#evt-list");
    if (!list) return;
    var T = D.typesEvenement;
    var trier = function () { return (D.evenements || []).slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }); };
    var all = trier();
    var state = { type: "all" };
    var status = function (e) {
      var t0 = new Date(e.date).getTime(), t1 = t0 + e.duree * 60000, now = Date.now();
      return now < t0 ? "avenir" : now < t1 ? "encours" : "termine";
    };
    var discordText = function (e) {
      return "📢 **" + e.titre.toUpperCase() + "**\n🗓️ " + S.fmtEvent(e.date) + " · " + Math.round(e.duree / 60 * 10) / 10 + " h\n📍 " + e.lieu + "\n\n" + e.texte + "\n\n_Site-73 · " + T[e.type].nom + "_";
    };

    // --- Prochain événement
    var hero = $("#evt-next");
    var renderHero = function () {
      var ev = S.upcoming()[0];
      if (!ev) { hero.innerHTML = '<p class="next__title">Aucun événement programmé.</p>'; return; }
      var ms = new Date(ev.date).getTime() - Date.now();
      hero.style.setProperty("--c", T[ev.type].couleur);
      hero.innerHTML =
        '<div class="evt-hero__info"><p class="label">Prochain événement</p><h2 class="evt-hero__title">' + esc(ev.titre) + "</h2>" +
        '<p class="next__meta"><span class="chip" style="--c:' + T[ev.type].couleur + '">' + esc(T[ev.type].nom) + "</span><span>" + esc(S.fmtEvent(ev.date)) + "</span><span>" + esc(ev.lieu) + "</span></p>" +
        '<p class="prose">' + esc(ev.texte) + "</p></div>" +
        '<div class="evt-hero__count" aria-live="off"><p class="label">' + (ms > 0 ? "Début dans" : "En cours") + "</p>" + countdownBlocks(ms) + "</div>";
    };
    var countdownBlocks = function (ms) {
      var s = Math.max(0, Math.floor(ms / 1000));
      var j = Math.floor(s / 86400); s -= j * 86400;
      var h = Math.floor(s / 3600); s -= h * 3600;
      var m = Math.floor(s / 60); s -= m * 60;
      return '<div class="cd">' + [[j, "jours"], [h, "heures"], [m, "min"], [s, "s"]].map(function (x) {
        return '<div><b class="mono">' + pad(x[0]) + "</b><span>" + x[1] + "</span></div>";
      }).join("") + "</div>";
    };
    doc.addEventListener("s73:tick", function () {
      var ev = S.upcoming()[0];
      var cd = $(".cd", hero);
      if (ev && cd) cd.outerHTML = countdownBlocks(new Date(ev.date).getTime() - Date.now());
      $$("[data-evt-count]", list).forEach(function (el) {
        var e = all.filter(function (x) { return x.id === el.getAttribute("data-evt-count"); })[0];
        if (!e) return;
        var st = status(e);
        el.textContent = st === "avenir" ? "dans " + S.formatCountdown(new Date(e.date).getTime() - Date.now()) : st === "encours" ? "En cours" : "Terminé";
      });
    });
    renderHero();

    // --- Calendrier
    var cal = $("#evt-cal");
    var first = S.upcoming()[0] || all[all.length - 1] || { date: new Date().toISOString() };
    var viewY = +first.date.slice(0, 4), viewM = +first.date.slice(5, 7) - 1;
    var today = dayKey(new Date());
    var renderCal = function () {
      var byDay = {};
      all.forEach(function (e) { var k = e.date.slice(0, 10); (byDay[k] = byDay[k] || []).push(e); });
      var firstDay = new Date(Date.UTC(viewY, viewM, 1));
      var offset = (firstDay.getUTCDay() + 6) % 7;
      var nDays = new Date(Date.UTC(viewY, viewM + 1, 0)).getUTCDate();
      var cells = "";
      for (var i = 0; i < offset; i++) cells += '<div class="cal__cell is-empty" aria-hidden="true"></div>';
      for (var d = 1; d <= nDays; d++) {
        var key = viewY + "-" + pad(viewM + 1) + "-" + pad(d);
        var evs = byDay[key] || [];
        var cls = "cal__cell" + (key === today ? " is-today" : "") + (evs.length ? " has-evt" : "");
        if (evs.length) {
          cells += '<button type="button" class="' + cls + '" data-day="' + key + '" aria-label="' + d + " " + MOIS_LONG[viewM] + " : " + esc(evs.map(function (e) { return e.titre; }).join(", ")) + '">' +
            "<b>" + d + '</b><span class="cal__dots">' + evs.map(function (e) { return '<i style="--c:' + T[e.type].couleur + '"></i>'; }).join("") + "</span>" +
            '<span class="cal__name">' + esc(evs[0].titre) + "</span></button>";
        } else {
          cells += '<div class="' + cls + '"><b>' + d + "</b></div>";
        }
      }
      var rest = (offset + nDays) % 7;
      if (rest) for (var r = rest; r < 7; r++) cells += '<div class="cal__cell is-empty" aria-hidden="true"></div>';
      cal.innerHTML =
        '<div class="cal__head"><button type="button" class="icon-btn" data-m="-1" aria-label="Mois précédent">' + S.icon.prev + "</button>" +
        '<h3 class="cal__title">' + MOIS_LONG[viewM] + " " + viewY + "</h3>" +
        '<button type="button" class="icon-btn" data-m="1" aria-label="Mois suivant">' + S.icon.next + "</button></div>" +
        '<div class="cal__grid"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>' + cells + "</div>";
    };
    cal.addEventListener("click", function (e) {
      var m = e.target.closest("[data-m]");
      if (m) {
        viewM += +m.getAttribute("data-m");
        if (viewM < 0) { viewM = 11; viewY--; }
        if (viewM > 11) { viewM = 0; viewY++; }
        renderCal();
        return;
      }
      var d = e.target.closest("[data-day]");
      if (d) {
        var ev = all.filter(function (x) { return x.date.slice(0, 10) === d.getAttribute("data-day"); })[0];
        if (ev) S.scrollToHash("evt-" + ev.id);
      }
    });
    renderCal();

    // --- Liste
    var filt = $("#evt-filters");
    var keys = ["all"].concat(Object.keys(T)).concat(["planning"]);
    var drawFilters = function () {
      filt.innerHTML = keys.map(function (k) {
        var n = k === "all" ? all.length : k === "planning" ? all.filter(function (e) { return S.isMarked("planning", e.id); }).length : all.filter(function (e) { return e.type === k; }).length;
        if (!n && k !== "planning" && k !== "all") return "";
        var c = k === "all" ? "var(--text-2)" : k === "planning" ? "var(--signal)" : T[k].couleur;
        return '<button type="button" aria-pressed="' + (state.type === k) + '" data-k="' + k + '" style="--c:' + c + '">' + (k === "all" ? "Tout" : k === "planning" ? "Mon planning" : T[k].nom) + " <b>" + n + "</b></button>";
      }).join("");
    };
    var renderList = function () {
      var items = all.filter(function (e) {
        if (state.type === "planning") return S.isMarked("planning", e.id);
        return state.type === "all" || e.type === state.type;
      });
      var up = items.filter(function (e) { return status(e) !== "termine"; });
      var past = items.filter(function (e) { return status(e) === "termine"; }).reverse();
      var card = function (e) {
        var st = status(e), on = S.isMarked("planning", e.id);
        var d = new Date(e.date);
        var parts = S.fmtEvent(e.date).split(" ");
        return '<article class="evt' + (st === "termine" ? " is-past" : "") + '" id="evt-' + e.id + '" style="--c:' + T[e.type].couleur + '">' +
          '<div class="evt__date"><b>' + esc(parts[1]) + "</b><span>" + esc(parts[2]) + "</span><small>" + esc(parts[0]) + "</small></div>" +
          '<div class="evt__body"><div class="evt__meta"><span class="chip" style="--c:' + T[e.type].couleur + '">' + esc(T[e.type].nom) + "</span>" +
            '<span class="mono evt__time">' + esc(S.fmtEvent(e.date).split(" · ")[1] || "") + " · " + (e.duree >= 60 ? Math.round(e.duree / 6) / 10 + " h" : e.duree + " min") + "</span>" +
            '<span class="evt__count mono" data-evt-count="' + e.id + '"></span></div>' +
            "<h3>" + esc(e.titre) + '</h3><p class="evt__lieu">' + esc(e.lieu) + "</p><p>" + esc(e.texte) + "</p>" +
            '<div class="evt__cta">' +
              (st !== "termine" ? '<button type="button" class="btn btn--sm' + (on ? " btn--signal" : "") + '" data-plan="' + e.id + '" aria-pressed="' + on + '">' + (on ? "✓ Dans mon planning" : "Ajouter à mon planning") + "</button>" : "") +
              '<button type="button" class="btn btn--sm" data-copy="' + e.id + '">' + S.icon.copy + "Copier l'annonce</button></div></div></article>";
      };
      list.innerHTML =
        (up.length ? up.map(card).join("") : '<p class="empty">Aucun événement à venir dans cette catégorie.</p>') +
        (past.length ? '<h3 class="evt-past-title label">Événements passés</h3>' + past.map(card).join("") : "");
      doc.dispatchEvent(new CustomEvent("s73:tick"));
    };
    filt.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k]");
      if (!b) return;
      state.type = b.getAttribute("data-k");
      drawFilters();
      renderList();
      S.rejouer(list);
    });
    list.addEventListener("click", function (e) {
      var p = e.target.closest("[data-plan]");
      if (p) {
        var id = p.getAttribute("data-plan");
        var on = !S.isMarked("planning", id);
        S.mark("planning", id, on);
        if (on) S.toast("<b>Ajouté à ton planning.</b> Retrouve-le dans ton carnet de service.");
        return;
      }
      var c = e.target.closest("[data-copy]");
      if (c) {
        var ev = all.filter(function (x) { return x.id === c.getAttribute("data-copy"); })[0];
        S.stat("copies");
        U.copy(discordText(ev), "<b>Annonce copiée.</b> Colle-la dans #annonces sur Discord.");
      }
    });
    doc.addEventListener("s73:carnet", function () { drawFilters(); renderList(); });
    doc.addEventListener("s73:dynamic", function () { all = trier(); drawFilters(); renderList(); renderHero(); renderCal(); });
    drawFilters();
    renderList();

    S.onHash(function (h) {
      if (!/^evt-/.test(h)) return false;
      var el = doc.getElementById(h);
      if (!el) {
        state.type = "all"; drawFilters(); renderList();
        el = doc.getElementById(h);
      }
      if (!el) return false;
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      S.flashTarget(el);
      return true;
    });
  }

  /* ======================================================================
     PROTOCOLES
     ====================================================================== */
  function protocoles() {
    var panel = $("#proto-panel");
    if (!panel) return;
    var P = D.protocoles;
    var state = { role: P.roles[0].id, niveau: S.getAlert() };
    var roles = $("#proto-roles"), levels = $("#proto-levels");
    roles.innerHTML = P.roles.map(function (r) {
      return '<button type="button" role="radio" data-role="' + r.id + '" style="--c: var(--signal)">' + esc(r.nom) + "</button>";
    }).join("");
    levels.innerHTML = S.alerts.map(function (a) {
      return '<button type="button" role="radio" data-lvl="' + a + '" style="--c: var(--a-' + a + ')">' + esc(D.alertes[a].code.replace("Code ", "")) + "</button>";
    }).join("");
    var render = function () {
      $$("button", roles).forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-role") === state.role)); });
      $$("button", levels).forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-lvl") === state.niveau)); });
      var lv = P.niveaux[state.niveau], a = D.alertes[state.niveau];
      var role = P.roles.filter(function (r) { return r.id === state.role; })[0];
      panel.style.setProperty("--c", "var(--a-" + state.niveau + ")");
      panel.innerHTML =
        '<div class="proc__head"><span class="proc__code">' + esc(a.code) + '</span><span class="proc__title">' + esc(a.titre) + "</span></div>" +
        '<p class="proc__txt">' + esc(a.texte) + "</p>" +
        '<div class="proc__cols"><div><h3 class="label">Consignes générales</h3><ol class="proc__list" data-gen></ol></div>' +
        '<div><h3 class="label">Consignes · ' + esc(role.nom) + '</h3><ol class="proc__list proc__list--role" data-role-list></ol></div></div>';
      var gen = $("[data-gen]", panel), rl = $("[data-role-list]", panel);
      lv.general.forEach(function (t) { var li = doc.createElement("li"); S.redactInto(li, t); gen.appendChild(li); });
      (lv.roles[state.role] || []).forEach(function (t) { var li = doc.createElement("li"); S.redactInto(li, t); rl.appendChild(li); });
    };
    roles.addEventListener("click", function (e) { var b = e.target.closest("[data-role]"); if (b) { state.role = b.getAttribute("data-role"); render(); } });
    levels.addEventListener("click", function (e) { var b = e.target.closest("[data-lvl]"); if (b) { state.niveau = b.getAttribute("data-lvl"); render(); } });
    render();

    // Codes radio
    $("#proto-radio").innerHTML = D.radio.map(function (r) {
      return '<div class="code"><b>' + esc(r[0]) + "</b><span>" + esc(r[1]) + "</span></div>";
    }).join("");

    // Alphabet radio
    var pin = $("#proto-phon-input"), pout = $("#proto-phon-out"), pspeak = $("#proto-phon-speak");
    var spell = function (txt) {
      return norm(txt).toUpperCase().split("").map(function (ch) {
        if (/[A-Z]/.test(ch)) return D.alphabet[ch.charCodeAt(0) - 65];
        if (/[0-9]/.test(ch)) return D.chiffres[+ch];
        if (ch === " ") return "·";
        if (ch === "-") return "Tiret";
        return null;
      }).filter(Boolean);
    };
    var renderPhon = function () {
      var words = spell(pin.value);
      pout.innerHTML = words.length ? words.map(function (w) {
        return w === "·" ? '<span class="phon__sep" aria-hidden="true"></span>' : '<span class="phon__w"><b>' + esc(w.charAt(0)) + "</b>" + esc(w.slice(1)) + "</span>";
      }).join("") : '<span class="muted">Tape un mot, un matricule ou un code.</span>';
    };
    pin.addEventListener("input", renderPhon);
    if (pspeak) {
      if (!S.canSpeak) pspeak.hidden = true;
      pspeak.addEventListener("click", function () {
        var w = spell(pin.value).filter(function (x) { return x !== "·"; });
        if (w.length) S.speak(w.join(", "), { rate: 0.9 });
      });
    }
    renderPhon();

    // Annonce générale
    var tpl = $("#pa-tpl"), scp = $("#pa-scp"), zone = $("#pa-zone"), pers = $("#pa-personne"), text = $("#pa-text"), play = $("#pa-play"), copy = $("#pa-copy"), box = $("#pa-console");
    $("form", box).addEventListener("submit", function (e) { e.preventDefault(); });
    tpl.innerHTML = D.annonces.map(function (a) { return '<option value="' + a.id + '">' + esc(a.nom) + "</option>"; }).join("");
    scp.innerHTML = D.scp.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.code + " · " + s.nom) + "</option>"; }).join("");
    zone.innerHTML = D.zones.map(function (z) { return '<option value="' + z.id + '">' + esc(z.niveau + " · " + z.nom) + "</option>"; }).join("");
    scp.value = "173";
    var syncZone = function () { var s = S.scpById[scp.value]; if (s && S.zoneById[s.zone]) zone.value = s.zone; };
    syncZone();
    var build = function () {
      var a = D.annonces.filter(function (x) { return x.id === tpl.value; })[0];
      var s = S.scpById[scp.value], z = S.zoneById[zone.value];
      return a.texte.replace(/\{scp\}/g, s.code).replace(/\{zone\}/g, z.niveau.toLowerCase() + ", " + z.nom.split(" · ")[0].toLowerCase())
        .replace(/\{niveau\}/g, z.niveau.toLowerCase()).replace(/\{personne\}/g, pers.value.trim() || "le Docteur Varenne");
    };
    var sync = function () {
      var a = tpl.value;
      $$("[data-pa-need]", box).forEach(function (f) { f.hidden = f.getAttribute("data-pa-need").split(" ").indexOf(a) < 0; });
      text.textContent = build();
    };
    [tpl, zone, pers].forEach(function (el) { el.addEventListener("input", sync); el.addEventListener("change", sync); });
    scp.addEventListener("change", function () { syncZone(); sync(); });
    sync();
    var playing = false;
    var stopPA = function () { playing = false; box.classList.remove("is-live"); play.innerHTML = S.icon.speak + "<span>Diffuser l'annonce</span>"; };
    play.addEventListener("click", function () {
      if (playing) { S.stopSpeak(); stopPA(); return; }
      playing = true;
      box.classList.add("is-live");
      play.innerHTML = S.icon.stop + "<span>Arrêter</span>";
      [660, 880, 660].forEach(function (f, i) { S.tone(f, 0.35, { type: "sine", vol: 0.07, delay: i * 0.38, force: true }); });
      S.stat("pa");
      setTimeout(function () {
        if (!playing) return;
        var ok = S.speak(build(), { rate: 0.92, pitch: 0.85, onend: stopPA });
        if (!ok) {
          S.toast("<b>Synthèse vocale indisponible</b> sur ce navigateur. Copie l'annonce pour la lire toi-même en RP.");
          setTimeout(stopPA, 2500);
        }
      }, 1250);
    });
    copy.addEventListener("click", function () {
      S.stat("copies");
      U.copy("🔊 **ANNONCE GÉNÉRALE · SITE-73**\n> " + build(), "<b>Annonce copiée.</b>", text);
    });
  }

  /* ======================================================================
     LABORATOIRE
     ====================================================================== */
  function laboratoire() {
    var machine = $("#m914");
    if (!machine) return;
    var L = D.lab914;

    // --- SCP-914
    var obj = $("#m914-obj"), custom = $("#m914-custom"), customWrap = $("#m914-custom-wrap"), regs = $("#m914-reg"), run = $("#m914-run"), out = $("#m914-out"), logEl = $("#m914-log"), copyLog = $("#m914-copy");
    var reg = 2, busy = false, registre = [];
    obj.innerHTML = L.objets.map(function (o, i) { return '<option value="' + i + '">' + esc(o.nom) + "</option>"; }).join("") + '<option value="autre">Autre objet…</option>';
    regs.innerHTML = L.reglages.map(function (r, i) {
      return '<button type="button" role="radio" data-reg="' + i + '" style="--c:' + ["var(--c-neutralise)", "var(--c-attente)", "var(--c-sur)", "var(--signal)", "var(--a-rouge)"][i] + '">' + esc(r) + "</button>";
    }).join("");
    var knob = $(".m914__needle", machine);
    var syncReg = function () {
      $$("button", regs).forEach(function (b) { b.setAttribute("aria-checked", String(+b.getAttribute("data-reg") === reg)); });
      if (knob) knob.style.transform = "rotate(" + (-60 + reg * 30) + "deg)";
      $$("[data-dial]", machine).forEach(function (t) { t.classList.toggle("is-on", +t.getAttribute("data-dial") === reg); });
    };
    regs.addEventListener("click", function (e) { var b = e.target.closest("[data-reg]"); if (b && !busy) { reg = +b.getAttribute("data-reg"); syncReg(); S.sfx("tick"); } });
    machine.addEventListener("click", function (e) { var t = e.target.closest("[data-dial]"); if (t && !busy) { reg = +t.getAttribute("data-dial"); syncReg(); S.sfx("tick"); } });
    obj.addEventListener("change", function () { customWrap.hidden = obj.value !== "autre"; if (obj.value === "autre") custom.focus(); });
    syncReg();
    var objName = function () { return obj.value === "autre" ? (custom.value.trim() || "objet non identifié") : L.objets[+obj.value].nom; };
    var drawLog = function () {
      logEl.innerHTML = registre.length ? registre.map(function (r) {
        return "<li><time>" + esc(r.h) + "</time><span><b>" + esc(r.o) + "</b> · " + esc(r.r) + "</span><em data-lr></em></li>";
      }).join("") : '<li class="muted">Aucune expérience consignée pendant cette session.</li>';
      $$("[data-lr]", logEl).forEach(function (el, i) { S.redactInto(el, registre[i].res); });
      copyLog.disabled = !registre.length;
    };
    run.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      run.disabled = true;
      machine.classList.add("is-running");
      out.classList.remove("is-ready");
      out.innerHTML = '<p class="label">Cabine de sortie</p><p class="m914__wait">Le mécanisme tourne…</p>';
      var n = 0;
      var tickT = setInterval(function () { S.tone(n++ % 2 ? 1200 : 900, 0.03, { vol: 0.02, force: S.getSetting("sfx") }); }, 160);
      var name = objName();
      setTimeout(function () {
        clearInterval(tickT);
        var res = S.run914(name, reg);
        busy = false;
        run.disabled = false;
        machine.classList.remove("is-running");
        out.classList.add("is-ready");
        out.innerHTML = '<p class="label">Cabine de sortie · réglage « ' + esc(L.reglages[reg]) + " »</p><p class=\"m914__res\" data-res></p><p class=\"m914__in\">Entrée : " + esc(name) + "</p>";
        S.redactInto($("[data-res]", out), res);
        S.sfx(reg === 4 ? "deny" : "ok");
        registre.unshift({ h: S.formatClock(new Date()), o: name, r: L.reglages[reg], res: res });
        registre = registre.slice(0, 12);
        drawLog();
      }, reduced ? 300 : 2400);
    });
    copyLog.addEventListener("click", function () {
      var txt = "**REGISTRE SCP-914 · SALLE 3-14**\n" + registre.slice().reverse().map(function (r) {
        return "> " + r.h + " · " + r.o + " · « " + r.r + " » → " + r.res.replace(/\[\[(\d)\|([\s\S]*?)\]\]/g, "||$2||");
      }).join("\n");
      S.stat("copies");
      U.copy(txt, "<b>Registre copié.</b>");
    });
    drawLog();

    // --- Générateur de rapport
    var rf = $("#rap-form");
    var TYPES = {
      incident: { titre: "Rapport d'incident", pre: "RI", l1: "Déroulement de l'incident", l2: "Pertes et dégâts" },
      experience: { titre: "Journal d'expérience", pre: "JE", l1: "Protocole et observations", l2: "Conclusion" },
      mission: { titre: "Rapport de mission", pre: "RM", l1: "Déroulement de la mission", l2: "Bilan" }
    };
    var R = {};
    ["type", "date", "auteur", "zone", "scp", "perso", "deroul", "bilan", "niveau"].forEach(function (k) { R[k] = $("#rap-" + k); });
    R.zone.innerHTML = D.zones.map(function (z) { return '<option value="' + z.id + '">' + esc(z.niveau + " · " + z.nom) + "</option>"; }).join("");
    R.scp.innerHTML = '<option value="">Aucune anomalie</option>' + D.scp.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.code + " · " + s.nom) + "</option>"; }).join("");
    R.niveau.innerHTML = D.habilitations.map(function (h) { return '<option value="' + h.niveau + '">' + h.niveau + " · " + esc(h.nom) + "</option>"; }).join("");
    var RAP_EX = {
      type: "incident", date: "2026-09-02T14:37", auteur: "Sgt. Hugo Ferrand, Sécurité", zone: "zch", scp: "173", niveau: "3",
      perso: "Équipe de maintenance T-4, D-4418, D-4502, unité Epsilon-11",
      deroul: "À 14 h 37, une coupure de courant de 0,8 s touche le niveau −5 pendant la maintenance de la cellule C-173. Le contact visuel est rompu. SCP-173 franchit la porte de la cellule restée ouverte pour les travaux. Epsilon-11 intervient à 14 h 41 et rétablit le confinement à 14 h 49.",
      bilan: "Deux membres du personnel de Classe-D décédés. Porte de la cellule C-173 à remplacer."
    };
    var rapSaved = null;
    try { rapSaved = JSON.parse(S.store.get("s73.rapport") || "null"); } catch (e) { rapSaved = null; }
    var rapLoad = function (v) { Object.keys(R).forEach(function (k) { if (v[k] != null) R[k].value = v[k]; }); };
    rapLoad(rapSaved || RAP_EX);
    var rapPrev = $("#rap-preview");
    var rapData = function () { var v = {}; Object.keys(R).forEach(function (k) { v[k] = R[k].value.trim(); }); return v; };
    var refOf = function (v) { var t = TYPES[v.type]; return t.pre + "-73-" + (v.date || "2026").slice(0, 4) + "-" + pad(U.hash(v.deroul + v.date) % 100); };
    var fmtD = function (v) {
      if (!v.date) return "—";
      var p = v.date.split("T");
      return U.fmtDate(p[0]) + (p[1] ? " · " + p[1].replace(":", " h ") : "");
    };
    var rapRender = function () {
      var v = rapData(), t = TYPES[v.type] || TYPES.incident;
      $("#rap-l1").textContent = t.l1;
      $("#rap-l2").textContent = t.l2;
      var z = S.zoneById[v.zone], s = v.scp ? S.scpById[v.scp] : null, lvl = +v.niveau;
      rapPrev.innerHTML =
        '<header class="doc__head"><div class="doc__org">' + S.emblem() + "<span>Fondation SCP · Site-73<small>" + esc(t.titre) + " · document interne</small></span></div>" +
        '<div class="doc__stamp">' + esc(S.stamps[lvl]) + "<br>Niveau " + lvl + "</div></header>" +
        '<h2 class="doc__title"><small>' + esc(t.titre) + "</small>" + esc(refOf(v)) + "</h2>" +
        '<dl class="doc__fields">' +
          "<div><dt>Date et heure</dt><dd>" + esc(fmtD(v)) + "</dd></div>" +
          "<div><dt>Lieu</dt><dd>" + esc(z ? z.niveau + " · " + z.nom : "—") + "</dd></div>" +
          "<div><dt>Anomalie</dt><dd>" + esc(s ? s.code + " · " + s.nom : "Aucune") + "</dd></div>" +
          "<div><dt>Rédigé par</dt><dd>" + esc(v.auteur || "—") + "</dd></div>" +
        "</dl>" +
        "<section><h3>Personnel impliqué</h3><p>" + esc(v.perso || "—") + "</p></section>" +
        "<section><h3>" + esc(t.l1) + "</h3><p>" + esc(v.deroul || "—") + "</p></section>" +
        "<section><h3>" + esc(t.l2) + "</h3><p>" + esc(v.bilan || "—") + "</p></section>";
      S.store.set("s73.rapport", JSON.stringify(v));
    };
    rf.addEventListener("input", rapRender);
    rf.addEventListener("change", rapRender);
    rf.addEventListener("submit", function (e) { e.preventDefault(); });
    $("#rap-reset").addEventListener("click", function () { rapLoad(RAP_EX); rapRender(); S.toast("<b>Exemple restauré.</b>"); });
    $("#rap-copy").addEventListener("click", function () {
      var v = rapData(), t = TYPES[v.type], z = S.zoneById[v.zone], s = v.scp ? S.scpById[v.scp] : null;
      var txt = [
        "**" + t.titre.toUpperCase() + " · " + refOf(v) + "**",
        "> **Classification :** niveau " + v.niveau + " (" + S.habName(+v.niveau) + ")",
        "> **Date :** " + fmtD(v),
        "> **Lieu :** " + (z ? z.niveau + " · " + z.nom : "—"),
        "> **Anomalie :** " + (s ? s.code + " · " + s.nom : "aucune"),
        "> **Rédigé par :** " + (v.auteur || "—"),
        "",
        "**Personnel impliqué :** " + (v.perso || "—"),
        "**" + t.l1 + " :** " + (v.deroul || "—"),
        "**" + t.l2 + " :** " + (v.bilan || "—")
      ].join("\n");
      S.stat("copies");
      U.copy(txt, "<b>Rapport copié.</b> Colle-le dans le salon des rapports.");
    });
    rapRender();

    // --- Créateur de dossier SCP
    var cf = $("#cre-form");
    var C = {};
    ["num", "nom", "classe", "niveau", "menace", "proc", "desc"].forEach(function (k) { C[k] = $("#cre-" + k); });
    C.classe.innerHTML = Object.keys(D.classesObjet).map(function (k) { return '<option value="' + k + '">' + esc(D.classesObjet[k].nom) + "</option>"; }).join("");
    C.niveau.innerHTML = [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '">Niveau ' + n + " · " + esc(D.habilitations[n].nom) + "</option>"; }).join("");
    C.menace.innerHTML = [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '">' + n + " · " + esc(S.menaceLabel(n)) + "</option>"; }).join("");
    var view = $("#cre-view"), viewOut = $("#cre-view-out"), crePrev = $("#cre-preview");
    var CRE_EX = {
      num: "ANO-73-022", nom: "Le Refuge Vide", classe: "euclide", niveau: "3", menace: "2",
      proc: "Le refuge est fermé au public sous couvert de travaux. Toute nuitée sur place est interdite. [[3|Deux agents contrôlent le registre des visiteurs chaque matin.]]",
      desc: "Refuge de montagne situé à 2 600 m. Le registre des visiteurs se remplit chaque nuit de noms inconnus. [[3|Les noms correspondent à des alpinistes disparus entre 1954 et 1987.]] [[5|La dernière entrée est datée de demain et porte le nom du Directeur du Site.]] Origine : [DONNÉES SUPPRIMÉES]."
    };
    var creSaved = null;
    try { creSaved = JSON.parse(S.store.get("s73.createur") || "null"); } catch (e) { creSaved = null; }
    var creLoad = function (v) { Object.keys(C).forEach(function (k) { if (v[k] != null) C[k].value = v[k]; }); };
    creLoad(creSaved || CRE_EX);
    view.value = String(S.getClearance());
    var creData = function () { var v = {}; Object.keys(C).forEach(function (k) { v[k] = C[k].value.trim(); }); return v; };
    var creRender = function () {
      var v = creData(), lvl = +view.value;
      viewOut.textContent = "Niveau " + lvl + " · " + S.habName(lvl);
      var meterTxt = "";
      for (var i = 1; i <= 5; i++) meterTxt += i <= +v.menace ? "■" : "□";
      crePrev.style.setProperty("--c", "var(--c-" + v.classe + ")");
      crePrev.innerHTML =
        '<header class="doc__head"><div class="doc__org">' + S.emblem() + "<span>Fondation SCP · Site-73<small>Proposition de dossier · brouillon</small></span></div>" +
        '<div class="doc__stamp">' + esc(S.stamps[+v.niveau]) + "<br>Niveau " + esc(v.niveau) + "</div></header>" +
        '<h2 class="doc__title"><small>Objet n°</small>' + esc(v.num || "SCP-XXXX") + "</h2>" +
        '<p class="doc__name">« ' + esc(v.nom || "Sans nom") + " »</p>" +
        '<dl class="doc__fields"><div><dt>Classe</dt><dd><span class="doc__class">' + esc(D.classesObjet[v.classe].nom) + "</span></dd></div>" +
        '<div><dt>Niveau de menace</dt><dd><span class="doc__menace" aria-hidden="true">' + meterTxt + "</span> " + esc(S.menaceLabel(+v.menace)) + "</dd></div></dl>" +
        "<section><h3>Procédures de confinement spéciales</h3><p>" + S.redact(v.proc || "—", null, lvl) + "</p></section>" +
        "<section><h3>Description</h3><p>" + S.redact(v.desc || "—", null, lvl) + "</p></section>" +
        '<footer class="doc__foot"><span>Aperçu tel que le voit une habilitation de niveau ' + lvl + ".</span></footer>";
      S.store.set("s73.createur", JSON.stringify(v));
    };
    cf.addEventListener("input", creRender);
    cf.addEventListener("change", creRender);
    cf.addEventListener("submit", function (e) { e.preventDefault(); });
    view.addEventListener("input", creRender);
    $("#cre-reset").addEventListener("click", function () { creLoad(CRE_EX); creRender(); S.toast("<b>Exemple restauré.</b>"); });
    $$("[data-insert]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ta = C[b.getAttribute("data-target")] || C.desc;
        var ins = b.getAttribute("data-insert");
        var st = ta.selectionStart || ta.value.length, en = ta.selectionEnd || st;
        var sel = ta.value.slice(st, en);
        var txt = ins === "sup" ? "[DONNÉES SUPPRIMÉES]" : "[[" + ins + "|" + (sel || "texte masqué") + "]]";
        ta.value = ta.value.slice(0, st) + txt + ta.value.slice(en);
        ta.focus();
        creRender();
      });
    });
    $("#cre-copy").addEventListener("click", function () {
      var v = creData();
      var sp = function (t) { return t.replace(/\[\[(\d)\|([\s\S]*?)\]\]/g, "||$2||"); };
      var txt = [
        "**" + (v.num || "SCP-XXXX") + " · « " + (v.nom || "Sans nom") + " »**",
        "> **Classe :** " + D.classesObjet[v.classe].nom + " · **Habilitation :** niveau " + v.niveau + " · **Menace :** " + S.menaceLabel(+v.menace),
        "",
        "**Procédures de confinement spéciales :** " + sp(v.proc),
        "",
        "**Description :** " + sp(v.desc)
      ].join("\n");
      S.stat("copies");
      U.copy(txt, "<b>Dossier copié.</b> Les passages caviardés deviennent des spoilers Discord.");
    });
    creRender();
  }

  /* ======================================================================
     ENTRAÎNEMENT
     ====================================================================== */
  function entrainement() {
    var stage = $("#g173");
    if (!stage) return;

    // --- Contact visuel
    var statue = $("#g173-statue"), startBtn = $("#g173-start"), lightBtn = $("#g173-light"), msg = $("#g173-msg"), batEl = $("#g173-bat"), timeEl = $("#g173-time"), distEl = $("#g173-dist");
    var G = { running: false, dist: 5, bat: 8, left: 40, dark: false, lit: false, timers: [], iv: null };
    var DIST_M = ["0", "2", "4", "7", "10", "14"];
    var sound = function (f, d, t, v) { S.tone(f, d, { type: t || "square", vol: v || 0.05, force: true }); };
    var hud = function () {
      batEl.innerHTML = "";
      for (var i = 0; i < 8; i++) batEl.innerHTML += '<i class="' + (i < G.bat ? "on" : "") + '"></i>';
      timeEl.textContent = "00:" + pad(Math.max(0, G.left));
      distEl.textContent = DIST_M[G.dist] + " m";
      stage.style.setProperty("--step", G.dist);
      lightBtn.disabled = !G.running;
    };
    var say = function (t, cls) { msg.className = "g173__msg" + (cls ? " " + cls : ""); msg.textContent = t; };
    var clear = function () { G.timers.forEach(clearTimeout); G.timers = []; clearInterval(G.iv); };
    var end = function (win) {
      G.running = false;
      clear();
      stage.classList.remove("is-dark", "is-lit");
      if (win) {
        stage.classList.add("is-win");
        say("Epsilon-11 est arrivée. Contact visuel maintenu jusqu'au bout. Exercice réussi.", "is-ok");
        S.stat("s173");
        sound(660, 0.15, "sine"); sound(990, 0.3, "sine");
      } else {
        stage.classList.add("is-dead");
        say("Crac. Le sujet D-9341 a cligné une fois de trop. Exercice échoué.", "is-ko");
        sound(70, 0.5, "sawtooth", 0.08);
      }
      startBtn.hidden = false;
      startBtn.textContent = "Recommencer l'exercice";
      hud();
    };
    var blackout = function () {
      if (!G.running) return;
      G.dark = true; G.lit = false;
      stage.classList.add("is-dark");
      sound(55, 0.12, "sawtooth", 0.04);
      var win = Math.max(520, 900 - (40 - G.left) * 8);
      G.timers.push(setTimeout(function () {
        if (!G.running) return;
        G.dark = false;
        stage.classList.remove("is-dark", "is-lit");
        if (!G.lit) {
          G.dist--;
          sound(120, 0.18, "sawtooth", 0.06);
          say(G.dist > 0 ? "Il a bougé. " + DIST_M[G.dist] + " mètres." : "", "is-ko");
          if (G.dist <= 0) { hud(); end(false); return; }
        } else {
          say("Contact visuel maintenu.", "is-ok");
        }
        hud();
        schedule();
      }, win));
    };
    var schedule = function () {
      var base = Math.max(700, 2600 - (40 - G.left) * 40);
      G.timers.push(setTimeout(blackout, base + Math.random() * 1400));
    };
    var light = function () {
      if (!G.running) return;
      if (G.bat <= 0) { say("Batterie vide.", "is-ko"); return; }
      G.bat--;
      sound(1800, 0.04, "square", 0.03);
      if (G.dark) {
        G.lit = true;
        stage.classList.add("is-lit");
      } else {
        say("Inutile : les lumières sont allumées. Charge gaspillée.", "is-warn");
      }
      hud();
    };
    startBtn.addEventListener("click", function () {
      clear();
      G = { running: true, dist: 5, bat: 8, left: 40, dark: false, lit: false, timers: [], iv: null };
      stage.classList.remove("is-win", "is-dead", "is-dark", "is-lit");
      startBtn.hidden = true;
      say("Garde les yeux sur la statue. Allume la lampe dès que le courant saute.");
      hud();
      stage.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      lightBtn.focus({ preventScroll: true });
      G.iv = setInterval(function () {
        G.left--;
        hud();
        if (G.left <= 0) end(true);
      }, 1000);
      schedule();
    });
    // Pointeur : réaction immédiate à l'appui. Clavier : Espace partout, Entrée sur le bouton.
    lightBtn.addEventListener("pointerdown", function (e) { e.preventDefault(); light(); });
    lightBtn.addEventListener("click", function (e) { e.preventDefault(); });
    doc.addEventListener("keydown", function (e) {
      if (!G.running || e.repeat) return;
      var space = e.code === "Space" || e.key === " ";
      var enter = e.key === "Enter" && e.target === lightBtn;
      if (!space && !enter) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      e.preventDefault();
      light();
    });
    hud();

    // --- Protocole de verrouillage
    var pads = $$("#simon .simon__pad"), sStart = $("#simon-start"), sLvl = $("#simon-lvl"), sBest = $("#simon-best"), sMsg = $("#simon-msg");
    var FREQ = [329.6, 392, 523.3, 659.3];
    var seq = [], pos = 0, accept = false, playingSeq = false;
    var best = function () { return S.carnet().stats.simon || 0; };
    var flash = function (i, dur) {
      var p = pads[i];
      p.classList.add("is-on");
      S.tone(FREQ[i], dur / 1000, { type: "triangle", vol: 0.07, force: true });
      setTimeout(function () { p.classList.remove("is-on"); }, dur);
    };
    var showSeq = function () {
      accept = false; playingSeq = true;
      sMsg.textContent = "Mémorise la séquence de verrouillage…";
      var speed = Math.max(260, 620 - seq.length * 28);
      seq.forEach(function (v, i) { setTimeout(function () { flash(v, speed * 0.7); }, 600 + i * speed); });
      setTimeout(function () {
        playingSeq = false; accept = true; pos = 0;
        sMsg.textContent = "À toi : reproduis la séquence.";
      }, 600 + seq.length * speed);
    };
    var nextRound = function () {
      seq.push(Math.floor(Math.random() * 4));
      sLvl.textContent = seq.length;
      showSeq();
    };
    var fail = function () {
      accept = false;
      var reached = seq.length - 1;
      S.stat("simon", reached, "max");
      sBest.textContent = best();
      sMsg.textContent = "Échec du verrouillage à la séquence " + seq.length + ". Brèche confirmée au sas " + "ABCD"[seq[pos]] + ".";
      $("#simon").classList.add("is-fail");
      setTimeout(function () { $("#simon").classList.remove("is-fail"); }, 700);
      S.tone(110, 0.5, { type: "sawtooth", vol: 0.07, force: true });
      sStart.hidden = false;
      sStart.textContent = "Recommencer";
    };
    pads.forEach(function (p, i) {
      p.addEventListener("click", function () {
        if (!accept || playingSeq) return;
        flash(i, 220);
        if (seq[pos] !== i) { fail(); return; }
        pos++;
        if (pos === seq.length) {
          accept = false;
          S.stat("simon", seq.length, "max");
          sBest.textContent = best();
          sMsg.textContent = "Séquence " + seq.length + " validée. Sas verrouillés.";
          setTimeout(nextRound, 900);
        }
      });
    });
    sStart.addEventListener("click", function () {
      seq = [];
      sStart.hidden = true;
      nextRound();
    });
    sBest.textContent = best();
  }

  /* ======================================================================
     CARNET DE SERVICE
     ====================================================================== */
  function carnetPage() {
    var root = $("#carnet-badges");
    if (!root) return;
    var fiche = null;
    try { fiche = JSON.parse(S.store.get("s73.fiche") || "null"); } catch (e) { fiche = null; }
    var card = $("#carnet-card");
    var info = S.renderIdCard(card, fiche || { prenom: "Visiteur", nom: "anonyme", dept: "classe-d", grade: "Sujet D-XXXX" });
    S.tiltCard($("#carnet-stage"), card);
    $("#carnet-who").innerHTML = fiche
      ? "<b>" + esc(info.fullName) + "</b> · " + esc(info.dept.nom) + " · " + esc(info.grade[0])
      : "Tu n'as pas encore de fiche. Le site t'a attribué un matricule de Classe-D en attendant.";
    var compte = $("#carnet-compte");
    var SRC = { role: "tes rôles Discord", staff: "l'administration du site", defaut: "le niveau par défaut des membres", admin: "ton statut d'administrateur", demo: "le mode démonstration" };
    var renderCompte = function () {
      if (!compte) return;
      var se = S.session();
      if (!se.user) {
        compte.innerHTML = '<p class="label">Compte</p><p>Tu consultes l\'intranet en visiteur (niveau 0).</p>' +
          (se.mode === "live" ? '<a class="btn btn--signal btn--sm" href="' + S.loginUrl() + '">' + S.icon.chat + "Se connecter avec Discord</a>"
            : '<div class="hero__cta"><button type="button" class="btn btn--signal btn--sm" data-demo-login>' + S.icon.chat + "Se connecter (démo)</button></div>");
        return;
      }
      compte.innerHTML = '<p class="label">Compte' + (se.mode === "live" ? " Discord" : " · démonstration") + "</p>" +
        '<div class="who">' + S.avatar(se.user) + "<div><b>" + esc(se.user.nom) + "</b><small>" + (se.admin ? "Administrateur" + (S.modeStaff() ? " · mode staff" : "") : "Membre du serveur") + "</small></div></div>" +
        "<p>Habilitation niveau <b>" + se.reel + "</b> (" + esc(S.habName(se.reel)) + "), attribuée par " + esc(SRC[se.source] || SRC.defaut) + ".</p>" +
        '<div class="hero__cta">' +
        (S.modeStaff() ? '<a class="btn btn--sm btn--signal" href="staff.html">Console staff</a>' : se.admin ? '<button type="button" class="btn btn--sm btn--signal" data-staff-on>Activer le mode staff</button>' : "") +
        (se.mode === "live" ? '<a class="btn btn--sm" href="/api/auth/logout">Se déconnecter</a>' : '<button type="button" class="btn btn--sm" data-demo-logout>Se déconnecter</button>') + "</div>";
    };
    doc.addEventListener("s73:session", renderCompte);
    renderCompte();

    var render = function () {
      var c = S.carnet();
      var n = U.count(c.badges), tot = D.distinctions.length;
      var seenN = D.scp.filter(function (s) { return c.seen[s.id]; }).length;
      var pagesN = S.pages.filter(function (p) { return c.pages[p.id]; }).length;
      var rulesN = D.reglement.filter(function (ch) { return c.rules[ch.id]; }).length;
      var planN = (D.evenements || []).filter(function (e) { return c.planning[e.id]; }).length;
      var st = c.stats;
      var stat = function (v, t, lbl) { return '<div class="stat"><b class="mono"><span data-compter>' + v + "</span>" + (t != null ? "<small>/" + t + "</small>" : "") + "</b><span>" + lbl + "</span></div>"; };
      $("#carnet-stats").innerHTML =
        stat(n, tot, "Distinctions") + stat(seenN, D.scp.length, "Dossiers consultés") + stat(pagesN, S.pages.length, "Pages visitées") +
        stat(rulesN, D.reglement.length, "Chapitres lus") + stat(st.exam || 0, D.quiz.length, "Meilleur examen") + stat(st.breach || 0, null, "Brèches simulées") +
        stat(st.x914 || 0, null, "Expériences SCP-914") + stat(st.simon || 0, null, "Meilleure séquence") + stat(st.s173 || 0, null, "Survies à SCP-173") +
        stat(planN, null, "Événements au planning");
      $("#carnet-progress").style.width = (n / tot) * 100 + "%";

      root.innerHTML = D.distinctions.map(function (b) {
        var got = c.badges[b.id];
        var hidden = b.secret && !got;
        return '<div class="badge' + (got ? " is-got" : "") + '"><span class="badge__medal" aria-hidden="true">' + (hidden ? "?" : esc(b.code)) + "</span>" +
          '<span class="badge__name">' + (hidden ? "Distinction secrète" : esc(b.nom)) + "</span>" +
          '<span class="badge__txt">' + (hidden ? "Continue d'explorer l'intranet…" : esc(b.texte)) + "</span>" +
          '<span class="badge__date">' + (got ? "Obtenue le " + esc(U.fmtDate(new Date(got).toISOString())) : "Verrouillée") + "</span></div>";
      }).join("");

      $("#carnet-seen").innerHTML = D.scp.map(function (s) {
        var on = c.seen[s.id], fav = c.fav[s.id];
        return '<button type="button" class="seen' + (on ? " is-on" : "") + '" data-open="' + esc(s.id) + '" style="--c: var(--c-' + s.classe + ')" title="' + esc(s.code + " · " + s.nom) + '">' +
          (fav ? '<i aria-hidden="true">★</i>' : "") + "<b>" + esc(/^\d+$/.test(s.id) ? s.id : s.id.replace("ANO-73-", "A")) + '</b><span class="sr-only">' + esc(s.code) + (on ? ", consulté" : ", non consulté") + "</span></button>";
      }).join("");

      var plan = (D.evenements || []).filter(function (e) { return c.planning[e.id]; });
      $("#carnet-planning").innerHTML = plan.length ? plan.map(function (e) {
        var ms = new Date(e.date).getTime() - Date.now();
        return '<li><a href="evenements.html#evt-' + e.id + '"><b>' + esc(e.titre) + "</b><span>" + esc(S.fmtEvent(e.date)) + "</span></a><span class=\"mono\">" + (ms > 0 ? "dans " + S.formatCountdown(ms) : "passé") + "</span></li>";
      }).join("") : '<li class="muted">Aucun événement dans ton planning. <a class="link" href="evenements.html">Voir le calendrier</a></li>';
    };
    $("#carnet-seen").addEventListener("click", function (e) {
      var b = e.target.closest("[data-open]");
      if (b) S.openDossier(b.getAttribute("data-open"));
    });
    doc.addEventListener("s73:carnet", render);
    render();

    // Réglages
    var setBox = $("#carnet-settings");
    var SETTINGS = [
      ["fx", "Effets visuels", "Grain, grille et halo d'alerte en arrière-plan."],
      ["sfx", "Sons d'interface", "Bips discrets, portes blindées et fanfare des distinctions."],
      ["boot", "Séquence de démarrage", "Écran de connexion au premier chargement de chaque session."]
    ];
    setBox.innerHTML = SETTINGS.map(function (s) {
      var on = S.getSetting(s[0]);
      return '<div class="setting"><div><b id="set-' + s[0] + '">' + s[1] + "</b><span>" + s[2] + "</span></div>" +
        '<button type="button" class="switch" role="switch" aria-checked="' + on + '" aria-labelledby="set-' + s[0] + '" data-set="' + s[0] + '"><i></i></button></div>';
    }).join("") +
      '<div class="setting"><div><b id="set-motion">Animations</b><span data-motion-txt></span></div>' +
      '<div class="seg" role="radiogroup" aria-labelledby="set-motion">' + [["auto", "Système"], ["on", "Activées"], ["off", "Réduites"]].map(function (x) {
        return '<button type="button" role="radio" data-motion="' + x[0] + '" aria-checked="' + (S.getMotion() === x[0]) + '" style="--c: var(--signal)">' + x[1] + "</button>";
      }).join("") + "</div></div>" +
      '<div class="setting"><div><b>Réinitialiser mon carnet</b><span>Efface distinctions, dossiers lus, suivis et planning sur cet appareil.</span></div>' +
      '<div class="setting__act"><button type="button" class="btn btn--sm btn--danger" data-reset>Réinitialiser</button></div></div>';
    var motionTxt = function () {
      var el = $("[data-motion-txt]", setBox);
      if (el) el.textContent = "Défilement, rotations, transitions et portes blindées." +
        (S.systemeReduit() ? " Ton appareil demande moins d'animations : « Système » les coupe." : " « Système » suit le réglage de ton appareil.");
    };
    motionTxt();
    setBox.addEventListener("click", function (e) {
      var mo = e.target.closest("[data-motion]");
      if (mo) {
        S.setMotion(mo.getAttribute("data-motion"));
        $$("[data-motion]", setBox).forEach(function (b) { b.setAttribute("aria-checked", String(b === mo)); });
        S.toast("<b>Animations : " + mo.textContent.toLowerCase() + ".</b>");
        return;
      }
      var sw = e.target.closest("[data-set]");
      if (sw) {
        var k = sw.getAttribute("data-set"), on = sw.getAttribute("aria-checked") !== "true";
        S.setSetting(k, on);
        sw.setAttribute("aria-checked", String(on));
        if (k === "sfx" && on) S.sfx("ok");
        return;
      }
      var act = e.target.closest(".setting__act");
      if (e.target.closest("[data-reset]")) {
        act.innerHTML = '<span class="muted">Confirmer ?</span><button type="button" class="btn btn--sm btn--danger" data-reset-yes>Oui, tout effacer</button><button type="button" class="btn btn--sm" data-reset-no>Annuler</button>';
        $("[data-reset-no]", act).focus();
        return;
      }
      if (e.target.closest("[data-reset-yes]")) {
        S.resetCarnet();
        act.innerHTML = '<button type="button" class="btn btn--sm btn--danger" data-reset>Réinitialiser</button>';
        S.toast("<b>Carnet réinitialisé.</b> Toutes tes distinctions ont été effacées.");
        return;
      }
      if (e.target.closest("[data-reset-no]")) {
        act.innerHTML = '<button type="button" class="btn btn--sm btn--danger" data-reset>Réinitialiser</button>';
      }
    });
  }

  /* ---------- Lancement de tous les modules ------------------------ */
  var lancer = function () {
    (S.pageModules || []).concat([evenements, protocoles, laboratoire, entrainement, carnetPage, S.staffModule]).forEach(function (fn) {
      if (typeof fn !== "function") return;
      try { fn(); } catch (e) { if (window.console) console.error("[Site-73] " + (fn.name || "module"), e); }
    });
    if (S.ready) S.ready();
  };
  if (S.donneesPretes && S.donneesPretes.then) S.donneesPretes.then(lancer, lancer); else lancer();
})();

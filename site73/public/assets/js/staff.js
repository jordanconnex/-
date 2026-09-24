/* ==========================================================================
   SITE-73 · CONSOLE STAFF
   Mode à part : un sas d'accès, puis une console à onglets. Il faut être
   administrateur (rôle Discord en ligne, code d'accès en démonstration)
   et activer le mode staff. Toutes les actions passent par S.api : le
   serveur (/api/staff) vérifie la session Discord à chaque appel.
   En mode démonstration, un faux serveur local répond à sa place.
   ========================================================================== */
(function () {
  "use strict";

  var S = window.S73, D = S.data, doc = document;
  var U = S.util, esc = U.esc, norm = U.norm;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  var dtFmt;
  try { dtFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: D.config.fuseau, dateStyle: "short", timeStyle: "short" }); }
  catch (e) { dtFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }); }
  var quand = function (iso) { return iso ? dtFmt.format(new Date(iso)) : "—"; };
  var SOURCE = {
    admin: ["Administrateur", "var(--signal)"],
    staff: ["Réglée par le staff", "var(--c-attente)"],
    role: ["Rôle Discord", "var(--c-sur)"],
    defaut: ["Par défaut", "var(--text-3)"]
  };

  S.staffModule = function () {
    var app = $("#staff-app");
    if (!app) return;
    var guard = $("#staff-guard");
    var etat = null, filtre = { q: "", niveau: "all" }, confirmer = null;

    /* ---------- Sas d'accès ------------------------------------------ */
    var sasBody = $("#staff-guard-body");
    var minuteurBlocage = null;
    var renderGuard = function () {
      var se = S.session();
      clearInterval(minuteurBlocage);
      guard.classList.remove("is-refus");
      if (se.mode === "live") {
        if (!se.user) {
          sasBody.innerHTML = '<p class="sas__etat"><i></i>Identité inconnue</p>' +
            "<p>Connecte-toi avec ton compte Discord. Seuls les membres qui ont un rôle d'administrateur sur le serveur franchissent ce sas.</p>" +
            '<a class="btn btn--signal" href="' + S.loginUrl() + '">' + S.icon.chat + "Se connecter avec Discord</a>";
        } else if (!se.admin) {
          guard.classList.add("is-refus");
          sasBody.innerHTML = '<p class="sas__etat sas__etat--refus"><i></i>Accès refusé</p>' +
            "<p>Ton compte <b>" + esc(se.user.nom) + "</b> n'a pas le rôle d'administrateur sur le serveur Discord. Tu peux consulter l'intranet selon ton habilitation (niveau " + se.reel + ").</p>" +
            '<a class="btn" href="index.html">Retour à l\'intranet</a>';
        } else {
          sasBody.innerHTML = '<p class="sas__etat sas__etat--ok"><i></i>Identité vérifiée par Discord</p>' +
            '<div class="who">' + S.avatar(se.user) + "<div><b>" + esc(se.user.nom) + "</b><small>Administrateur du serveur</small></div></div>" +
            "<p>Active le mode staff pour ouvrir la console et afficher les commandes du staff sur tout le site.</p>" +
            '<button type="button" class="btn btn--signal" data-staff-on>' + S.icon.shield + "Activer le mode staff</button>";
        }
        return;
      }
      if (se.admin) {
        sasBody.innerHTML = '<p class="sas__etat sas__etat--ok"><i></i>Code vérifié</p>' +
          '<button type="button" class="btn btn--signal" data-staff-on>' + S.icon.shield + "Activer le mode staff</button>";
        return;
      }
      sasBody.innerHTML = '<p class="sas__etat"><i></i>Vérification requise</p>' +
        '<form class="sas__form" id="sas-form" autocomplete="off">' +
          '<label class="field"><span>Nom de code <small>(journal)</small></span><input class="input" id="sas-nom" maxlength="40" placeholder="Dr Varenne"></label>' +
          '<label class="field"><span>Code d\'accès staff</span><input class="input sas__code" id="sas-code" type="password" required autocomplete="off" spellcheck="false"></label>' +
          '<div class="sas__actions"><button type="submit" class="btn btn--signal" id="sas-ok">' + S.icon.lock + "Vérifier</button></div>" +
          '<p class="sas__msg" id="sas-msg" role="status" aria-live="polite"></p>' +
        "</form>" +
        '<p class="sas__note">Site hors ligne (démonstration) : l\'accès staff est protégé par un code, qui se règle dans <code>config.codeStaff</code>. En ligne, il passe par les rôles administrateur Discord, vérifiés par le serveur.</p>';
      var form = $("#sas-form"), msg = $("#sas-msg"), ok = $("#sas-ok"), code = $("#sas-code");
      var bloquer = function () {
        var reste = S.blocageStaff();
        ok.disabled = !!reste;
        code.disabled = !!reste;
        if (reste) msg.textContent = "Trop d'essais. Réessaie dans " + Math.ceil(reste / 1000) + " s.";
        else { clearInterval(minuteurBlocage); if (/Trop d'essais|bloqué/.test(msg.textContent)) msg.textContent = ""; }
      };
      if (S.blocageStaff()) { bloquer(); minuteurBlocage = setInterval(bloquer, 500); }
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        ok.disabled = true;
        guard.classList.add("is-verif");
        S.sfx("tick");
        setTimeout(function () {
          guard.classList.remove("is-verif");
          var r = S.connexionStaffDemo($("#sas-nom").value, code.value);
          if (r.ok) return;
          ok.disabled = false;
          code.value = "";
          msg.textContent = r.message;
          guard.classList.remove("is-refus");
          void guard.offsetWidth;
          guard.classList.add("is-refus");
          S.sfx("deny");
          if (r.bloque) { bloquer(); minuteurBlocage = setInterval(bloquer, 500); }
          else code.focus();
        }, 650);
      });
    };

    /* ---------- Onglets de la console -------------------------------- */
    var TITRES = { tableau: "Tableau de bord", alerte: "Niveau d'alerte", membres: "Habilitations", communiques: "Communiqués", evenements: "Événements", journal: "Journal des actions" };
    var onglet = S.store.get("s73.console", true) || "tableau";
    if (!TITRES[onglet]) onglet = "tableau";
    var nav = $("#cons-nav");
    var placerInd = function () {
      var b = $('[aria-selected="true"]', nav), ind = $(".cons__ind", nav);
      if (!b || !ind) return;
      var vertical = getComputedStyle(nav).flexDirection === "column";
      ind.style.transform = vertical ? "translateY(" + b.offsetTop + "px)" : "translateX(" + b.offsetLeft + "px)";
      ind.style[vertical ? "height" : "width"] = (vertical ? b.offsetHeight : b.offsetWidth) + "px";
      ind.style[vertical ? "width" : "height"] = "";
      if (!vertical && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = b.offsetLeft - nav.clientWidth / 2 + b.offsetWidth / 2;
    };
    var ouvrir = function (id, focus) {
      if (!TITRES[id]) return;
      onglet = id;
      S.store.set("s73.console", id, true);
      $$("[data-onglet]", nav).forEach(function (b) {
        var on = b.getAttribute("data-onglet") === id;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      $$("[data-panneau]").forEach(function (p) { p.hidden = p.getAttribute("data-panneau") !== id; });
      var titre = $("#cons-title");
      titre.textContent = TITRES[id];
      titre.classList.remove("is-anim");
      void titre.offsetWidth;
      titre.classList.add("is-anim");
      placerInd();
      var panneau = $('[data-panneau="' + id + '"]');
      if (panneau && S.animer) S.animer(panneau);
      S.sfx("tick");
    };
    nav.addEventListener("click", function (e) {
      var b = e.target.closest("[data-onglet]");
      if (b) ouvrir(b.getAttribute("data-onglet"));
    });
    nav.addEventListener("keydown", function (e) {
      var ids = Object.keys(TITRES), i = ids.indexOf(onglet);
      var k = e.key;
      if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); ouvrir(ids[(i + 1) % ids.length], true); }
      else if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); ouvrir(ids[(i - 1 + ids.length) % ids.length], true); }
      else if (k === "Home") { e.preventDefault(); ouvrir(ids[0], true); }
      else if (k === "End") { e.preventDefault(); ouvrir(ids[ids.length - 1], true); }
    });
    app.addEventListener("click", function (e) {
      var r = e.target.closest("[data-aller]");
      if (r) { ouvrir(r.getAttribute("data-aller")); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
    window.addEventListener("resize", placerInd);

    var charger = function () {
      if (!S.modeStaff()) {
        app.hidden = true;
        guard.hidden = false;
        renderGuard();
        return;
      }
      var ouverture = app.hidden;
      guard.hidden = true;
      app.hidden = false;
      var se = S.session();
      $("#cons-who").innerHTML = '<span class="cons__badge"><i></i>Mode staff</span><div class="who">' + S.avatar(se.user) + "<div><b>" + esc(se.user ? se.user.nom : "Staff") + "</b><small>Administrateur · " + (se.mode === "live" ? "Discord" : "démo") + "</small></div></div>";
      ouvrir(onglet);
      // Le focus était dans le sas, qui vient de disparaître.
      if (ouverture) { var tb = $('[aria-selected="true"]', nav); if (tb) tb.focus({ preventScroll: true }); }
      $("#st-loading").hidden = false;
      $("#st-loading").textContent = "Chargement des données du staff…";
      S.api.etat().then(function (e) {
        etat = e;
        $("#st-loading").hidden = true;
        render();
        S.animer(app);
      }, function (err) {
        $("#st-loading").textContent = "Chargement impossible : " + err.message;
      });
    };

    var agir = function (action, corps, message, bouton) {
      if (bouton) bouton.disabled = true;
      return S.api.action(action, corps).then(function (e) {
        etat = e;
        render();
        S.toast(message);
        S.sfx("ok");
        S.rafraichirContenu(action);
        return true;
      }, function (err) {
        S.toast("<b>Action refusée.</b> " + esc(err.message), { warn: true });
        S.sfx("deny");
        return false;
      }).then(function (ok) {
        if (bouton) bouton.disabled = false;
        return ok;
      });
    };

    /* ---------- Rendu --------------------------------------------------- */
    var render = function () {
      if (!etat) return;
      renderTableau();
      renderResume();
      renderAlerte();
      renderMembres();
      renderCommuniques();
      renderEvenements();
      renderJournal();
    };

    var renderResume = function () {
      var par = [0, 0, 0, 0, 0, 0];
      etat.membres.forEach(function (m) { par[m.habilitation]++; });
      var total = etat.membres.length || 1;
      $("#st-resume").innerHTML =
        '<div class="stat"><b class="mono" data-compter>' + etat.membres.length + "</b><span>Membres connus</span></div>" +
        '<div class="stat"><b class="mono" data-compter>' + etat.membres.filter(function (m) { return m.admin; }).length + "</b><span>Administrateurs</span></div>" +
        '<div class="stat"><b class="mono" data-compter>' + etat.membres.filter(function (m) { return m.override !== null && !m.admin; }).length + "</b><span>Réglés par le staff</span></div>" +
        '<div class="stat st-repart"><span>Répartition par habilitation</span><div class="stack" aria-hidden="true">' + par.map(function (n, i) {
          return n ? '<i style="--c:' + S.levelColors[i] + ";flex:" + n / total + '" title="Niveau ' + i + " : " + n + '"></i>' : "";
        }).join("") + '</div><ul class="legend">' + par.map(function (n, i) {
          return n ? '<li style="--c:' + S.levelColors[i] + '">N' + i + " · " + n + "</li>" : "";
        }).join("") + "</ul></div>";
    };

    var renderTableau = function () {
      var cur = etat.etat.alerte, A = D.alertes[cur];
      $$("[data-cons-alerte]").forEach(function (el) { el.textContent = A.code.replace("Code ", ""); el.style.setProperty("--c", "var(--a-" + cur + ")"); });
      var n = { membres: etat.membres.length, communiques: etat.communiques.length, evenements: etat.evenements.filter(function (e) { return new Date(e.date).getTime() + e.duree * 60000 > Date.now(); }).length };
      $$("[data-cons-count]").forEach(function (el) { el.textContent = n[el.getAttribute("data-cons-count")]; });
      $("#st-dash-alerte").style.setProperty("--c", "var(--a-" + cur + ")");
      $("#st-dash-alerte").innerHTML = '<p class="label">Alerte officielle</p><p class="cons__alerte">' + esc(A.code) + "</p><p>" + esc(A.titre) + ".</p>" +
        (etat.etat.par ? '<p class="muted">Réglée par ' + esc(etat.etat.par) + " · " + esc(quand(etat.etat.le)) + "</p>" : '<p class="muted">Valeur du fichier de contenu.</p>') +
        '<button type="button" class="btn btn--sm" data-aller="alerte">Changer</button>';
      var proch = etat.evenements.filter(function (e) { return new Date(e.date).getTime() + e.duree * 60000 > Date.now(); })
        .sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).slice(0, 4);
      $("#st-dash-evt").innerHTML = proch.length ? proch.map(function (e) {
        var T = D.typesEvenement[e.type] || D.typesEvenement.evenement;
        return '<li><i style="--c:' + T.couleur + '"></i><span><b>' + esc(e.titre) + "</b><small>" + esc(S.fmtEvent(e.date)) + "</small></span></li>";
      }).join("") : '<li class="muted">Aucun événement à venir.</li>';
      $("#st-dash-journal").innerHTML = etat.journal.length ? etat.journal.slice(0, 5).map(function (j) {
        return "<li><i></i><span><b>" + esc(j.par) + "</b> · " + esc(j.action) + "<small>" + esc(quand(j.le)) + "</small></span></li>";
      }).join("") : '<li class="muted">Aucune action enregistrée.</li>';
    };

    var renderAlerte = function () {
      var cur = etat.etat.alerte;
      $("#st-alerte-seg").innerHTML = S.alerts.map(function (a) {
        return '<button type="button" role="radio" data-alerte="' + a + '" aria-checked="' + (a === cur) + '" style="--c: var(--a-' + a + ')">' + esc(D.alertes[a].code) + "</button>";
      }).join("");
      $("#st-alerte-jauge").innerHTML = S.alerts.map(function (a, i) {
        return '<i class="' + (S.alerts.indexOf(cur) >= i ? "is-on" : "") + '" style="--c: var(--a-' + a + ")\"></i>";
      }).join("");
      $("#st-alerte-info").innerHTML = "<b>" + esc(D.alertes[cur].code) + " · " + esc(D.alertes[cur].titre) + ".</b> " + esc(D.alertes[cur].texte) +
        (etat.etat.par ? '<br><span class="muted">Réglé par ' + esc(etat.etat.par) + " le " + esc(quand(etat.etat.le)) + ".</span>" : '<br><span class="muted">Valeur de départ du fichier de contenu.</span>');
    };

    var renderMembres = function () {
      var q = norm(filtre.q.trim());
      var liste = etat.membres.filter(function (m) {
        if (filtre.niveau !== "all" && String(m.habilitation) !== filtre.niveau) return false;
        return !q || norm(m.nom + " " + (m.pseudo || "") + " " + m.id).indexOf(q) >= 0;
      });
      $("#st-membres-count").textContent = liste.length + " membre" + (liste.length > 1 ? "s" : "") + " affiché" + (liste.length > 1 ? "s" : "") + " sur " + etat.membres.length;
      var body = $("#st-membres");
      if (!liste.length) {
        body.innerHTML = '<tr><td colspan="5" class="muted">' + (etat.membres.length ? "Aucun membre ne correspond." : "Aucun membre pour l'instant. Les membres apparaissent ici après leur première connexion avec Discord.") + "</td></tr>";
        return;
      }
      body.innerHTML = liste.map(function (m) {
        var src = SOURCE[m.source] || SOURCE.defaut;
        var select = m.admin
          ? '<span class="mono">5 · ' + esc(S.habName(5)) + "</span>"
          : '<select class="select st-hab" data-id="' + esc(m.id) + '" aria-label="Habilitation de ' + esc(m.nom) + '">' +
            D.habilitations.map(function (h) {
              return '<option value="' + h.niveau + '"' + (h.niveau === m.habilitation ? " selected" : "") + ">" + h.niveau + " · " + esc(h.nom) + "</option>";
            }).join("") + "</select>";
        return "<tr>" +
          '<td><div class="who">' + S.avatar(m) + "<div><b>" + esc(m.nom) + "</b><small>" + esc(m.pseudo ? "@" + m.pseudo : m.id) + "</small></div></div></td>" +
          "<td>" + select + "</td>" +
          '<td><span class="chip" style="--c:' + src[1] + '">' + src[0] + "</span>" +
            (m.source === "staff" && m.modifiePar ? '<small class="st-by">par ' + esc(m.modifiePar) + ", " + esc(quand(m.modifieLe)) + "</small>" : "") +
            (m.source === "staff" && m.roleHab !== null ? '<small class="st-by">rôle Discord : niveau ' + m.roleHab + "</small>" : "") + "</td>" +
          '<td class="mono st-date">' + esc(quand(m.derniereVisite)) + "</td>" +
          "<td>" + (m.override !== null && !m.admin ? '<button type="button" class="btn btn--sm" data-reset="' + esc(m.id) + '">Rendre au rôle</button>' : "") + "</td></tr>";
      }).join("");
    };

    var niveauLabel = function (n) { return n ? "Habilitation " + n + " et plus" : "Tout le monde"; };
    var renderCommuniques = function () {
      var el = $("#st-comm-list");
      el.innerHTML = etat.communiques.length ? etat.communiques.map(function (c) {
        return '<li class="st-item"><div><b>' + esc(c.titre) + "</b><small>" + esc(U.fmtDate(c.date)) + " · " + esc(c.auteur || "") + " · " + esc(niveauLabel(c.niveau || 0)) + "</small>" +
          '<p class="st-extrait">' + esc(c.texte.replace(/\[\[(\d)\|([\s\S]*?)\]\]/g, "[N$1 : $2]").slice(0, 160)) + "</p></div>" +
          '<div class="st-acts"><button type="button" class="btn btn--sm btn--danger" data-del-comm="' + esc(c.id) + '">' + (confirmer === "c" + c.id ? "Confirmer" : "Supprimer") + "</button></div></li>";
      }).join("") : '<li class="muted">Aucun communiqué publié depuis l\'espace staff. Les communiqués du fichier de contenu restent affichés.</li>';
    };

    var renderEvenements = function () {
      var el = $("#st-evt-list");
      var maintenant = Date.now();
      el.innerHTML = etat.evenements.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).map(function (e) {
        var passe = new Date(e.date).getTime() + e.duree * 60000 < maintenant;
        var T = D.typesEvenement[e.type] || D.typesEvenement.evenement;
        return '<li class="st-item' + (passe ? " is-past" : "") + '"><div><b>' + esc(e.titre) + "</b><small>" + esc(S.fmtEvent(e.date)) + " · " + e.duree + " min · " + esc(e.lieu || "—") + "</small>" +
          '<span class="chip" style="--c:' + T.couleur + '">' + esc(T.nom) + (passe ? " · terminé" : "") + "</span></div>" +
          '<div class="st-acts"><button type="button" class="btn btn--sm" data-edit-evt="' + esc(e.id) + '">Modifier</button>' +
          '<button type="button" class="btn btn--sm btn--danger" data-del-evt="' + esc(e.id) + '">' + (confirmer === "e" + e.id ? "Confirmer" : "Supprimer") + "</button></div></li>";
      }).join("") || '<li class="muted">Aucun événement.</li>';
    };

    var renderJournal = function () {
      $("#st-journal").innerHTML = etat.journal.length ? etat.journal.map(function (j) {
        return '<li><time class="mono">' + esc(quand(j.le)) + "</time><span><b>" + esc(j.par) + "</b> · " + esc(j.action) + "</span></li>";
      }).join("") : '<li class="muted">Aucune action enregistrée.</li>';
    };

    /* ---------- Interactions ------------------------------------------- */
    // Niveau d'alerte
    var alerteChoisie = null;
    $("#st-alerte-seg").addEventListener("click", function (e) {
      var b = e.target.closest("[data-alerte]");
      if (!b) return;
      alerteChoisie = b.getAttribute("data-alerte");
      $$("button", this).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
      $("#st-alerte-apply").disabled = alerteChoisie === etat.etat.alerte;
    });
    $("#st-alerte-apply").addEventListener("click", function () {
      if (!alerteChoisie) return;
      var btn = this;
      agir("alerte", { niveau: alerteChoisie }, "<b>Niveau d'alerte appliqué à tout le site :</b> " + esc(D.alertes[alerteChoisie].code) + ".", btn).then(function () { btn.disabled = true; });
    });

    // Membres
    $("#st-q").addEventListener("input", function () { filtre.q = this.value; renderMembres(); });
    $("#st-niveau").addEventListener("change", function () { filtre.niveau = this.value; renderMembres(); });
    $("#st-membres").addEventListener("change", function (e) {
      var sel = e.target.closest(".st-hab");
      if (!sel) return;
      var m = etat.membres.filter(function (x) { return x.id === sel.getAttribute("data-id"); })[0];
      agir("habilitation", { id: m.id, niveau: parseInt(sel.value, 10) }, "<b>" + esc(m.nom) + "</b> passe au niveau " + sel.value + " (" + esc(S.habName(+sel.value)) + ").", sel);
    });
    $("#st-membres").addEventListener("click", function (e) {
      var b = e.target.closest("[data-reset]");
      if (!b) return;
      var m = etat.membres.filter(function (x) { return x.id === b.getAttribute("data-reset"); })[0];
      agir("habilitation", { id: m.id, niveau: null }, "<b>" + esc(m.nom) + "</b> retrouve l'habilitation de ses rôles Discord.", b);
    });

    // Communiqués
    var cf = $("#st-comm-form");
    cf.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("button[type=submit]", cf);
      agir("communique.ajouter", { titre: $("#st-comm-titre").value, texte: $("#st-comm-texte").value, niveau: parseInt($("#st-comm-niveau").value, 10) },
        "<b>Communiqué publié.</b> Il apparaît sur l'accueil et dans les archives.", btn).then(function (ok) { if (ok) cf.reset(); });
    });
    $("#st-comm-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-del-comm]");
      if (!b) return;
      var id = b.getAttribute("data-del-comm");
      if (confirmer !== "c" + id) { confirmer = "c" + id; renderCommuniques(); setTimeout(function () { if (confirmer === "c" + id) { confirmer = null; renderCommuniques(); } }, 4000); return; }
      confirmer = null;
      agir("communique.supprimer", { id: id }, "<b>Communiqué supprimé.</b>", b);
    });

    // Événements
    var ef = $("#st-evt-form");
    var typeSel = $("#st-evt-type");
    typeSel.innerHTML = Object.keys(D.typesEvenement).map(function (k) { return '<option value="' + k + '">' + esc(D.typesEvenement[k].nom) + "</option>"; }).join("");
    var modeEdition = function (ev) {
      $("#st-evt-id").value = ev ? ev.id : "";
      $("#st-evt-titre").value = ev ? ev.titre : "";
      typeSel.value = ev ? ev.type : "evenement";
      $("#st-evt-date").value = ev ? ev.date.slice(0, 16) : "";
      $("#st-evt-duree").value = ev ? ev.duree : 120;
      $("#st-evt-lieu").value = ev ? ev.lieu || "" : "";
      $("#st-evt-texte").value = ev ? ev.texte || "" : "";
      $("#st-evt-submit").textContent = ev ? "Enregistrer les modifications" : "Ajouter l'événement";
      $("#st-evt-cancel").hidden = !ev;
      $("#st-evt-mode").textContent = ev ? "Modification : " + ev.titre : "Nouvel événement";
    };
    ef.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = $("#st-evt-id").value;
      agir("evenement.enregistrer", {
        id: id || undefined, titre: $("#st-evt-titre").value, type: typeSel.value, date: $("#st-evt-date").value,
        duree: parseInt($("#st-evt-duree").value, 10), lieu: $("#st-evt-lieu").value, texte: $("#st-evt-texte").value
      }, id ? "<b>Événement modifié.</b>" : "<b>Événement ajouté</b> au calendrier.", $("#st-evt-submit")).then(function (ok) { if (ok) modeEdition(null); });
    });
    $("#st-evt-cancel").addEventListener("click", function () { modeEdition(null); });
    $("#st-evt-list").addEventListener("click", function (e) {
      var ed = e.target.closest("[data-edit-evt]");
      if (ed) {
        modeEdition(etat.evenements.filter(function (x) { return x.id === ed.getAttribute("data-edit-evt"); })[0]);
        ef.scrollIntoView({ behavior: "smooth", block: "start" });
        $("#st-evt-titre").focus({ preventScroll: true });
        return;
      }
      var b = e.target.closest("[data-del-evt]");
      if (!b) return;
      var id = b.getAttribute("data-del-evt");
      if (confirmer !== "e" + id) { confirmer = "e" + id; renderEvenements(); setTimeout(function () { if (confirmer === "e" + id) { confirmer = null; renderEvenements(); } }, 4000); return; }
      confirmer = null;
      agir("evenement.supprimer", { id: id }, "<b>Événement supprimé.</b>", b);
    });
    modeEdition(null);

    doc.addEventListener("s73:session", charger);
    charger();
  };
})();

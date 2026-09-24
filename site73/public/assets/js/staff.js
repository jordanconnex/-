/* ==========================================================================
   SITE-73 · ESPACE STAFF
   Réservé aux administrateurs. Toutes les actions passent par S.api :
   le serveur (/api/staff) vérifie la session Discord à chaque appel.
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

    /* ---------- Garde d'accès ---------------------------------------- */
    var renderGuard = function () {
      var se = S.session();
      $("#staff-guard-body").innerHTML = se.mode === "live"
        ? (se.user
          ? "<p>Ton compte <b>" + esc(se.user.nom) + "</b> n'a pas le rôle d'administrateur sur le serveur Discord.</p>"
          : '<p>Connecte-toi avec ton compte Discord. Seuls les membres qui ont un rôle d\'administrateur sur le serveur accèdent à cet espace.</p><a class="btn btn--signal" href="' + S.loginUrl() + '">' + S.icon.chat + "Se connecter avec Discord</a>")
        : '<p>Mode démonstration : ouvre le menu <b>« Hab. »</b> en haut de page et choisis le profil <b>Admin</b> pour essayer l\'espace staff.</p><button type="button" class="btn btn--signal" data-demo-admin>Passer en profil Admin</button>';
    };
    guard.addEventListener("click", function (e) { if (e.target.closest("[data-demo-admin]")) S.setDemoProfil("admin"); });

    var charger = function () {
      if (!S.isAdmin()) {
        app.hidden = true;
        guard.hidden = false;
        renderGuard();
        return;
      }
      guard.hidden = true;
      app.hidden = false;
      $("#st-loading").hidden = false;
      S.api.etat().then(function (e) {
        etat = e;
        $("#st-loading").hidden = true;
        render();
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
        '<div class="stat"><b class="mono">' + etat.membres.length + "</b><span>Membres connus</span></div>" +
        '<div class="stat"><b class="mono">' + etat.membres.filter(function (m) { return m.admin; }).length + "</b><span>Administrateurs</span></div>" +
        '<div class="stat"><b class="mono">' + etat.membres.filter(function (m) { return m.override !== null && !m.admin; }).length + "</b><span>Réglés par le staff</span></div>" +
        '<div class="stat st-repart"><span>Répartition par habilitation</span><div class="stack" aria-hidden="true">' + par.map(function (n, i) {
          return n ? '<i style="--c:' + S.levelColors[i] + ";flex:" + n / total + '" title="Niveau ' + i + " : " + n + '"></i>' : "";
        }).join("") + '</div><ul class="legend">' + par.map(function (n, i) {
          return n ? '<li style="--c:' + S.levelColors[i] + '">N' + i + " · " + n + "</li>" : "";
        }).join("") + "</ul></div>";
    };

    var renderAlerte = function () {
      var cur = etat.etat.alerte;
      $("#st-alerte-seg").innerHTML = S.alerts.map(function (a) {
        return '<button type="button" role="radio" data-alerte="' + a + '" aria-checked="' + (a === cur) + '" style="--c: var(--a-' + a + ')">' + esc(D.alertes[a].code) + "</button>";
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

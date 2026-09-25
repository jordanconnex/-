// GET /api/contenu : session du visiteur + contenu caviardé selon SON habilitation.
import { json, env, lireDynamique, contenuPour } from "../commun.mjs";
import { membreConnecte, habilitationPourMembre, estAdmin, estPrincipal } from "../comptes.mjs";

export default async function contenu(req) {
  // Sans stockage, le site reste lisible (contenu de départ) : /api/etat dit quoi corriger
  let membre = null, dyn = { etat: null, communiques: [], evenements: null }, stockageOk = true;
  try {
    [membre, dyn] = await Promise.all([membreConnecte(req), lireDynamique()]);
  } catch (e) {
    stockageOk = false;
    console.error("Site-73 : stockage indisponible :", e.message);
  }
  const hab = membre ? habilitationPourMembre(membre) : { niveau: 0, source: "visiteur" };
  return json({
    mode: "live",
    session: membre
      ? {
          id: membre.id, nom: membre.nom, admin: estAdmin(membre), principal: estPrincipal(membre),
          habilitation: hab.niveau, source: hab.source, fiche: membre.fiche || null, mdpProvisoire: !!membre.mdpProvisoire
        }
      : null,
    // La page de connexion n'affiche le champ « code d'inscription » que s'il est demandé
    comptes: { codeInscription: !!env("CODE_INSCRIPTION") },
    data: contenuPour(hab.niveau, dyn),
    ...(stockageOk ? {} : { avertissement: "Stockage indisponible : voir /api/etat" })
  });
}

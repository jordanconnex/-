// GET /api/contenu : session du visiteur + contenu caviardé selon SON habilitation.
import { json, lireSession, lireMembre, habilitationPourMembre, estAdmin, lireDynamique, contenuPour } from "../commun.mjs";

export default async function contenu(req) {
  const session = await lireSession(req);
  // Sans stockage KV, le site reste lisible (contenu de départ) : /api/etat dit quoi corriger
  let membre = null, dyn = { etat: null, communiques: [], evenements: null }, stockageOk = true;
  try {
    [membre, dyn] = await Promise.all([session ? lireMembre(session.id) : null, lireDynamique()]);
  } catch (e) {
    stockageOk = false;
    console.error("Site-73 : stockage indisponible :", e.message);
  }
  const hab = session ? habilitationPourMembre(membre, session) : { niveau: 0, source: "visiteur" };
  return json({
    mode: "live",
    session: session
      ? { id: session.id, nom: session.nom, avatar: session.avatar, admin: estAdmin(session), habilitation: hab.niveau, source: hab.source,
          fiche: membre && membre.fiche ? membre.fiche : null }
      : null,
    data: contenuPour(hab.niveau, dyn),
    ...(stockageOk ? {} : { avertissement: "Stockage KV indisponible : voir /api/etat" })
  });
}

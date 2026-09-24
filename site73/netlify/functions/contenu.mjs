// GET /api/contenu : session du visiteur + contenu caviardé selon SON habilitation.
import { json, lireSession, lireMembre, habilitationPourMembre, estAdmin, lireDynamique, contenuPour } from "../lib/commun.mjs";

export default async (req) => {
  const session = lireSession(req);
  const [membre, dyn] = await Promise.all([session ? lireMembre(session.id) : null, lireDynamique()]);
  const hab = session ? habilitationPourMembre(membre, session) : { niveau: 0, source: "visiteur" };
  return json({
    mode: "live",
    session: session
      ? { id: session.id, nom: session.nom, avatar: session.avatar, admin: estAdmin(session), habilitation: hab.niveau, source: hab.source }
      : null,
    data: contenuPour(hab.niveau, dyn)
  });
};

export const config = { path: "/api/contenu" };

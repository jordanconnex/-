// GET /api/auth/logout : ferme la session.
import { rediriger, cookie } from "../commun.mjs";

export default async function deconnexion() {
  return rediriger("/?connexion=fermee", [cookie("s73_session", "", 0)]);
}

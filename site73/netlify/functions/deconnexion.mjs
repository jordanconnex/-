// GET /api/auth/logout : ferme la session.
import { rediriger, cookie } from "../lib/commun.mjs";

export default async () => rediriger("/?connexion=fermee", [cookie("s73_session", "", 0)]);

export const config = { path: "/api/auth/logout" };

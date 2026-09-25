// GET /api/roblox?pseudo=Nom : photo Roblox (buste) d'un joueur, pour sa carte
// d'identité. Le navigateur ne peut pas appeler Roblox directement (CORS) :
// le Worker le fait à sa place et ne renvoie que l'adresse de l'image.
import { json, env } from "../commun.mjs";

const PSEUDO = /^[A-Za-z0-9_]{3,20}$/;
const IMAGE = /^https:\/\/[a-z0-9-]+\.rbxcdn\.com\//;
const UNE_HEURE = { "cache-control": "public, max-age=3600" };

export default async function roblox(req) {
  const url = new URL(req.url);
  const pseudo = (url.searchParams.get("pseudo") || "").trim();
  if (!PSEUDO.test(pseudo)) return json({ erreur: "Pseudo Roblox invalide (3 à 20 lettres, chiffres ou _)." }, 400);

  // Même pseudo demandé souvent : réponse gardée une heure en cache
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cle = new Request(url.origin + "/api/roblox?pseudo=" + pseudo.toLowerCase());
  const deja = cache && (await cache.match(cle));
  if (deja) return deja;

  const users = env("ROBLOX_USERS_URL", "https://users.roblox.com");
  const vignettes = env("ROBLOX_THUMBS_URL", "https://thumbnails.roblox.com");

  // 1. Pseudo → identifiant Roblox
  const r1 = await fetch(users + "/v1/usernames/users", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ usernames: [pseudo], excludeBannedUsers: true })
  });
  if (!r1.ok) return json({ erreur: "Roblox ne répond pas pour le moment." }, 502);
  const joueur = ((await r1.json()).data || [])[0];
  let reponse;
  if (!joueur || !Number.isInteger(joueur.id)) {
    reponse = json({ image: null, etat: "introuvable" }, 200, UNE_HEURE);
  } else {
    // 2. Identifiant → buste de l'avatar (format photo d'identité)
    const r2 = await fetch(`${vignettes}/v1/users/avatar-bust?userIds=${joueur.id}&size=420x420&format=Png&isCircular=false`, {
      headers: { accept: "application/json" }
    });
    if (!r2.ok) return json({ erreur: "Roblox ne répond pas pour le moment." }, 502);
    const vignette = ((await r2.json()).data || [])[0] || {};
    const image = vignette.state === "Completed" && IMAGE.test(vignette.imageUrl || "") ? vignette.imageUrl : null;
    // « Pending » : Roblox prépare encore l'image, on ne la garde pas en cache
    reponse = json({ id: joueur.id, nom: joueur.name, image, etat: image ? "ok" : String(vignette.state || "indisponible").toLowerCase() },
      200, image ? UNE_HEURE : {});
  }
  if (cache && reponse.headers.get("cache-control").startsWith("public")) await cache.put(cle, reponse.clone());
  return reponse;
}

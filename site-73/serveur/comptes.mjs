// Comptes du site : identifiant + mot de passe.
// Les mots de passe sont salés et hachés (PBKDF2-SHA256, Web Crypto) : le
// site ne les stocke jamais en clair. L'administrateur principal est défini
// par ADMIN_IDENTIFIANT et ADMIN_MOT_DE_PASSE (secrets Cloudflare) ; il peut
// ensuite nommer d'autres administrateurs depuis la console staff.
import { env, stockage, lireSession, aleatoireHex } from "./commun.mjs";

const enc = new TextEncoder();
// Borné par le temps de calcul de l'offre gratuite de Cloudflare (10 ms par
// requête). Chaque hachage garde son nombre d'itérations : on peut l'augmenter
// plus tard (100 000 au maximum sur Workers) sans casser les anciens comptes.
const ITERATIONS = 30000;
const ESSAIS_MAX = 5;
const BLOCAGE_MINUTES = 15;

/* ---------- Identifiants et mots de passe ------------------------------ */
// 3 à 20 caractères : lettres, chiffres, point, tiret, tiret bas.
const IDENTIFIANT = /^[a-z0-9][a-z0-9._-]{2,19}$/;
export const normaliser = (brut) => String(brut || "").trim().toLowerCase();
export const identifiantValide = (id) => IDENTIFIANT.test(id);

export function verifierIdentifiant(brut) {
  const nom = String(brut || "").trim();
  const id = nom.toLowerCase();
  if (!IDENTIFIANT.test(id)) return { erreur: "Identifiant : 3 à 20 caractères, lettres sans accent, chiffres, point, tiret ou tiret bas." };
  return { id, nom };
}
export function verifierMotDePasse(mdp, id) {
  if (typeof mdp !== "string" || mdp.length < 8) return "Mot de passe : 8 caractères minimum.";
  if (mdp.length > 128) return "Mot de passe : 128 caractères maximum.";
  if (normaliser(mdp) === id) return "Le mot de passe ne doit pas être ton identifiant.";
  return null;
}

const hex = (octets) => Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, "0")).join("");
// Comparaison en temps constant de deux textes de même longueur
function egal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const sha256 = async (texte) => hex(await crypto.subtle.digest("SHA-256", enc.encode(texte)));
// Compare deux textes sans révéler, par la durée, où ils diffèrent
export const memeTexte = async (a, b) => egal(await sha256(String(a)), await sha256(String(b)));

export async function hacher(mdp, sel = aleatoireHex(16), iterations = ITERATIONS) {
  const cle = await crypto.subtle.importKey("raw", enc.encode(mdp), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(sel), iterations }, cle, 256);
  return { algo: "pbkdf2-sha256", iterations, sel, hash: hex(bits) };
}
export async function motDePasseCorrect(mdp, h) {
  if (!h || !h.sel || !h.hash) return false;
  return egal((await hacher(mdp, h.sel, h.iterations)).hash, h.hash);
}
// Même durée de calcul quand le compte n'existe pas
export const hachageLeurre = (mdp) => hacher(mdp, "leurre-site-73");

// Mot de passe provisoire donné par le staff : 12 caractères sans 0/O ni 1/l
export function motDePasseProvisoire() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  while (out.length < 12) {
    for (const o of crypto.getRandomValues(new Uint8Array(16))) {
      if (o < 248 && out.length < 12) out += alphabet[o % alphabet.length]; // 248 = 8 × 31 : pas de biais
    }
  }
  return out.slice(0, 4) + "-" + out.slice(4, 8) + "-" + out.slice(8);
}
export const nouveauJeton = () => aleatoireHex(12);

/* ---------- Administrateurs -------------------------------------------- */
export const adminPrincipal = () => {
  const id = normaliser(env("ADMIN_IDENTIFIANT"));
  return IDENTIFIANT.test(id) ? id : "";
};
export const estPrincipal = (m) => !!m && !!adminPrincipal() && m.id === adminPrincipal();
export const estAdmin = (m) => !!m && (estPrincipal(m) || m.admin === true);
// Son jeton suit ADMIN_MOT_DE_PASSE : changer ce secret ferme ses sessions
export const jetonPrincipal = async () => (await sha256("site73-admin:" + env("ADMIN_MOT_DE_PASSE"))).slice(0, 24);
export const principalPret = () => !!adminPrincipal() && env("ADMIN_MOT_DE_PASSE").length >= 8;

export function habilitationPourMembre(m) {
  if (estAdmin(m)) return { niveau: 5, source: "admin" };
  if (m && Number.isInteger(m.override)) return { niveau: m.override, source: "staff" };
  const defaut = Number(env("HABILITATION_PAR_DEFAUT", "1"));
  return { niveau: Number.isInteger(defaut) && defaut >= 0 && defaut <= 5 ? defaut : 1, source: "defaut" };
}

/* ---------- Compte de la requête ---------------------------------------- */
// Membre connecté, ou null. Le compte est relu à chaque requête : un compte
// supprimé, un mot de passe changé ou un admin retiré prend effet tout de suite.
export async function membreConnecte(req) {
  const session = await lireSession(req);
  if (!session) return null;
  const m = await stockage().get("membres/" + session.id);
  if (!m || !m.jeton || !egal(m.jeton, String(session.v))) return null;
  if (estPrincipal(m) && !egal(m.jeton, await jetonPrincipal())) return null;
  return m;
}

/* ---------- Essais de connexion ----------------------------------------- */
// Après 5 erreurs, le compte est bloqué 15 minutes pour cette adresse IP.
const cleEssais = (id, req) => "essais/" + id + "/" + (req.headers.get("cf-connecting-ip") || "local");
export async function blocage(id, req) {
  const e = await stockage().get(cleEssais(id, req));
  return e && e.jusqua > Date.now() ? Math.ceil((e.jusqua - Date.now()) / 60000) : 0;
}
export async function noterEchec(id, req) {
  const s = stockage(), cle = cleEssais(id, req);
  const e = (await s.get(cle)) || { n: 0 };
  e.n = (e.n || 0) + 1;
  if (e.n >= ESSAIS_MAX) { e.n = 0; e.jusqua = Date.now() + BLOCAGE_MINUTES * 60000; }
  await s.setJSON(cle, e, { expirationTtl: BLOCAGE_MINUTES * 60 * 2 });
}
export async function effacerEchecs(id, req) {
  const s = stockage(), cle = cleEssais(id, req);
  if (await s.get(cle)) await s.delete(cle);
}

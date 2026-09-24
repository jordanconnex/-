// Caviardage côté serveur : ne laisse passer que les passages [[n|…]]
// autorisés pour le niveau demandé. Les autres sont remplacés par des « ▒ »
// de même longueur : le texte réel ne quitte jamais le serveur.

const JETON = /\[\[(\d)\|([\s\S]*?)\]\]/g;

export const remplissage = (texte) =>
  texte.replace(/\[[^\]]*\]/g, "▒▒▒▒▒▒▒▒").replace(/\S/g, "▒");

export function caviarderTexte(texte, niveau) {
  return texte.replace(JETON, (tout, n, interieur) =>
    Number(n) <= niveau ? tout : "[[" + n + "|" + remplissage(interieur) + "]]"
  );
}

// Copie profonde d'une valeur JSON en caviardant toutes les chaînes.
export function caviarder(valeur, niveau) {
  if (typeof valeur === "string") return caviarderTexte(valeur, niveau);
  if (Array.isArray(valeur)) return valeur.map((v) => caviarder(v, niveau));
  if (valeur && typeof valeur === "object") {
    const copie = {};
    for (const [cle, v] of Object.entries(valeur)) copie[cle] = caviarder(v, niveau);
    return copie;
  }
  return valeur;
}

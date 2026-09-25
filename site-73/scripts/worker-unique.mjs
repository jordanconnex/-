// Génère dist/worker.js : tout le Worker en UN SEUL fichier, sans import,
// avec les pages de public/ à l'intérieur. À coller dans l'éditeur en ligne
// de Cloudflare (« Modifier le code ») quand on ne passe pas par
// « npm run deploy ». Il contient tout le contenu classifié : ne le publie
// jamais (dist/ est ignoré par git).
import { build } from "esbuild";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import "./build.mjs"; // data.js à jour avant de l'intégrer

const ici = (p) => fileURLToPath(new URL(p, import.meta.url));
const PUBLIC = ici("../public");
const TYPES = {
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8", svg: "image/svg+xml",
  webmanifest: "application/manifest+json", ico: "image/x-icon", png: "image/png", jpg: "image/jpeg",
  jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", woff2: "font/woff2"
};
const TEXTE = /^(html|css|js|json|txt|svg|webmanifest)$/;

const fichiers = {};
const parcourir = (dossier) => {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) { parcourir(chemin); continue; }
    if (nom === "_headers" || nom === "_redirects") continue; // réglages Cloudflare, pas des pages
    const ext = nom.split(".").pop().toLowerCase();
    if (!TYPES[ext]) throw new Error("Type de fichier inconnu : " + chemin);
    const contenu = readFileSync(chemin);
    const f = { type: TYPES[ext], etag: '"' + createHash("sha1").update(contenu).digest("hex").slice(0, 16) + '"' };
    if (TEXTE.test(ext)) f.texte = contenu.toString("utf8"); else f.b64 = contenu.toString("base64");
    fichiers["/" + relative(PUBLIC, chemin).split(sep).join("/")] = f;
  }
};
parcourir(PUBLIC);

mkdirSync(ici("../dist"), { recursive: true });
const resultat = await build({
  entryPoints: [ici("../serveur/unique.mjs")],
  outfile: ici("../dist/worker.js"),
  bundle: true, format: "esm", platform: "neutral", target: "es2022", write: false,
  legalComments: "none", logLevel: "warning",
  banner: { js: "// Site-73 · Worker Cloudflare en un seul fichier (généré par « npm run worker-unique », ne pas modifier).\n// Contient le contenu classifié du site : ne le publie jamais, ne le mets pas sur GitHub.\n// Il faut une liaison KV nommée SITE73 et les variables SESSION_SECRET, ADMIN_IDENTIFIANT et ADMIN_MOT_DE_PASSE (voir le guide)." },
  plugins: [{
    name: "fichiers",
    setup(b) {
      b.onResolve({ filter: /^site73:fichiers$/ }, (a) => ({ path: a.path, namespace: "site73" }));
      b.onLoad({ filter: /.*/, namespace: "site73" }, () => ({ contents: "export default " + JSON.stringify(fichiers) + ";", loader: "js" }));
    }
  }]
});
// esbuild écrit les déclarations du haut des fichiers en « var » : on les
// remet en « let » (le contenu des pages tient sur une seule ligne, il n'est pas touché).
const code = resultat.outputFiles[0].text.replace(/^var /gm, "let ");
writeFileSync(ici("../dist/worker.js"), code);
const taille = statSync(ici("../dist/worker.js")).size;
console.log("dist/worker.js généré : " + Object.keys(fichiers).length + " fichiers intégrés, " + Math.round(taille / 1024) + " Ko.");

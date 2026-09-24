// Code d'accès du mode staff (démonstration) : seule son empreinte est publiée.
// Même normalisation que le navigateur (core.js) : sans espaces, en majuscules.
import { createHash } from "node:crypto";

export const empreinteCodeStaff = (code) =>
  createHash("sha256").update("site73-staff:" + String(code).replace(/\s+/g, "").toUpperCase()).digest("hex");

export function sansSecrets(donnees) {
  const copie = { ...donnees, config: { ...donnees.config } };
  const code = copie.config.codeStaff;
  delete copie.config.codeStaff;
  if (code) copie.config.codeStaffEmpreinte = empreinteCodeStaff(code);
  return copie;
}

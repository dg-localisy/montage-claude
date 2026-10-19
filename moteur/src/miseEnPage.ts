import {emDepuisAss} from './temps';

// Mise en page d'une accroche, partagée par l'accroche (dessin) et la caméra (qui descend
// l'image juste assez pour que le haut de la tête passe sous le titre : il ne cache jamais le visage).
export const miseEnPageAccroche = (e: any, charte: any) => {
  const A = charte.moteur.accroche;
  const presentation = e.variante === 'presentation';
  const avecSurtitre = Boolean(e.surtitre);
  const surtitreTaille = presentation ? 28 : A.surtitre_taille_px;
  const surtitreY = A.titre_haut_px + surtitreTaille / 2; // centre du sur-titre
  const em0 = emDepuisAss(132);
  const em = em0 * (presentation ? 0.68 : 1);
  const ecart = (A.ecart_lignes_px / em0) * em;
  const haut = avecSurtitre ? surtitreY + surtitreTaille / 2 + (presentation ? 22 : 30) : A.titre_haut_px;
  const premiere = haut + 0.37 * em; // centre des majuscules de la première ligne
  const n = e._t?.lignes?.length ?? 1;
  const bas = premiere + (n - 1) * ecart + 0.42 * em; // bas des lettres de la dernière ligne
  return {presentation, avecSurtitre, surtitreTaille, surtitreY, em, ecart, premiere, bas};
};

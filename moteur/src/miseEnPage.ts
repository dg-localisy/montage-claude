import {emDepuisAss} from './temps';

// Mise en page d'une accroche : sous le visage, juste au-dessus des sous-titres.
// Le titre se construit de bas en haut à partir des sous-titres, l'image ne bouge pas.
// Rien ne doit cacher le visage : sur un cadrage très serré (menton bas), vérifier les images fixes.
export const miseEnPageAccroche = (e: any, charte: any) => {
  const A = charte.moteur.accroche;
  const st = charte.sous_titres.normal;
  const presentation = e.variante === 'presentation';
  const avecSurtitre = Boolean(e.surtitre);
  const surtitreTaille = presentation ? 28 : A.surtitre_taille_px;
  const em0 = emDepuisAss(132);
  const em = em0 * (presentation ? 0.68 : 1);
  const ecart = (A.ecart_lignes_px / em0) * em;
  const n = e._t?.lignes?.length ?? 1;
  // haut des majuscules des sous-titres (capitales de Figtree ≈ 0,72 em)
  const hautSousTitres = st.position.ligne_de_base_y - 0.72 * emDepuisAss(st.taille_ass);
  // présentation (nom + fonction) : le nom se pose sur la ligne des sous-titres, qui s'effacent pendant ce temps
  const surLaLigne = presentation && A.presentation_a_la_place_des_sous_titres;
  const bas = surLaLigne ? st.position.ligne_de_base_y : hautSousTitres - A.marge_sous_titres_px; // bas des lettres de la dernière ligne
  const premiere = bas - (n - 1) * ecart - 0.42 * em; // centre des majuscules de la première ligne
  const hautTitre = premiere - 0.37 * em;
  const surtitreY = hautTitre - (presentation ? 22 : 30) - surtitreTaille / 2; // centre du sur-titre
  const haut = avecSurtitre ? surtitreY - surtitreTaille / 2 : hautTitre; // haut de tout le bloc
  return {presentation, avecSurtitre, surtitreTaille, surtitreY, em, ecart, premiere, haut, bas};
};

import {lerp} from './temps';

// Mise en évidence d'un mot sans couleur (noir et blanc uniquement, demande de l'utilisateur) :
// la même graisse en italique, avec un relief noir (extrusion vers le bas à droite, puis ombre douce).
// Réglages : charte → mise_en_evidence.
export const policeItalique = (police: string) =>
  police.endsWith('Italic') ? police : police === 'Figtree Regular' ? 'Figtree Italic' : `${police} Italic`;

export const ombreRelief = (taillePx: number, charte: any) => {
  const R = charte.mise_en_evidence;
  const n = Math.max(2, Math.round(taillePx * R.profondeur_em));
  const couches: string[] = [];
  for (let i = 1; i <= n; i++) {
    const g = Math.round(lerp(R.gris_haut, R.gris_bas, (i - 1) / Math.max(1, n - 1)));
    couches.push(`${i}px ${i}px 0 rgb(${g},${g},${g})`);
  }
  couches.push(`${n + 2}px ${n + 3}px ${Math.round(n * 2.5)}px rgba(0,0,0,${R.ombre_opacite})`);
  return couches.join(', ');
};

// italique accentué : l'inclinaison de la police, plus une inclinaison ajoutée (charte → inclinaison_supplementaire_deg)
export const inclinaison = (charte: any) => `skewX(${-charte.mise_en_evidence.inclinaison_supplementaire_deg}deg)`;

export const styleEvidence = (police: string, taillePx: number, charte: any) => ({
  fontFamily: policeItalique(police),
  textShadow: ombreRelief(taillePx, charte),
  display: 'inline-block' as const,
  transform: inclinaison(charte),
});

// couleur #RRGGBB avec transparence
export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

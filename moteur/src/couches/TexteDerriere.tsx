import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, prog} from '../temps';

// Texte géant derrière la personne (comme « YES » ou « LEGAL » dans la vidéo de référence) :
// il est dessiné juste après la vidéo de fond, puis la personne détourée est redessinée par-dessus
// (Camera avec avantPlan). Les lettres apparaissent une à une.
// Champs : debut, fin, texte (\n pour changer de ligne), taille (px), y (centre vertical), x (centre, 540 par défaut),
// couleur, opacite, remplace (mots retirés des sous-titres), riser (riser + coup sourd : réservé à l'accroche).
export const TexteDerriere: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut - 0.01 || t > e.fin) return null;
  const T = charte.moteur.texte_derriere;
  const taille = e.taille ?? T.taille_px;
  const sortie = prog(t, e.fin - T.sortie_s, e.fin);
  const lignes: string[] = e.texte.toUpperCase().split('\n');
  const hauteur = lignes.length * taille * T.interligne;
  let k = 0;

  return (
    <div
      style={{
        position: 'absolute', left: (e.x ?? W / 2) - W, width: 2 * W, top: (e.y ?? T.y) - hauteur / 2, textAlign: 'center',
        fontFamily: T.police, fontSize: taille, lineHeight: T.interligne, letterSpacing: `${T.interlettrage_em}em`,
        color: e.couleur ?? T.couleur, opacity: (e.opacite ?? T.opacite) * (1 - sortie), whiteSpace: 'pre',
        transform: `scale(${(1 + 0.03 * sortie).toFixed(4)})`, filter: sortie > 0 ? `blur(${(sortie * 10).toFixed(1)}px)` : 'none',
      }}
    >
      {lignes.map((ligne, li) => (
        <div key={li}>
          {ligne.split('').map((ch, ci) => {
            if (ch === ' ') return <span key={ci}> </span>;
            const debut = e._t.lettres[k++];
            const a = easeOut(prog(t, debut, debut + T.duree_lettre_s));
            return (
              <span key={ci} style={{display: 'inline-block', opacity: a, transform: `translateY(${((1 - a) * 0.1 * taille).toFixed(1)}px) scale(${(0.92 + 0.08 * a).toFixed(3)})`}}>
                {ch}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

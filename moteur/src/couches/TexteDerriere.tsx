import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
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

  // entrée « rebond » : le mot surgit petit et rebondit jusqu'à sa taille (ressort), net en un instant
  // ombre : true pour un texte clair sur un fond chargé (ex. plafond sombre avec des lumières)
  const ombre = e.ombre ? '0 10px 50px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)' : 'none';
  // entrée « traverse » (Black and Bike, idée de l'utilisateur) : le mot passe au-dessus de la tête de gauche à droite.
  // Il entre très vite par la gauche à « debut », glisse lentement au-dessus de la tête, puis file vers la droite à « fin ».
  // Flou de vitesse horizontal pendant les passages rapides. Champs : x_arrivee, x_depart_sortie (centre du mot, en px).
  if (e.entree === 'traverse') {
    const xa = e.x_arrivee ?? 400;
    const xb = e.x_depart_sortie ?? 680;
    const entreeFin = e.debut + (e.duree_entree ?? 0.24);
    const sortieDebut = e.fin - (e.duree_sortie ?? 0.32);
    const pos = (x: number) => {
      if (x < entreeFin) return -W * 0.45 + (xa + W * 0.45) * easeOut(prog(x, e.debut, entreeFin));
      if (x < sortieDebut) return xa + (xb - xa) * prog(x, entreeFin, sortieDebut);
      const p = prog(x, sortieDebut, e.fin);
      return xb + (W * 1.5 - xb) * p * p * p;
    };
    const cx = pos(t);
    const vitesse = Math.abs(pos(t + 1 / fps) - cx) * fps; // px par seconde
    const flou = Math.min(40, vitesse / 260);
    const id = `traverse-${e.id}`;
    return (
      <>
        <svg width="0" height="0" style={{position: 'absolute'}}>
          <defs><filter id={id} x="-30%" y="0%" width="160%" height="100%"><feGaussianBlur stdDeviation={`${flou.toFixed(1)} 0`} /></filter></defs>
        </svg>
        <div style={{position: 'absolute', left: cx - W, width: 2 * W, top: (e.y ?? T.y) - hauteur / 2, textAlign: 'center', fontFamily: T.police, fontSize: taille,
          lineHeight: T.interligne, letterSpacing: `${T.interlettrage_em}em`, color: e.couleur ?? T.couleur, opacity: e.opacite ?? T.opacite, whiteSpace: 'pre',
          textShadow: ombre, filter: flou > 0.6 ? `url(#${id})` : 'none'}}>
          {lignes.join('\n')}
        </div>
      </>
    );
  }
  if (e.entree === 'rebond') {
    const r = spring({frame: (t - e.debut) * fps, fps, config: {damping: 9, stiffness: 190, mass: 0.8}});
    const net = easeOut(prog(t, e.debut, e.debut + 0.12));
    return (
      <div style={{position: 'absolute', left: (e.x ?? W / 2) - W, width: 2 * W, top: (e.y ?? T.y) - hauteur / 2, textAlign: 'center', fontFamily: T.police, fontSize: taille,
        lineHeight: T.interligne, letterSpacing: `${T.interlettrage_em}em`, color: e.couleur ?? T.couleur, opacity: (e.opacite ?? T.opacite) * (1 - sortie) * net, whiteSpace: 'pre',
        textShadow: ombre, transform: `scale(${(0.45 + 0.55 * r).toFixed(4)})`, transformOrigin: '50% 55%',
        filter: net < 1 || sortie > 0 ? `blur(${((1 - net) * 14 + sortie * 10).toFixed(1)}px)` : 'none'}}>
        {lignes.join('\n')}
      </div>
    );
  }
  // entrée « impact » : tout le mot tombe d'un coup (léger zoom arrière + flou qui se dissipe), puis grossit très lentement
  // entrée « montee » : le mot sort de derrière une ligne invisible (la tête), lettre après lettre, de bas en haut
  if (e.entree === 'impact' || e.entree === 'montee') {
    const impact = e.entree === 'impact';
    const a = easeOut(prog(t, e.debut, e.debut + (impact ? 0.24 : 0.5)));
    const derive = 1 + 0.02 * prog(t, e.debut, e.fin);
    return (
      <div
        style={{
          position: 'absolute', left: (e.x ?? W / 2) - W, width: 2 * W, top: (e.y ?? T.y) - hauteur / 2 - (impact ? 0 : taille * 0.2), height: impact ? undefined : hauteur + taille * 0.24,
          overflow: impact ? 'visible' : 'hidden', textAlign: 'center', fontFamily: T.police, fontSize: taille, lineHeight: T.interligne, letterSpacing: `${T.interlettrage_em}em`,
          color: e.couleur ?? T.couleur, opacity: (e.opacite ?? T.opacite) * (1 - sortie), whiteSpace: 'pre',
          filter: sortie > 0 ? `blur(${(sortie * 10).toFixed(1)}px)` : 'none',
        }}
      >
        <div style={{paddingTop: impact ? 0 : taille * 0.2, transform: `scale(${((impact ? 1.32 - 0.32 * a : 1) * derive).toFixed(4)})`, transformOrigin: '50% 60%',
          opacity: impact ? Math.min(1, a * 3) : 1, filter: impact && a < 1 ? `blur(${((1 - a) * 16).toFixed(1)}px)` : 'none'}}>
          {lignes.map((ligne, li) => (
            <div key={li}>
              {ligne.split('').map((ch, ci) => {
                if (impact) return <span key={ci}>{ch}</span>;
                const d = e.debut + ci * (e.intervalle ?? 0.04);
                const m = easeOut(prog(t, d, d + 0.42));
                return <span key={ci} style={{display: 'inline-block', transform: `translateY(${((1 - m) * 1.05 * taille).toFixed(1)}px)`}}>{ch === ' ' ? ' ' : ch}</span>;
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

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

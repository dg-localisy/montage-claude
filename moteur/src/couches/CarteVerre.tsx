import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeInOut, easeOut, prog} from '../temps';

// Carte en verre dépoli devant la personne, sous le visage (comme la carte « You need » de la vidéo de référence) :
// un titre, puis les éléments apparaissent un à un et un repère ▶ descend sur l'élément en cours.
// Noir et blanc : verre sombre, bord blanc lumineux. Champs : debut, fin, titre, items, temps, y (haut de la carte).
export const CarteVerre: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const C = charte.moteur.carte_verre;
  const temps: number[] = e._t.items;

  const entree = spring({frame: (t - e.debut) * fps, fps, config: {damping: 16, stiffness: 120, mass: 0.9}});
  const sortie = easeInOut(prog(t, e.fin - 0.35, e.fin));
  const actif = temps.filter((x) => t >= x).length - 1; // élément en cours
  const ligne = C.hauteur_ligne_px;
  // le repère glisse d'un élément à l'autre
  const repere = actif < 0 ? 0 : actif - 1 + spring({frame: (t - temps[actif]) * fps, fps, config: {damping: 18, stiffness: 200}});
  const largeur = C.largeur_px;

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: '100%', perspective: 1400, perspectiveOrigin: `50% ${e.y ?? C.y}px`}}>
      <div
        style={{
          position: 'absolute', left: (W - largeur) / 2, top: e.y ?? C.y, width: largeur, boxSizing: 'border-box',
          padding: `${C.marge_px}px ${C.marge_px + 6}px`, borderRadius: 36,
          background: 'linear-gradient(160deg, rgba(40,40,40,0.62) 0%, rgba(10,10,10,0.72) 100%)',
          backdropFilter: 'blur(22px) saturate(0.6)', WebkitBackdropFilter: 'blur(22px) saturate(0.6)',
          border: '2px solid rgba(255,255,255,0.55)',
          boxShadow: '0 0 28px rgba(255,255,255,0.28), 0 0 70px rgba(255,255,255,0.12), 0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
          opacity: Math.min(1, entree * 1.4) * (1 - sortie),
          transform: `translateY(${((1 - entree) * 140 + sortie * 40).toFixed(1)}px) rotateX(${((1 - entree) * 28 + C.inclinaison_deg).toFixed(2)}deg) scale(${(0.9 + 0.1 * entree - 0.04 * sortie).toFixed(4)})`,
          transformOrigin: '50% 100%', filter: sortie > 0 ? `blur(${(sortie * 14).toFixed(1)}px)` : 'none',
        }}
      >
        <div style={{fontFamily: 'Figtree Bold', fontSize: C.titre_px, color: '#fff', marginBottom: 18, textAlign: 'center'}}>{e.titre}</div>
        <div style={{position: 'relative'}}>
          {actif >= 0 && (
            <svg viewBox="0 0 20 20" width={26} height={26} style={{position: 'absolute', left: 0, top: repere * ligne + (ligne - 26) / 2, filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.8))'}}>
              <path d="M4 2 L17 10 L4 18 Z" fill="#fff" />
            </svg>
          )}
          {e.items.map((item: string, i: number) => {
            const a = easeOut(prog(t, temps[i] - 0.05, temps[i] + 0.25));
            return (
              <div key={i} style={{height: ligne, display: 'flex', alignItems: 'center', paddingLeft: 48, fontFamily: i === actif ? 'Figtree Bold' : 'Figtree Medium',
                fontSize: C.texte_px, color: i === actif ? '#fff' : 'rgba(255,255,255,0.78)', opacity: a, transform: `translateX(${((1 - a) * -30).toFixed(1)}px)`,
                filter: a < 1 ? `blur(${((1 - a) * 6).toFixed(1)}px)` : 'none', whiteSpace: 'nowrap'}}>
                {item}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

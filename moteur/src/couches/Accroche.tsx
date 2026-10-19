import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {miseEnPageAccroche} from '../miseEnPage';
import {easeOut, fondu, prog, sansPonctuation} from '../temps';

// Accroche d'ouverture : un sur-titre qui glisse, puis un titre qui s'écrit lettre par lettre.
export const Accroche: React.FC<{e: any; charte: any; projet: any}> = ({e, charte, projet}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const A = charte.moteur.accroche;
  const ti = charte.titres;
  const accent = charte.couleurs.orange;
  // Tout en haut de l'image ; la caméra descend l'image pour que le visage reste dessous (miseEnPage.ts).
  const {presentation, avecSurtitre, surtitreTaille, surtitreY, em, ecart, premiere} = miseEnPageAccroche(e, charte);
  const visible = fondu(t, e.debut, e.fin, 0.25);
  const sortie = prog(t, e.fin - 0.3, e.fin);
  const s = easeOut(prog(t, e.debut, e.debut + 0.35));
  const accentMot = sansPonctuation(e.mot_accent || '');

  let index = 0;
  const lignes: string[] = e._t.lignes;
  const nbTotal = lignes.join(' ').length;
  // dernière lettre déjà commencée (les sauts de ligne comptent pour un temps mais n'ont pas de lettre)
  const sauts = new Set<number>();
  lignes.reduce((acc, l) => { sauts.add(acc + l.length); return acc + l.length + 1; }, 0);
  let dernierIndex = Math.min(nbTotal - 1, Math.floor((t - e._t.titre) * e._t.vitesse));
  if (sauts.has(dernierIndex)) dernierIndex -= 1;
  const curseurVisible = t < e._t.finFrappe + 0.5 && (t < e._t.finFrappe || Math.floor((t - e._t.finFrappe) * 4) % 2 === 0);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: visible * (1 - sortie), transform: `translateY(${(-24 * sortie).toFixed(1)}px)`}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 900, background: presentation ? 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0) 62%)' : 'linear-gradient(to bottom, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0) 72%)'}} />
      {avecSurtitre && <div
        style={{
          position: 'absolute', top: surtitreY - surtitreTaille / 2, left: 0, width: W, display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 18, opacity: s, transform: `translateX(${((1 - s) * -40).toFixed(1)}px)`,
        }}
      >
        <div style={{width: (presentation ? 30 : 46) * s, height: presentation ? 4 : 6, background: '#fff', borderRadius: 3}} />
        <div style={{fontFamily: presentation ? 'Figtree SemiBold' : A.surtitre_police, fontSize: surtitreTaille, letterSpacing: presentation ? 4 : 6, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', lineHeight: 1}}>
          {e.surtitre}
        </div>
      </div>}
      {lignes.map((ligne, li) => {
        const debutLigne = index;
        index += ligne.length + 1;
        const mots = ligne.split(' ');
        let pos = debutLigne;
        return (
          <div
            key={li}
            style={{
              position: 'absolute', left: 0, width: W, top: premiere + li * ecart - ecart / 2,
              height: ecart, lineHeight: `${ecart}px`, textAlign: 'center', fontFamily: ti.police, fontSize: em,
              letterSpacing: ti.interlettrage_px, color: '#fff', whiteSpace: 'pre', textShadow: '0 6px 30px rgba(0,0,0,0.45)',
            }}
          >
            {mots.map((mot, mi) => {
              const couleur = sansPonctuation(mot) === accentMot ? accent : '#fff';
              const caracteres = (mi > 0 ? ' ' : '') + mot;
              return caracteres.split('').map((ch, ci) => {
                const i = pos++;
                const a = easeOut(prog(t, e._t.titre + i / e._t.vitesse, e._t.titre + i / e._t.vitesse + 0.08));
                const dernier = i === dernierIndex;
                return (
                  <span key={`${mi}-${ci}`} style={{position: 'relative', display: 'inline-block', color: couleur}}>
                    <span style={{display: 'inline-block', opacity: a, transform: `translateY(${((1 - a) * 14).toFixed(1)}px)`, filter: a < 1 ? `blur(${((1 - a) * 4).toFixed(1)}px)` : 'none'}}>{ch}</span>
                    {dernier && curseurVisible && (
                      <span style={{position: 'absolute', right: -14, top: '50%', width: presentation ? 6 : 8, height: em * 0.8, marginTop: -em * 0.45, background: presentation ? '#fff' : accent, borderRadius: 2}} />
                    )}
                  </span>
                );
              });
            })}
          </div>
        );
      })}
    </div>
  );
};

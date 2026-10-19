import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp, emDepuisAss, prog, sansPonctuation} from '../temps';
import {styleEvidence} from '../miseEnEvidence';

// Grand titre sur une phrase choc : le visage est flouté derrière (voir Camera),
// chaque ligne arrive en 3D (bascule vers l'avant), puis repart vers le haut.
export const GrandTitre: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut - 0.05 || t > e.fin) return null;
  const G = charte.moteur.grand_titre;
  const ti = charte.titres;
  const em = emDepuisAss(132) * 1.12;
  const ecart = 150;
  const lignes: string[] = e.lignes.map((l: string) => l.toUpperCase());
  const accentMot = sansPonctuation(e.mot_accent || '');
  const haut = G.centre_y - ((lignes.length - 1) * ecart) / 2 - ecart / 2;
  const sortie = prog(t, e.fin - 0.25, e.fin);

  return (
    <div style={{position: 'absolute', inset: 0, perspective: G.perspective_px, perspectiveOrigin: `50% ${G.centre_y}px`}}>
      {lignes.map((ligne, i) => {
        const sp = spring({frame: (t - e.debut - i * G.decalage_lignes_s) * fps, fps, config: {damping: 13, stiffness: 130, mass: 0.8}});
        const rot = (1 - sp) * G.rotation_depart_deg - sortie * 55;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: 0, width: W, top: haut + i * ecart, height: ecart, lineHeight: `${ecart}px`, textAlign: 'center',
              fontFamily: ti.police, fontSize: em, letterSpacing: ti.interlettrage_px, color: '#fff', whiteSpace: 'pre',
              textShadow: '0 12px 44px rgba(0,0,0,0.55)', opacity: clamp(sp * 1.6) * (1 - sortie),
              transform: `translateY(${((1 - sp) * 90 - sortie * 70).toFixed(1)}px) translateZ(${((1 - sp) * -260).toFixed(1)}px) rotateX(${rot.toFixed(1)}deg)`,
              transformOrigin: '50% 100%',
            }}
          >
            {ligne.split(' ').map((mot, mi) => (
              <span key={mi} style={{color: '#fff', ...(sansPonctuation(mot) === accentMot ? styleEvidence(ti.police, em, charte) : {})}}>
                {(mi > 0 ? ' ' : '') + mot}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};

import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, emDepuisAss, fondu, prog, sansPonctuation} from '../temps';

// Accroche d'ouverture : un sur-titre qui glisse, puis un titre qui s'écrit lettre par lettre.
export const Accroche: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const A = charte.moteur.accroche;
  const ti = charte.titres;
  const accent = charte.couleurs.orange;
  const em = emDepuisAss(132);
  const visible = fondu(t, e.debut, e.fin, 0.25);
  const sortie = prog(t, e.fin - 0.3, e.fin);
  const s = easeOut(prog(t, e.debut, e.debut + 0.35));
  const accentMot = sansPonctuation(e.mot_accent || '');

  let index = 0;
  const lignes: string[] = e._t.lignes;
  const nbTotal = lignes.join(' ').length;
  const nbVisibles = Math.floor((t - e._t.titre) * A.lettres_par_s);
  const curseurVisible = t < e._t.finFrappe + 0.5 && (t < e._t.finFrappe || Math.floor((t - e._t.finFrappe) * 4) % 2 === 0);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: visible * (1 - sortie), transform: `translateY(${(-24 * sortie).toFixed(1)}px)`}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 1250, background: 'linear-gradient(to bottom, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0) 72%)'}} />
      <div
        style={{
          position: 'absolute', top: A.surtitre_y - A.surtitre_taille_px / 2, left: 0, width: W, display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 18, opacity: s, transform: `translateX(${((1 - s) * -40).toFixed(1)}px)`,
        }}
      >
        <div style={{width: 46 * s, height: 6, background: accent, borderRadius: 3}} />
        <div style={{fontFamily: A.surtitre_police, fontSize: A.surtitre_taille_px, letterSpacing: 6, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', lineHeight: 1}}>
          {e.surtitre}
        </div>
      </div>
      {lignes.map((ligne, li) => {
        const debutLigne = index;
        index += ligne.length + 1;
        const mots = ligne.split(' ');
        let pos = debutLigne;
        return (
          <div
            key={li}
            style={{
              position: 'absolute', left: 0, width: W, top: A.titre_y_premiere_ligne + li * A.ecart_lignes_px - A.ecart_lignes_px / 2,
              height: A.ecart_lignes_px, lineHeight: `${A.ecart_lignes_px}px`, textAlign: 'center', fontFamily: ti.police, fontSize: em,
              letterSpacing: ti.interlettrage_px, color: '#fff', whiteSpace: 'pre', textShadow: '0 6px 30px rgba(0,0,0,0.45)',
            }}
          >
            {mots.map((mot, mi) => {
              const couleur = sansPonctuation(mot) === accentMot ? accent : '#fff';
              const caracteres = (mi > 0 ? ' ' : '') + mot;
              return caracteres.split('').map((ch, ci) => {
                const i = pos++;
                const a = easeOut(prog(t, e._t.titre + i / A.lettres_par_s, e._t.titre + i / A.lettres_par_s + 0.08));
                const dernier = i === Math.min(nbVisibles, nbTotal) - 1;
                return (
                  <span key={`${mi}-${ci}`} style={{position: 'relative', display: 'inline-block', color: couleur, opacity: a, transform: `translateY(${((1 - a) * 14).toFixed(1)}px)`, filter: a < 1 ? `blur(${((1 - a) * 4).toFixed(1)}px)` : 'none'}}>
                    {ch}
                    {dernier && curseurVisible && (
                      <span style={{position: 'absolute', right: -14, top: '50%', width: 8, height: em * 0.8, marginTop: -em * 0.45, background: accent, borderRadius: 2, opacity: 1 / Math.max(a, 0.01)}} />
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

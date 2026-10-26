import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {prog} from '../temps';

// Liste de pastilles sous le visage : chaque ligne glisse quand elle est dite et reste affichée.
// Différente des cartes (la vidéo garde tout l'écran). Champs : items, temps, y, fin, numeros (false : sans numéro).
export const Liste: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const L = charte.moteur.liste;
  const taille = e.taille_police ?? L.taille_police_px;
  const h = Math.round(taille * 1.95);
  const sortie = prog(t, e.fin - 0.3, e.fin);
  // numeros: false → pastilles sans numéro (quand les éléments ne sont pas dans un ordre, demande de l'utilisateur sur TS)
  const sansNumero = e.numeros === false;
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: e.y ?? L.y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: L.ecart_px, opacity: 1 - sortie}}>
      {e.items.map((item: any, i: number) => {
        const t0 = e.temps[i];
        if (t < t0 - 0.02) return <div key={i} style={{height: h}} />;
        const s = spring({frame: (t - t0) * fps, fps, config: {damping: 14, stiffness: 180}});
        return (
          <div
            key={i}
            style={{
              height: h, display: 'flex', alignItems: 'center', gap: Math.round(taille * 0.5), padding: `0 ${Math.round(taille * 0.9)}px 0 ${Math.round(taille * (sansNumero ? 0.9 : 0.32))}px`,
              borderRadius: h / 2, background: 'rgba(12,12,12,0.62)', border: '1.5px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)', opacity: Math.min(1, s * 1.3), transform: `translateX(${((1 - s) * -80).toFixed(1)}px) scale(${(0.9 + 0.1 * s).toFixed(3)})`,
            }}
          >
            {!sansNumero && <div style={{width: h * 0.62, height: h * 0.62, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Figtree Bold', fontSize: taille * 0.6, color: '#fff', lineHeight: 1}}>
              {i + 1}
            </div>}
            <div style={{fontFamily: 'Figtree SemiBold', fontSize: taille, color: '#fff', whiteSpace: 'nowrap', lineHeight: 1}}>{typeof item === 'string' ? item : item.texte}</div>
          </div>
        );
      })}
    </div>
  );
};

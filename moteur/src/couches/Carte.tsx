import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ChatIA} from '../cartes/ChatIA';
import {Checklist, Entonnoir, GrosChiffre} from '../cartes/AutresCartes';
import {easeOut, prog} from '../temps';

// Panneau qui joue à côté de la vidéo réduite en carte (la réduction elle-même est dans Camera).
export const Carte: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  if (t < e._t.panneau || t > e.fin) return null;
  const C = charte.moteur.carte;
  const [x, y, w, h] = C.rect_panneau;
  const entree = easeOut(prog(t, e._t.panneau, e._t.panneau + 0.35));
  const sortie = prog(t, e.fin - C.duree_reduction_s, e.fin - 0.05);
  const props = {e, t, charte};
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: entree * (1 - sortie), transform: `translateX(${((1 - entree) * 70 + sortie * 50).toFixed(1)}px)`}}>
      {e.animation === 'chat_ia' && <ChatIA {...props} />}
      {e.animation === 'entonnoir' && <Entonnoir {...props} />}
      {e.animation === 'gros_chiffre' && <GrosChiffre {...props} />}
      {e.animation === 'checklist' && <Checklist {...props} />}
    </div>
  );
};

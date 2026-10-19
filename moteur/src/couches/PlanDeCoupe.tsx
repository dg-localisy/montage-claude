import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig} from 'remotion';

// Plan de coupe (vidéo d'illustration, ex. libre de droits) en plein écran, sans son : la voix continue.
// Champs : fichier (copié par preparer.mjs), debut, fin, debut_clip (où commencer dans le clip, en s),
// voile (dégradé sombre sous les sous-titres, activé par défaut).
export const PlanDeCoupe: React.FC<{e: any; charte: any; etalonnage: boolean}> = ({e, charte, etalonnage}) => {
  const {fps, width: W, height: H} = useVideoConfig();
  const de = Math.round(e.debut * fps);
  const duree = Math.max(1, Math.round(e.fin * fps) - de);
  // le voile suit la ligne des sous-titres (en % de la hauteur)
  const base = (charte.sous_titres.normal.position.ligne_de_base_y / H) * 100;
  const voile = `linear-gradient(to bottom, rgba(0,0,0,0) ${(base - 20).toFixed(1)}%, rgba(0,0,0,0.5) ${(base - 6).toFixed(1)}%, rgba(0,0,0,0.5) ${(base + 3).toFixed(1)}%, rgba(0,0,0,0) ${(base + 16).toFixed(1)}%)`;
  return (
    <Sequence from={de} durationInFrames={duree} layout="none">
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(e.src)} muted startFrom={Math.round((e.debut_clip ?? 0) * fps)}
          style={{width: W, height: H, objectFit: 'cover', filter: etalonnage ? charte.moteur.ambiance.etalonnage_css : 'none'}}
        />
        {e.voile !== false && (
          // léger dégradé sombre sous les sous-titres : ils restent lisibles même sur un fond clair
          <AbsoluteFill style={{background: voile}} />
        )}
      </AbsoluteFill>
    </Sequence>
  );
};

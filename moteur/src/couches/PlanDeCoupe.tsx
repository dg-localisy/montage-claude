import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig} from 'remotion';

// Plan de coupe (vidéo d'illustration, ex. libre de droits) en plein écran, sans son : la voix continue.
// Champs : fichier (copié par preparer.mjs), debut, fin, debut_clip (où commencer dans le clip, en s).
export const PlanDeCoupe: React.FC<{e: any; charte: any; etalonnage: boolean}> = ({e, charte, etalonnage}) => {
  const {fps, width: W, height: H} = useVideoConfig();
  const de = Math.round(e.debut * fps);
  const duree = Math.max(1, Math.round(e.fin * fps) - de);
  return (
    <Sequence from={de} durationInFrames={duree} layout="none">
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(e.src)} muted startFrom={Math.round((e.debut_clip ?? 0) * fps)}
          style={{width: W, height: H, objectFit: 'cover', filter: etalonnage ? charte.moteur.ambiance.etalonnage_css : 'none'}}
        />
      </AbsoluteFill>
    </Sequence>
  );
};

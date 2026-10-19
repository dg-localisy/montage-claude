import React, {useMemo} from 'react';
import {Audio, Sequence, staticFile, useVideoConfig} from 'remotion';

// Un effet sonore discret sur chaque animation + musique facultative qui baisse quand la voix parle.
export const Sons: React.FC<{projet: any}> = ({projet}) => {
  const {fps} = useVideoConfig();
  const nbImages = Math.round(projet.duree * fps);

  // enveloppe « je parle » (0 à 1) image par image, lissée (attaque / relâche)
  const gains = useMemo(() => {
    const m = projet.musique;
    if (!m) return [];
    const parle = new Array(nbImages).fill(0);
    for (const mot of projet.mots) {
      for (let f = Math.floor((mot.debut - 0.05) * fps); f <= Math.ceil((mot.fin + 0.05) * fps); f++) if (f >= 0 && f < nbImages) parle[f] = 1;
    }
    const attaque = 1 - Math.exp(-1 / (m.attaque_s * fps));
    const relache = 1 - Math.exp(-1 / (m.relache_s * fps));
    let env = 0;
    return parle.map((p) => {
      env += (p - env) * (p > env ? attaque : relache);
      return Math.pow(10, (m.sous_la_voix_db + m.baisse_quand_je_parle_db * env) / 20);
    });
  }, [projet, fps, nbImages]);

  return (
    <>
      {projet.rush.voix && <Audio src={staticFile(projet.rush.voix)} />}
      {projet.musique && <Audio src={staticFile(projet.musique.fichier)} volume={(f) => gains[Math.min(f, gains.length - 1)] ?? 0} />}
      {projet.sons.map((s: any, i: number) => (
        <Sequence key={i} from={Math.round(s.debut * fps)} durationInFrames={Math.round(1.5 * fps)} layout="none">
          <Audio src={staticFile(s.fichier)} volume={s.volume} />
        </Sequence>
      ))}
    </>
  );
};

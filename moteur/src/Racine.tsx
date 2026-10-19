import React from 'react';
import {Composition, staticFile} from 'remotion';
import {Montage, Props} from './Montage';

// Une seule composition, « Montage ». Sa durée et sa cadence viennent du projet préparé
// (scripts/preparer.mjs). Sans projet passé en paramètre, on lit public/projet.json.
export const Racine: React.FC = () => (
  <Composition
    id="Montage"
    component={Montage}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={{} as Props}
    calculateMetadata={async ({props}) => {
      let p = props as Props;
      if (!p.projet) {
        const reponse = await fetch(staticFile('projet.json'));
        p = await reponse.json();
      }
      return {
        props: p,
        fps: p.projet.fps,
        durationInFrames: Math.round(p.projet.duree * p.projet.fps),
        width: p.projet.largeur,
        height: p.projet.hauteur,
      };
    }}
  />
);

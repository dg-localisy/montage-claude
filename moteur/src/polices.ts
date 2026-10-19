import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// Charge les polices Figtree statiques sous leur nom interne (ex. « Figtree Black »).
export const usePolices = (charte: any) => {
  const [attente] = useState(() => delayRender('Chargement des polices Figtree'));
  useEffect(() => {
    const fichiers = charte.polices.inventaire.filter((f: any) => !f.variable);
    Promise.all(
      fichiers.map((f: any) =>
        new FontFace(f.nom_interne, `url('${staticFile('polices/' + f.fichier)}')`).load().then((p) => (document.fonts as any).add(p)),
      ),
    )
      .then(() => continueRender(attente))
      .catch((err) => {
        console.error('Police introuvable', err);
        continueRender(attente);
      });
  }, [attente, charte]);
};

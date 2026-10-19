import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, emDepuisAss, fondu, prog} from '../temps';

// Sous-titres mot à mot. Même place, même taille, même police de base et même ombre
// que ceux de la première vidéo (charte → sous_titres). Seuls changent :
// l'apparition mot par mot, le mot en cours en orange et les mots-clés en Figtree Black.
export const SousTitres: React.FC<{projet: any; charte: any}> = ({projet, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (projet.sous_titres.mode !== 'mot_a_mot') return null;

  const masques = projet.effets.filter((e: any) => projet.sous_titres.masquer_pendant.includes(e.type));
  const visibilite = 1 - Math.max(0, ...masques.map((e: any) => fondu(t, e.debut - 0.06, e.fin, 0.12)));
  if (visibilite <= 0.001) return null;
  const groupe = projet.groupes.find((g: any) => t >= g.debut - 0.05 && t < g.fin_affichage);
  if (!groupe) return null;

  const st = charte.sous_titres;
  const n = st.normal;
  const M = charte.moteur.sous_titres;
  const em = emDepuisAss(n.taille_ass);
  const o = st.ombre;
  const ombre = `${o.decalage_x_px}px ${o.decalage_y_px}px ${o.flou}px rgba(0,0,0,1), ${o.decalage_x_px}px ${o.decalage_y_px}px ${o.epaisseur_px}px rgba(0,0,0,0.95), 0 0 ${o.epaisseur_px}px rgba(0,0,0,0.6)`;

  return (
    <div
      style={{
        position: 'absolute', left: 0, width: W, top: n.position.ligne_de_base_y - 0.85 * em,
        textAlign: 'center', fontSize: em, lineHeight: 1, opacity: visibilite, whiteSpace: 'nowrap',
      }}
    >
      <div style={{display: 'inline-block', transform: `scaleX(${n.largeur_lettres_pct / 100})`}}>
        {groupe.mots.map((m: any, i: number) => {
          const a = easeOut(prog(t, m.debut - 0.03, m.debut - 0.03 + M.apparition_s));
          const suivant = groupe.mots[i + 1];
          const actif = t >= m.debut - 0.03 && t < (suivant ? suivant.debut - 0.03 : m.fin + 0.15);
          return (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : ''}
              <span
                style={{
                  display: 'inline-block', fontFamily: m.cle ? M.mots_cles_police : n.police,
                  color: actif ? M.mot_actif_couleur : st.couleur, textShadow: ombre, opacity: a,
                  transform: `translateY(${((1 - a) * 10).toFixed(1)}px)`, filter: a < 1 ? `blur(${((1 - a) * 5).toFixed(1)}px)` : 'none',
                }}
              >
                {m.texte}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeInOut, easeOut, prog} from '../temps';
import {styleEvidence} from '../miseEnEvidence';

// Quatrième famille d'effets (Black and Bike, v2), pour varier sur une même vidéo (demande de l'utilisateur) :
//  - titre_empile : phrase empilée sur le buste, sous le visage, comme « COLLEGE STUDENT » dans la vidéo de référence :
//    petites lignes et grandes lignes en alternance, chaque mot arrive quand il est dit ; elle remplace les sous-titres.
//  - barre_recherche : barre de recherche « IA » sous le visage, le texte s'y tape au rythme de la voix.
//  - barres_comparees : deux barres « avant / aujourd'hui » qui se remplissent, le résultat (« ×2 ») surgit au bout.
// Noir et blanc, Figtree. Réglages : charte → moteur.graphiques.

const ombre = '0 4px 22px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.5)';

export const TitreEmpile: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const G = charte.moteur.graphiques.empile;
  const sortie = easeInOut(prog(t, e.fin - 0.25, e.fin));
  const lignes: any[] = e._t.lignes;
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: e.y ?? G.y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: G.ecart_px,
      opacity: 1 - sortie, filter: sortie > 0 ? `blur(${(sortie * 10).toFixed(1)}px)` : 'none', textAlign: 'center'}}>
      {lignes.map((l, li) => {
        const grand = l.style === 'grand' || l.style === 'evidence';
        const taille = l.taille ?? (grand ? G.grand_px : G.petit_px);
        const base: React.CSSProperties = grand
          ? {fontFamily: 'Figtree Black', fontSize: taille, lineHeight: 1, letterSpacing: '-0.01em', textTransform: 'uppercase'}
          : {fontFamily: 'Figtree SemiBold', fontSize: taille, lineHeight: 1.15};
        return (
          <div key={li} style={{...base, color: '#fff', textShadow: ombre, maxWidth: W - 80}}>
            {l.mots.map((m: any, mi: number) => {
              const a = easeOut(prog(t, m.debut - 0.02, m.debut + (grand ? 0.16 : 0.12)));
              const evid = l.style === 'evidence' ? styleEvidence('Figtree Black', taille, charte) : {};
              return (
                <React.Fragment key={mi}>
                  <span style={{display: 'inline-block', opacity: a, ...evid,
                    transform: `${(evid as any).transform ?? ''} translateY(${((1 - a) * (grand ? 26 : 14)).toFixed(1)}px) scale(${(grand ? 1.18 - 0.18 * a : 1).toFixed(3)})`,
                    filter: a < 1 ? `blur(${((1 - a) * 8).toFixed(1)}px)` : 'none'}}>{m.mot}</span>
                  {mi < l.mots.length - 1 ? ' ' : ''}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// petite étoile à quatre branches (symbole courant de l'IA), dessinée en noir
const Etincelle: React.FC<{taille: number; couleur: string; tourne?: number}> = ({taille, couleur, tourne = 0}) => (
  <svg viewBox="0 0 24 24" width={taille} height={taille} style={{transform: `rotate(${tourne.toFixed(1)}deg)`}}>
    <path d="M12 1.5 C12.8 7.2 16.8 11.2 22.5 12 C16.8 12.8 12.8 16.8 12 22.5 C11.2 16.8 7.2 12.8 1.5 12 C7.2 11.2 11.2 7.2 12 1.5 Z" fill={couleur} />
    <path d="M19.5 2 C19.8 3.6 20.4 4.2 22 4.5 C20.4 4.8 19.8 5.4 19.5 7 C19.2 5.4 18.6 4.8 17 4.5 C18.6 4.2 19.2 3.6 19.5 2 Z" fill={couleur} />
  </svg>
);

export const BarreRecherche: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const G = charte.moteur.graphiques.recherche;
  const {frappe, finFrappe} = e._t;
  const entree = spring({frame: (t - e.debut) * fps, fps, config: {damping: 16, stiffness: 160}});
  const sortie = easeInOut(prog(t, e.fin - 0.22, e.fin));
  const n = Math.max(0, Math.min(e.texte.length, Math.round(e.texte.length * prog(t, frappe, finFrappe))));
  const saisi = e.texte.slice(0, n);
  const curseur = Math.floor(t * 3.5) % 2 === 0 || (t > frappe && t < finFrappe);
  const clic = t >= finFrappe + 0.05 && t < finFrappe + 0.2;
  const largeur = e.largeur ?? G.largeur_px;
  const h = G.hauteur_px;
  return (
    <div style={{position: 'absolute', left: (W - largeur) / 2, top: (e.y ?? G.y) - h / 2, width: largeur, height: h, borderRadius: h / 2, background: 'rgba(255,255,255,0.97)',
      boxShadow: '0 18px 50px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', gap: 22, padding: `0 ${h * 0.18}px 0 ${h * 0.32}px`, boxSizing: 'border-box',
      opacity: Math.min(1, entree * 1.4) * (1 - sortie), transform: `translateY(${((1 - entree) * 70 - sortie * 20).toFixed(1)}px) scale(${(0.92 + 0.08 * entree).toFixed(3)})`}}>
      <Etincelle taille={h * 0.42} couleur="#111" tourne={(t - e.debut) * 40} />
      <div style={{flex: 1, fontFamily: 'Figtree Medium', fontSize: G.texte_px, color: saisi ? '#111' : '#9a9a9a', whiteSpace: 'nowrap', overflow: 'hidden'}}>
        {saisi || e.invite || G.invite}
        {saisi && curseur && <span style={{display: 'inline-block', width: 4, height: G.texte_px * 0.9, background: '#111', marginLeft: 4, verticalAlign: 'middle'}} />}
      </div>
      <div style={{width: h * 0.66, height: h * 0.66, borderRadius: '50%', background: saisi ? '#111' : '#cfcfcf', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${clic ? 0.86 : 1})`}}>
        <svg viewBox="0 0 24 24" width={h * 0.32} height={h * 0.32}><path d="M12 19 V6 M6 11 L12 5 L18 11" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
};

export const BarresComparees: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const G = charte.moteur.graphiques.barres;
  const largeur = e.largeur ?? G.largeur_px;
  const x0 = (W - largeur) / 2;
  const temps: number[] = e._t.lignes;
  const sortie = easeInOut(prog(t, e.fin - 0.25, e.fin));
  const titre = easeOut(prog(t, e.debut, e.debut + 0.3));
  const pop = t >= e.cle ? spring({frame: (t - e.cle) * fps, fps, config: {damping: 10, stiffness: 210, mass: 0.7}}) : 0;
  return (
    <div style={{position: 'absolute', left: 0, top: e.y ?? G.y, width: W, opacity: 1 - sortie, filter: sortie > 0 ? `blur(${(sortie * 8).toFixed(1)}px)` : 'none'}}>
      {e.titre && (
        <div style={{position: 'absolute', left: x0, top: 0, fontFamily: 'Figtree Bold', fontSize: 26, letterSpacing: '0.26em', textTransform: 'uppercase', color: '#fff', textShadow: ombre,
          opacity: titre}}>{e.titre}</div>
      )}
      {e.lignes.map((l: any, i: number) => {
        const ti = temps[i];
        const a = easeOut(prog(t, ti, ti + (l.duree ?? 0.55)));
        const y = 56 + i * G.pas_px;
        const fin = largeur * l.valeur * a;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: x0, top: y, fontFamily: 'Figtree Bold', fontSize: 28, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#fff', textShadow: ombre,
              opacity: easeOut(prog(t, ti - 0.1, ti + 0.15))}}>{l.label}</div>
            <div style={{position: 'absolute', left: x0, top: y + 42, width: largeur, height: G.hauteur_px, borderRadius: 12, background: 'rgba(0,0,0,0.42)',
              border: '1.5px solid rgba(255,255,255,0.22)', boxSizing: 'border-box', opacity: easeOut(prog(t, ti - 0.15, ti + 0.1))}} />
            <div style={{position: 'absolute', left: x0, top: y + 42, width: fin, height: G.hauteur_px, borderRadius: 12, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.35)'}} />
            {i === e.lignes.length - 1 && t >= e.cle && (
              <div style={{position: 'absolute', left: x0 + fin + 22, top: y + 42 + G.hauteur_px / 2 - (e.label_taille ?? 110) * 0.55, fontFamily: 'Figtree Black',
                fontSize: e.label_taille ?? 110, lineHeight: 1.1, color: '#fff', textShadow: ombre, transform: `scale(${(0.3 + 0.7 * pop).toFixed(3)})`, transformOrigin: '0% 50%',
                opacity: Math.min(1, pop * 2)}}>{e.label}</div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

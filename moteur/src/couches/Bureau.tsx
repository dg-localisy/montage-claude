import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeIn, easeInOut, easeOut, prog} from '../temps';

// Cinquième famille d'effets (DS Cleaning), « bureau » : des objets du quotidien d'un chef d'entreprise, en noir et blanc,
// en Figtree, différents des familles précédentes (verre, étiquettes noires, pages, graphiques) :
//  - chapitre : petit repère « 01 — AVANT » écrit sur le mur, au-dessus de la tête, avec deux traits qui s'allongent ;
//  - tampon : un tampon encreur claque sous le visage (« HYPER CHER »), légèrement de travers, encre un peu irrégulière ;
//  - ticket : un ticket de caisse sort d'une fente sous le visage et s'imprime ligne par ligne au rythme de la voix ;
//  - choix : carte blanche à deux options (façon sondage Instagram, sans pourcentage inventé), écrite au rythme de la voix,
//    l'option dont il parle est soulignée par un cadre noir.
// Réglages : charte → moteur.bureau.

// mot qui passe du flou au net au moment où il est dit
const Mot: React.FC<{t: number; debut: number; children: React.ReactNode; style?: React.CSSProperties}> = ({t, debut, children, style}) => {
  const a = easeOut(prog(t, debut - 0.03, debut + 0.2));
  return (
    <span style={{display: 'inline-block', opacity: a, filter: a < 0.98 ? `blur(${((1 - a) * 9).toFixed(1)}px)` : 'none',
      transform: `translateY(${((1 - a) * 8).toFixed(1)}px)`, ...style}}>{children}</span>
  );
};

const Mots: React.FC<{t: number; mots: {mot: string; debut: number}[]; style?: React.CSSProperties}> = ({t, mots, style}) => (
  <>
    {mots.map((m, i) => (
      <React.Fragment key={i}>
        <Mot t={t} debut={m.debut} style={style}>{m.mot}</Mot>
        {i < mots.length - 1 ? ' ' : ''}
      </React.Fragment>
    ))}
  </>
);

export const Chapitre: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const B = charte.moteur.bureau.chapitre;
  const couleur = e.couleur ?? B.couleur;
  const entree = easeOut(prog(t, e.debut, e.debut + 0.4));
  const traits = easeInOut(prog(t, e.debut + 0.1, e.debut + 0.7));
  const sortie = easeInOut(prog(t, e.fin - 0.3, e.fin));
  const y = e.y ?? B.y;
  const x = e.x ?? W / 2;
  return (
    <div style={{position: 'absolute', left: x - W / 2, width: W, top: y, display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity: entree * (1 - sortie), filter: entree < 0.98 || sortie > 0 ? `blur(${((1 - entree) * 8 + sortie * 8).toFixed(1)}px)` : 'none',
      transform: `translateY(${((1 - entree) * -14).toFixed(1)}px)`}}>
      <div style={{fontFamily: 'Figtree Bold', fontSize: B.numero_px, letterSpacing: '0.3em', color: couleur, opacity: 0.6, marginBottom: 6, paddingLeft: '0.3em'}}>{e.numero}</div>
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <div style={{width: B.trait_px * traits, height: 3, background: couleur, borderRadius: 2}} />
        <div style={{fontFamily: 'Figtree Black', fontSize: B.texte_px, letterSpacing: '0.24em', color: couleur, paddingLeft: '0.24em', whiteSpace: 'nowrap'}}>{e.texte}</div>
        <div style={{width: B.trait_px * traits, height: 3, background: couleur, borderRadius: 2}} />
      </div>
    </div>
  );
};

export const Tampon: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  const coup: number = e._t.coup;
  if (t < coup - 0.12 || t > e.fin) return null;
  const B = charte.moteur.bureau.tampon;
  // le tampon descend vite (grand, flou, transparent), claque, rebondit à peine, puis l'encre « sèche » ; il s'efface à la fin
  const chute = easeIn(prog(t, coup - 0.12, coup));
  const rebond = t >= coup ? spring({frame: (t - coup) * fps, fps, config: {damping: 13, stiffness: 320, mass: 0.6}}) : 0;
  const echelle = t < coup ? 1.9 - 0.9 * chute : 1 + 0.06 * (1 - rebond);
  const tremble = t >= coup && t < coup + 0.12 ? Math.sin((t - coup) * 140) * 5 * (1 - (t - coup) / 0.12) : 0;
  const sortie = easeInOut(prog(t, e.fin - 0.28, e.fin));
  const angle = e.angle ?? B.angle_deg;
  const taille = e.taille ?? B.texte_px;
  const id = `encre-${e.id}`;
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: (e.y ?? B.y) - taille, height: taille * 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: (t < coup ? 0.25 + 0.75 * chute : 1) * (1 - sortie)}}>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <defs>
          {/* encre irrégulière : bords un peu rongés et petits manques, comme un vrai tampon */}
          <filter id={id} x="-10%" y="-20%" width="120%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={e.id + 3} result="bruit" />
            <feDisplacementMap in="SourceGraphic" in2="bruit" scale="5" xChannelSelector="R" yChannelSelector="G" result="ronge" />
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed={e.id + 11} result="taches" />
            <feColorMatrix in="taches" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.4 2.15" result="masque" />
            <feComposite in="ronge" in2="masque" operator="in" />
          </filter>
        </defs>
      </svg>
      <div style={{transform: `translateX(${tremble.toFixed(1)}px) rotate(${angle}deg) scale(${echelle.toFixed(4)})`,
        filter: t < coup ? `blur(${((1 - chute) * 10).toFixed(1)}px) drop-shadow(0 6px 18px rgba(0,0,0,0.5))` : 'drop-shadow(0 6px 18px rgba(0,0,0,0.5))'}}>
        <div style={{filter: `url(#${id})`, border: `${B.bord_px}px solid #fff`, borderRadius: 14, padding: `${Math.round(taille * 0.12)}px ${Math.round(taille * 0.32)}px`, position: 'relative'}}>
          <div style={{position: 'absolute', inset: 7, border: '2px solid #fff', borderRadius: 9}} />
          <div style={{fontFamily: 'Figtree Black', fontSize: taille, lineHeight: 1, letterSpacing: '0.06em', color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{e.texte}</div>
        </div>
      </div>
    </div>
  );
};

// ticket de caisse : la fente (trait noir) apparaît, le papier se déroule vers le bas au rythme des lignes,
// puis remonte dans la fente à la fin
export const Ticket: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const B = charte.moteur.bureau.ticket;
  const largeur = e.largeur ?? B.largeur_px;
  const x0 = (W - largeur) / 2;
  const y0 = e.y ?? B.y;
  const lignes: any[] = e._t.lignes;
  const fente = easeOut(prog(t, e.debut, e.debut + 0.25)) * (1 - easeIn(prog(t, e.fin - 0.12, e.fin)));
  const sortie = easeInOut(prog(t, e.fin - 0.4, e.fin - 0.1));
  const marge = 30;
  // hauteur de papier sortie : l'en-tête, puis chaque ligne quand elle s'imprime (le papier avance en 0,25 s)
  const entete = easeOut(prog(t, e.debut + 0.1, e.debut + 0.45));
  let hauteur = (marge + B.entete_px) * entete;
  const tops: number[] = [];
  let y = marge + B.entete_px;
  for (const l of lignes) {
    tops.push(y);
    y += l.hauteur;
    hauteur += l.hauteur * easeInOut(prog(t, l.debut - 0.12, l.debut + 0.13));
  }
  const der = lignes[lignes.length - 1];
  hauteur += marge * easeInOut(prog(t, der.debut, der.debut + 0.3));
  hauteur *= 1 - sortie;
  const dent = 12;
  const zigzag = 'polygon(0 0,100% 0,' + [...Array(31)].map((_, i) => `${100 - (i / 30) * 100}% ${i % 2 ? '100%' : `calc(100% - ${dent}px)`}`).join(',') + ')';
  return (
    <>
      {/* papier (sous la fente) */}
      <div style={{position: 'absolute', left: x0, top: y0, width: largeur, height: hauteur + dent, overflow: 'hidden', filter: 'drop-shadow(0 14px 24px rgba(0,0,0,0.45))'}}>
        <div style={{position: 'absolute', inset: 0, background: '#fff', clipPath: zigzag}} />
        <div style={{position: 'absolute', left: 0, width: largeur, top: marge, height: B.entete_px, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Figtree Black', fontSize: B.entete_texte_px, letterSpacing: '0.24em', paddingLeft: '0.24em', color: '#0b0b0b', opacity: entete}}>{e.entete}</div>
        {lignes.map((l, i) => {
          const a = easeOut(prog(t, l.debut - 0.02, l.debut + 0.22));
          const st: React.CSSProperties = {position: 'absolute', left: 40, right: 40, top: tops[i], height: l.hauteur, display: 'flex', alignItems: 'center', color: '#0b0b0b',
            opacity: a, filter: a < 0.98 ? `blur(${((1 - a) * 6).toFixed(1)}px)` : 'none'};
          if (l.type === 'tirets') {
            return <div key={i} style={{...st, opacity: 1, filter: 'none'}}><div style={{flex: 1, borderTop: '3px dashed rgba(11,11,11,0.5)', transform: `scaleX(${a.toFixed(3)})`, transformOrigin: '0 50%'}} /></div>;
          }
          if (l.type === 'ligne') {
            return (
              <div key={i} style={{...st, justifyContent: 'space-between', gap: 20}}>
                <span style={{fontFamily: 'Figtree Medium', fontSize: B.ligne_px, whiteSpace: 'nowrap'}}>{l.texte}</span>
                {l.montant && <Mot t={t} debut={l.montant_debut} style={{fontFamily: 'Figtree Black', fontSize: B.ligne_px * 1.15, whiteSpace: 'nowrap'}}>{l.montant}</Mot>}
              </div>
            );
          }
          if (l.type === 'petit') {
            return <div key={i} style={{...st, justifyContent: l.droite ? 'flex-end' : 'center', fontFamily: 'Figtree SemiBold', fontSize: B.petit_px, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.6 * a}}>{l.texte}</div>;
          }
          if (l.type === 'total') {
            return (
              <div key={i} style={{...st, opacity: 1, filter: 'none', justifyContent: 'center', fontFamily: 'Figtree Black', fontSize: B.total_px, letterSpacing: '-0.01em', whiteSpace: 'nowrap'}}>
                <span><Mots t={t} mots={l.mots} /></span>
              </div>
            );
          }
          return null;
        })}
      </div>
      {/* fente de l'imprimante, par-dessus le haut du papier */}
      <div style={{position: 'absolute', left: x0 - 36, width: largeur + 72, top: y0 - 13, height: 20, borderRadius: 10, background: '#0b0b0b',
        boxShadow: '0 6px 22px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.2)', transform: `scaleX(${fente.toFixed(3)})`, opacity: fente}} />
    </>
  );
};

// carte à deux options, au rythme de la voix ; l'option en cours est encadrée de noir
export const Choix: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const B = charte.moteur.bureau.choix;
  const largeur = e.largeur ?? B.largeur_px;
  const entree = spring({frame: (t - e.debut) * fps, fps, config: {damping: 17, stiffness: 150}});
  const sortie = easeInOut(prog(t, e.fin - 0.3, e.fin));
  const options: any[] = e._t.options;
  const ou: number = e._t.ou;
  // option active : la dernière dont le premier mot a été dit
  let active = -1;
  options.forEach((o, i) => { if (t >= o.mots[0].debut - 0.05) active = i; });
  const ligne = (o: any, i: number) => {
    const visible = easeOut(prog(t, o.mots[0].debut - 0.15, o.mots[0].debut + 0.15));
    const actif = easeInOut(active === i ? prog(t, o.mots[0].debut - 0.05, o.mots[0].debut + 0.2) : i < active ? 1 - prog(t, options[active].mots[0].debut - 0.05, options[active].mots[0].debut + 0.25) : 0);
    const coche = easeOut(prog(t, o.mots[0].debut, o.mots[0].debut + 0.3));
    return (
      <div key={i} style={{display: 'flex', alignItems: 'center', gap: 26, padding: '18px 28px', borderRadius: 24, background: '#f1f1f1',
        boxShadow: `inset 0 0 0 ${(2 + 2 * actif).toFixed(1)}px rgba(11,11,11,${(0.12 + 0.88 * actif).toFixed(3)})`, opacity: 0.6 + 0.4 * visible,
        transform: `translateY(${((1 - visible) * 16).toFixed(1)}px)`}}>
        <div style={{flex: 'none', width: 40, height: 40, borderRadius: 20, boxShadow: `inset 0 0 0 3px rgba(11,11,11,${(0.35 + 0.65 * actif).toFixed(3)})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{width: 20, height: 20, borderRadius: 10, background: '#0b0b0b', transform: `scale(${(coche * actif).toFixed(3)})`}} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
          <div style={{fontFamily: 'Figtree Bold', fontSize: B.option_px, lineHeight: 1.12, color: '#0b0b0b'}}><Mots t={t} mots={o.mots} /></div>
          {o.sous && <div style={{fontFamily: 'Figtree Medium', fontSize: B.sous_px, lineHeight: 1.15, color: '#5a5a5a'}}><Mots t={t} mots={o.sous} /></div>}
        </div>
      </div>
    );
  };
  return (
    <div style={{position: 'absolute', left: (W - largeur) / 2, top: e.y ?? B.y, width: largeur, borderRadius: 38, background: '#fff', padding: '24px 28px 26px', boxSizing: 'border-box',
      boxShadow: '0 24px 60px rgba(0,0,0,0.45)', opacity: Math.min(1, entree * 1.3) * (1 - sortie),
      transform: `translateY(${((1 - entree) * 90 + sortie * 30).toFixed(1)}px) scale(${(0.94 + 0.06 * entree).toFixed(4)})`}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16}}>
        <div style={{fontFamily: 'Figtree Bold', fontSize: B.titre_px, letterSpacing: '0.28em', color: '#0b0b0b', opacity: 0.55, paddingLeft: '0.28em'}}>{e.titre}</div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 0}}>
        {ligne(options[0], 0)}
        <div style={{display: 'flex', alignItems: 'center', gap: 18, height: 50, padding: '0 40px', opacity: easeOut(prog(t, ou - 0.1, ou + 0.2))}}>
          <div style={{flex: 1, height: 2, background: 'rgba(11,11,11,0.15)'}} />
          <div style={{fontFamily: 'Figtree Bold', fontSize: B.ou_px, color: '#0b0b0b', opacity: 0.5, letterSpacing: '0.1em'}}>{e.separateur ?? 'OU'}</div>
          <div style={{flex: 1, height: 2, background: 'rgba(11,11,11,0.15)'}} />
        </div>
        {options[1] && ligne(options[1], 1)}
      </div>
    </div>
  );
};


import React from 'react';
import {AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeInOut, easeOut, prog} from '../temps';

// Troisième famille d'effets, inspirée de la vidéo de référence « Raw Video / Claude Edit » (interview Jensen Huang),
// adaptée à la charte : noir et blanc, Figtree uniquement. Réglages : charte → moteur.pages.
//  - page : page plein écran (papier clair ou fond sombre), la phrase s'écrit au rythme de la voix, mot clé encadré,
//    objet au centre (image fournie par l'utilisateur) qui passe du flou au net, « vs » pour opposer deux idées,
//    flash blanc à l'entrée et à la sortie. Elle remplace les sous-titres pendant qu'elle est affichée.
//  - etiquettes_flottantes : étiquettes qui apparaissent en zigzag de chaque côté du buste (sous le visage).
//  - mot_souligne : grand mot en Figtree Bold (droit, comme les sous-titres ; demande de l'utilisateur) sous le visage, souligné par un trait qui se dessine,
//    remplaçable par un autre mot ; petite ligne d'introduction en Figtree Light.

// code-barres décoratif, toujours le même pour une page donnée
const CodeBarres: React.FC<{graine: number; couleur: string}> = ({graine, couleur}) => {
  let x = 0;
  let s = graine * 9301 + 49297;
  const barres: React.ReactNode[] = [];
  while (x < 120) {
    s = (s * 9301 + 49297) % 233280;
    const w = 1 + (s % 3);
    if ((s >> 3) % 3 !== 0) barres.push(<rect key={x} x={x} y={0} width={w} height={34} fill={couleur} />);
    x += w + 1 + ((s >> 5) % 2);
  }
  return <svg width={120} height={34}>{barres}</svg>;
};

// un mot qui s'écrit : invisible avant d'être dit, puis apparaît (léger flou, gris qui fonce)
const Mot: React.FC<{t: number; debut: number; style?: React.CSSProperties; clair: boolean; flou?: number; children?: React.ReactNode}> = ({t, debut, style, clair, flou = 6, children}) => {
  const a = easeOut(prog(t, debut - 0.02, debut + 0.16));
  const fonce = easeOut(prog(t, debut, debut + 0.35));
  const gris = clair ? `rgba(17,17,17,${(0.35 + 0.65 * fonce).toFixed(3)})` : `rgba(255,255,255,${(0.45 + 0.55 * fonce).toFixed(3)})`;
  return (
    <span style={{display: 'inline-block', opacity: a, filter: a < 1 ? `blur(${((1 - a) * flou).toFixed(1)}px)` : 'none', color: gris, ...style}}>
      {children}
    </span>
  );
};

const ligneDeMots = (t: number, mots: {mot: string; debut: number}[], clair: boolean, flou?: number) =>
  mots.map((m, i) => (
    <React.Fragment key={i}>
      <Mot t={t} debut={m.debut} clair={clair} flou={flou}>{m.mot}</Mot>
      {i < mots.length - 1 ? ' ' : ''}
    </React.Fragment>
  ));

export const Page: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const P = charte.moteur.pages;
  const derniere = e.fin >= durationInFrames / fps - 0.05;
  const flashAvant = P.flash_s;
  if (t < e.debut - flashAvant || t > e.fin + flashAvant) return null;
  const clair = (e.fond ?? 'clair') === 'clair';
  const encre = clair ? '#111111' : '#FFFFFF';
  const elements: any[] = e._t.elements;
  const visible = t >= e.debut && t < e.fin;
  const entree = easeOut(prog(t, e.debut, e.debut + 0.3));
  // flash blanc (fuite de lumière en noir et blanc) sur la coupe d'entrée et de sortie
  const flash = (c: number) => Math.max(0, 1 - Math.abs(t - c) / flashAvant);
  const f = Math.max(e.flash === false ? 0 : flash(e.debut), e.flash === false || derniere ? 0 : flash(e.fin));
  const avecImage = elements.some((el) => el.type === 'image');
  const iVs = elements.findIndex((el) => el.type === 'vs' || el.type === 'fleche');
  const apresVs = iVs >= 0 ? elements.slice(iVs + 1).find((el) => el.debut !== undefined) : null;
  // les éléments avant le « vs » s'estompent quand la deuxième idée arrive
  const estompe = apresVs ? 1 - 0.62 * easeOut(prog(t, apresVs.debut - 0.1, apresVs.debut + 0.3)) : 1;

  const rendu = (el: any, k: number) => {
    const avant = iVs >= 0 && k < iVs ? estompe : 1;
    switch (el.type) {
      case 'etiquette':
        return (
          <div key={k} style={{fontFamily: 'Figtree Bold', fontSize: P.etiquette_px, letterSpacing: '0.24em', textTransform: 'uppercase', color: clair ? '#555' : 'rgba(255,255,255,0.7)',
            opacity: easeOut(prog(t, el.debut, el.debut + 0.3)) * avant}}>{el.texte}</div>
        );
      case 'petit':
        // « largeur » (px) : pour choisir où le texte passe à la ligne (lignes équilibrées, pas de mot seul en bas)
        return <div key={k} style={{fontFamily: 'Figtree Medium', fontSize: P.petit_px, lineHeight: 1.25, opacity: avant, maxWidth: el.largeur ?? 860}}>{ligneDeMots(t, el.mots, clair)}</div>;
      case 'italique':
        return (
          <div key={k} style={{fontFamily: 'Figtree Light Italic', fontSize: el.taille ?? P.italique_px, lineHeight: 1.02, letterSpacing: '-0.025em', opacity: avant, maxWidth: 960}}>
            {ligneDeMots(t, el.mots, clair, 12)}
          </div>
        );
      case 'grand':
        return (
          <div key={k} style={{fontFamily: 'Figtree Black', fontSize: el.taille ?? P.grand_px, lineHeight: 0.95, letterSpacing: '-0.02em', textTransform: 'uppercase', opacity: avant, maxWidth: el.largeur}}>
            {ligneDeMots(t, el.mots, clair, 14)}
          </div>
        );
      case 'cle':
      case 'appel': {
        // mot clé : boîte pleine (noire sur papier, blanche sur fond sombre) + cadre de sélection pointillé avec poignées
        const cle = el.type === 'cle';
        const b = easeInOut(prog(t, el.debut, el.debut + 0.26));
        const cadre = easeOut(prog(t, el.debut + 0.18, el.debut + 0.45));
        const taille = el.taille ?? (cle ? P.cle_px : P.appel_px);
        const poignee = (pos: React.CSSProperties) => (
          <div style={{position: 'absolute', width: 12, height: 12, background: clair ? '#fff' : '#111', border: `2px solid ${clair ? '#666' : '#aaa'}`, boxSizing: 'border-box', ...pos}} />
        );
        return (
          <div key={k} style={{position: 'relative', display: 'inline-block', padding: cle ? 16 : 0, opacity: avant}}>
            {cle && (
              <div style={{position: 'absolute', inset: 0, border: `2px dashed ${clair ? '#8a8a8a' : 'rgba(255,255,255,0.55)'}`, opacity: cadre}}>
                {poignee({left: -7, top: -7})}{poignee({right: -7, top: -7})}{poignee({left: -7, bottom: -7})}{poignee({right: -7, bottom: -7})}
              </div>
            )}
            <div style={{background: encre, color: clair ? '#fff' : '#000', fontFamily: 'Figtree Black', fontSize: taille, lineHeight: 1, letterSpacing: '-0.01em', textTransform: 'uppercase',
              padding: `${Math.round(taille * 0.12)}px ${Math.round(taille * 0.22)}px ${Math.round(taille * 0.08)}px`, clipPath: `inset(0 ${((1 - b) * 100).toFixed(2)}% 0 0)`}}>
              {el.texte}
            </div>
          </div>
        );
      }
      case 'vs': {
        const v = easeInOut(prog(t, el.debut, el.debut + 0.35));
        return (
          <div key={k} style={{position: 'relative', width: 820, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{position: 'absolute', left: 410 - 410 * v, width: 820 * v, top: 21, height: 2, background: clair ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'}} />
            <div style={{position: 'relative', fontFamily: 'Figtree Bold', fontSize: 22, letterSpacing: '0.1em', color: clair ? '#fff' : '#000', background: encre, borderRadius: 22,
              padding: '6px 16px', transform: `scale(${v.toFixed(3)})`}}>VS</div>
          </div>
        );
      }
      case 'fleche': {
        // flèche vers le bas (« on y arrive ») : la tige descend, puis la pointe se pose
        const v = easeInOut(prog(t, el.debut, el.debut + 0.3));
        const pointe = easeOut(prog(t, el.debut + 0.18, el.debut + 0.38));
        const h = el.hauteur ?? 150;
        return (
          <svg key={k} width={120} height={h} viewBox={`0 0 120 ${h}`} style={{overflow: 'visible'}}>
            <line x1={60} y1={8} x2={60} y2={8 + (h - 36) * v} stroke={encre} strokeWidth={11} strokeLinecap="round" opacity={v > 0.02 ? 1 : 0} />
            <path d={`M 22 ${h - 50} L 60 ${h - 12} L 98 ${h - 50}`} fill="none" stroke={encre} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round"
              opacity={pointe} transform={`translate(0 ${((1 - pointe) * -14).toFixed(1)})`} />
          </svg>
        );
      }
      case 'image': {
        // objet fourni par l'utilisateur : passe du flou au net, flotte doucement, petite ombre au sol
        const a = easeOut(prog(t, el.debut, el.debut + 0.55));
        const flotte = Math.sin((t - e.debut) * 1.6) * 7;
        const h = el.hauteur ?? P.image_hauteur_px;
        return (
          <div key={k} style={{position: 'relative', height: h + 40, width: 900, display: 'flex', justifyContent: 'center', opacity: avant}}>
            <Img src={staticFile(el.src)} style={{height: h, maxWidth: 820, objectFit: 'contain', transform: `translateY(${flotte.toFixed(1)}px) scale(${(0.93 + 0.07 * a).toFixed(4)})`,
              filter: `blur(${((1 - a) * 22).toFixed(1)}px) ${clair ? '' : 'drop-shadow(0 0 40px rgba(255,255,255,0.25))'}`, opacity: Math.min(1, a * 1.6)}} />
            <div style={{position: 'absolute', bottom: 6, left: 450 - 170, width: 340, height: 34, borderRadius: '50%',
              background: `radial-gradient(ellipse, rgba(0,0,0,${clair ? 0.28 : 0.6}) 0%, rgba(0,0,0,0) 70%)`, transform: `scaleX(${(1 - flotte / 90).toFixed(3)})`, opacity: a}} />
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <AbsoluteFill>
      {visible && (
        <AbsoluteFill style={{background: clair ? P.fond_clair : P.fond_sombre, filter: entree < 1 ? `blur(${((1 - entree) * 10).toFixed(1)}px)` : 'none', color: encre}}>
          {e.code_barres !== false && <div style={{position: 'absolute', top: P.code_barres_y, left: (W - 120) / 2, opacity: 0.85}}><CodeBarres graine={e.id + 3} couleur={encre} /></div>}
          {e.cote_gauche && (
            <div style={{position: 'absolute', left: 46, top: H * 0.47, transform: 'translate(-50%, -50%) rotate(-90deg)', fontFamily: 'Figtree SemiBold', fontSize: 18, letterSpacing: '0.32em',
              color: clair ? '#9a9a9a' : 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', textTransform: 'uppercase'}}>{e.cote_gauche}</div>
          )}
          {e.cote_droit && (
            <div style={{position: 'absolute', left: W - 46, top: H * 0.4, transform: 'translate(-50%, -50%) rotate(90deg)', fontFamily: 'Figtree SemiBold', fontSize: 18, letterSpacing: '0.32em',
              color: clair ? '#9a9a9a' : 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', textTransform: 'uppercase'}}>{e.cote_droit}</div>
          )}
          {/* avec un objet : le contenu part du haut ; sans objet : il est centré entre le code-barres et la source */}
          <div style={{position: 'absolute', left: 0, width: W, top: e.y ?? (avecImage ? P.contenu_y : P.code_barres_y + 140), height: avecImage || e.y ? undefined : P.source_y - P.code_barres_y - 240,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: avecImage || e.y ? 'flex-start' : 'center', gap: P.ecart_px, textAlign: 'center'}}>
            {elements.map(rendu)}
          </div>
          {/* signature : nom du client, mise en forme épurée (trait, nom espacé, mention en italique fin) */}
          {e.signature && (() => {
            const s = easeOut(prog(t, e.signature.temps ?? e.debut + 0.5, (e.signature.temps ?? e.debut + 0.5) + 0.45));
            return (
              <div style={{position: 'absolute', left: 0, width: W, top: e.signature.y ?? P.source_y - 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: s,
                transform: `translateY(${((1 - s) * 16).toFixed(1)}px)`}}>
                <div style={{width: 70 * s, height: 2, background: encre, opacity: 0.6}} />
                <div style={{fontFamily: 'Figtree Bold', fontSize: 30, letterSpacing: '0.34em', textTransform: 'uppercase', color: encre, marginRight: '-0.34em'}}>{e.signature.nom}</div>
                {e.signature.mention && <div style={{fontFamily: 'Figtree Light Italic', fontSize: 28, color: clair ? '#555' : 'rgba(255,255,255,0.72)'}}>{e.signature.mention}</div>}
              </div>
            );
          })()}
          {e.source && (
            <div style={{position: 'absolute', left: 120, width: W - 240, top: P.source_y, textAlign: 'center', fontFamily: 'Figtree Medium', fontSize: P.source_px, lineHeight: 1.35,
              color: clair ? '#7a7a7a' : 'rgba(255,255,255,0.5)', opacity: easeOut(prog(t, e.source_temps ?? e.debut + 0.6, (e.source_temps ?? e.debut + 0.6) + 0.4))}}>{e.source}</div>
          )}
        </AbsoluteFill>
      )}
      {f > 0 && (
        <AbsoluteFill style={{background: `radial-gradient(ellipse at ${(30 + 40 * prog(t, e.debut - flashAvant, e.fin + flashAvant)).toFixed(0)}% 40%, rgba(255,255,255,${(0.95 * f).toFixed(3)}) 0%, rgba(255,255,255,${(0.55 * f).toFixed(3)}) 45%, rgba(255,255,255,${(0.15 * f).toFixed(3)}) 100%)`}} />
      )}
    </AbsoluteFill>
  );
};

// ---------- étiquettes flottantes en zigzag sur le buste ----------
// Champs : items [texte], temps (sinon calés sur le premier mot de chaque élément), contexte (petit titre), y.
export const EtiquettesFlottantes: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const F = charte.moteur.pages.flottantes;
  const temps: number[] = e._t.items;
  const y0 = e.y ?? F.y;
  const enCours = temps.filter((x) => t >= x).length - 1;
  const sortie = easeInOut(prog(t, e.fin - 0.3, e.fin));

  return (
    <AbsoluteFill style={{opacity: 1 - sortie, filter: sortie > 0 ? `blur(${(sortie * 8).toFixed(1)}px)` : 'none'}}>
      {e.contexte && (
        <div style={{position: 'absolute', left: 0, width: W, top: y0 - 58, textAlign: 'center', fontFamily: 'Figtree Bold', fontSize: 24, letterSpacing: '0.26em', color: '#fff',
          textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.8)', opacity: easeOut(prog(t, e.debut, e.debut + 0.3))}}>{e.contexte}</div>
      )}
      {e.items.map((it: any, i: number) => {
        const ti = temps[i];
        if (t < ti - 0.02) return null;
        const a = spring({frame: (t - ti) * fps, fps, config: {damping: 14, stiffness: 170}});
        const gauche = i % 2 === 0;
        const estompe = i < enCours ? 1 - 0.45 * easeOut(prog(t, temps[i + 1], temps[i + 1] + 0.25)) : 1;
        const texte = typeof it === 'string' ? it : it.texte;
        return (
          <div key={i} style={{position: 'absolute', top: y0 + i * (e.pas ?? F.pas_px), ...(gauche ? {right: W - F.x_gauche} : {left: F.x_droite}), display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 20px 11px 14px', borderRadius: 14, background: 'rgba(12,12,12,0.74)', border: '1.5px solid rgba(255,255,255,0.16)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            opacity: Math.min(1, a * 1.4) * estompe, transform: `translateX(${((1 - a) * (gauche ? -40 : 40)).toFixed(1)}px) scale(${(0.86 + 0.14 * a).toFixed(3)})`,
            filter: a < 0.95 ? `blur(${((1 - a) * 6).toFixed(1)}px)` : 'none'}}>
            <div style={{width: 18, height: 18, borderRadius: 5, border: '2.5px solid #fff', boxSizing: 'border-box'}} />
            <div style={{fontFamily: 'Figtree SemiBold', fontSize: e.taille ?? F.texte_px, color: '#fff', whiteSpace: 'nowrap', lineHeight: 1}}>{texte}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- grand mot en italique, souligné ----------
// Champs : mot, contexte (petite ligne au-dessus), ensuite {mot, temps} (le mot est remplacé), y, remplace.
export const MotSouligne: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const M = charte.moteur.pages.mot_souligne;
  const t1: number = e._t.mot;
  const t2: number | undefined = e._t.ensuite;
  const change = t2 !== undefined ? easeInOut(prog(t, t2 - 0.08, t2 + 0.18)) : 0;
  const sortie = easeInOut(prog(t, e.fin - 0.3, e.fin));
  const y = e.y ?? M.y;
  const mot = (texte: string, debut: number, opacite: number, decal: number) => {
    const a = easeOut(prog(t, debut - 0.02, debut + 0.22));
    const trait = easeInOut(prog(t, debut + 0.12, debut + 0.5));
    return (
      <div style={{position: 'absolute', left: 0, width: W, top: 0, textAlign: 'center', opacity: a * opacite, transform: `translateY(${decal.toFixed(1)}px)`,
        filter: a * opacite < 0.98 ? `blur(${((1 - a * opacite) * 12).toFixed(1)}px)` : 'none'}}>
        <span style={{position: 'relative', display: 'inline-block', fontFamily: e.police ?? 'Figtree Bold', fontSize: e.taille ?? M.taille_px, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.05,
          textShadow: '3px 5px 9px rgba(0,0,0,0.75)'}}>
          {texte}
          <span style={{position: 'absolute', left: '4%', bottom: -Math.round((e.taille ?? M.taille_px) * 0.12), height: 5, width: `${(92 * trait).toFixed(1)}%`, background: '#fff', borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.4)'}} />
        </span>
      </div>
    );
  };
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: y, opacity: 1 - sortie}}>
      {e.contexte && (
        <div style={{position: 'absolute', left: 0, width: W, top: -(e.contexte_taille ?? 54) - 8, textAlign: 'center', fontFamily: 'Figtree Light', fontSize: e.contexte_taille ?? 54, color: '#fff',
          textShadow: '3px 4px 7px rgba(0,0,0,0.75)', opacity: easeOut(prog(t, e.debut, e.debut + 0.3))}}>{e.contexte}</div>
      )}
      {mot(e.mot, t1, 1 - change, -20 * change)}
      {e.ensuite && t2 !== undefined && mot(e.ensuite.mot, t2, change, 20 * (1 - change))}
    </div>
  );
};

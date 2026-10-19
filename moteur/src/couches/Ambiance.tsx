import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, fondu, lerp, prog} from '../temps';

// Transition « lumière colorée » : un halo chaud traverse l'image au moment de la coupe.
export const Lumieres: React.FC<{projet: any; charte: any}> = ({projet, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = frame / fps;
  const [c1, c2, c3] = charte.moteur.transitions.lumiere_couleurs;
  return (
    <>
      {projet.transitions
        .filter((tr: any) => tr.style === 'lumiere' && Math.abs(t - tr.debut) < tr.duree / 2)
        .map((tr: any, i: number) => {
          const p = prog(t, tr.debut - tr.duree / 2, tr.debut + tr.duree / 2);
          const force = Math.sin(Math.PI * p);
          const x = lerp(-0.35 * W, 1.35 * W, p);
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: 0.95 * force,
                background: `radial-gradient(circle at ${x}px ${H * 0.42}px, ${c3} 0%, ${c2} 14%, ${c1}aa 32%, transparent 62%), radial-gradient(ellipse at ${W - x * 0.6}px ${H * 0.75}px, ${c1}88 0%, transparent 45%)`}} />
              <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: 0.32 * Math.pow(force, 4)}} />
            </React.Fragment>
          );
        })}
    </>
  );
};

// Grain de film, vignette et barre de chapitres.
export const Ambiance: React.FC<{projet: any; charte: any}> = ({projet, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = frame / fps;
  const A = charte.moteur.ambiance;
  const finales = projet.effets.filter((e: any) => e.type === 'carte_fin' || e.type === 'signature');
  const masqueChapitres = Math.max(0, ...finales.map((e: any) => fondu(t, e.debut - 0.25, e.fin + 1, 0.25)));
  const chapitres = projet.chapitres;
  const actuel = chapitres.findIndex((c: any) => t >= c.debut && t < c.fin);
  const x0 = 90;
  const total = 900;
  const ecart = 10;
  const largeurUtile = total - ecart * Math.max(0, chapitres.length - 1);
  const accroche = projet.effets.find((e: any) => e.type === 'accroche');
  const departChapitres = accroche ? accroche.fin - 0.2 : 0.2;
  const apparition = easeOut(prog(t, departChapitres, departChapitres + 0.4));
  let x = x0;

  return (
    <>
      {projet.ambiance.vignette > 0 && (
        <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,${projet.ambiance.vignette}) 100%)`}} />
      )}
      {chapitres.length > 0 && (
        <div style={{position: 'absolute', inset: 0, opacity: apparition * (1 - masqueChapitres)}}>
          {chapitres.map((c: any, i: number) => {
            const largeur = (largeurUtile * (c.fin - c.debut)) / projet.duree;
            const rempli = i < actuel ? 1 : i === actuel ? prog(t, c.debut, c.fin) : 0;
            const gauche = x;
            x += largeur + ecart;
            return (
              <div key={i} style={{position: 'absolute', left: gauche, top: A.chapitres_y, width: largeur, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.28)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'}}>
                <div style={{width: `${rempli * 100}%`, height: '100%', background: '#fff'}} />
              </div>
            );
          })}
          {actuel >= 0 && (
            <div style={{position: 'absolute', left: x0, top: A.chapitres_y + 18, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Figtree SemiBold', fontSize: 25, letterSpacing: 3, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', textShadow: '0 2px 10px rgba(0,0,0,0.5)'}}>
              <div style={{width: 9, height: 9, borderRadius: 5, background: '#fff'}} />
              {chapitres[actuel].titre}
            </div>
          )}
        </div>
      )}
      {projet.ambiance.grain > 0 && (
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: projet.ambiance.grain, mixBlendMode: 'overlay'}}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      )}
    </>
  );
};

// Carte de fin avec le nom (seulement si effets.json la demande).
export const CarteFin: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut) return null;
  const F = charte.moteur.carte_fin;
  const accent = charte.moteur.accent;
  const fond = easeOut(prog(t, e.debut, e.debut + 0.3));
  const barre = easeOut(prog(t, e.debut + 0.15, e.debut + 0.5));
  const role = easeOut(prog(t, e.debut + 0.35, e.debut + 0.65));
  const lettres = String(e.nom).split('');
  const logo = charte.marque?.logo?.fichiers?.blanc_png;
  const estLaMarque = logo && String(e.nom).trim().toUpperCase() === 'LOCALISY';
  const revele = easeOut(prog(t, e.debut + 0.1, e.debut + 0.6));
  return (
    <div style={{position: 'absolute', inset: 0, background: `rgba(0,0,0,${(0.92 * fond).toFixed(3)})`}}>
      <div style={{position: 'absolute', left: 0, width: W, top: 820, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{width: 90 * barre, height: 7, borderRadius: 4, background: accent, marginBottom: 34}} />
        {estLaMarque ? (
          <Img src={staticFile(logo)} style={{width: 620, height: 'auto', opacity: revele, clipPath: `inset(0 ${((1 - revele) * 100).toFixed(1)}% 0 0)`, transform: `translateY(${((1 - revele) * 20).toFixed(1)}px)`}} />
        ) : (
          <div style={{fontFamily: F.police_nom, fontSize: F.taille_nom_px, color: '#fff', letterSpacing: -2, lineHeight: 1, whiteSpace: 'pre'}}>
            {lettres.map((l, i) => {
              const a = easeOut(prog(t, e.debut + 0.1 + i * 0.035, e.debut + 0.1 + i * 0.035 + 0.3));
              return <span key={i} style={{display: 'inline-block', opacity: a, transform: `translateY(${((1 - a) * 40).toFixed(1)}px)`}}>{l}</span>;
            })}
          </div>
        )}
        {e.role && <div style={{fontFamily: 'Figtree Light', fontSize: 44, color: 'rgba(255,255,255,0.82)', marginTop: 22, opacity: role, transform: `translateY(${((1 - role) * 16).toFixed(1)}px)`}}>{e.role}</div>}
      </div>
    </div>
  );
};

// Signature de fin discrète (charte → fin.signature) : le logo LOCALISY en petit, en haut, en fondu.
export const Signature: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const sig = charte.fin.signature;
  const a = prog(t, e.debut, e.debut + 0.3);
  if (sig.type === 'logo' && sig.fichier) {
    return (
      <div style={{position: 'absolute', left: 0, width: W, top: e.y ?? sig.position.y, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)', opacity: sig.opacite * a}}>
        <Img src={staticFile(sig.fichier)} style={{width: sig.largeur_px, height: 'auto', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.45))'}} />
      </div>
    );
  }
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: (e.y ?? sig.position.y) - (sig.taille_px ?? 44) * 0.6, textAlign: 'center', fontFamily: sig.police, fontSize: sig.taille_px ?? 44, lineHeight: 1.2, color: sig.couleur, opacity: sig.opacite * a, textShadow: '0 2px 12px rgba(0,0,0,0.45)'}}>
      {e.texte || sig.texte}
    </div>
  );
};

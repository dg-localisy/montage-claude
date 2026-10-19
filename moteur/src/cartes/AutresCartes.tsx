import React from 'react';
import {easeOut, lerp, nombreFr, prog} from '../temps';

const cadre: React.CSSProperties = {
  position: 'absolute', inset: 0, background: '#0e0e0e', borderRadius: 32, border: '1.5px solid rgba(255,255,255,0.12)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.6)', padding: '34px 26px', display: 'flex', flexDirection: 'column',
};
const titre: React.CSSProperties = {fontFamily: 'Figtree Bold', fontSize: 30, color: '#fff', marginBottom: 26, lineHeight: 1.2};

// Entonnoir : les étapes apparaissent l'une après l'autre, la dernière en orange.
export const Entonnoir: React.FC<{e: any; t: number; charte: any}> = ({e, t, charte}) => {
  const accent = charte.couleurs.orange;
  const n = e.etapes.length;
  const largeur = 388;
  const hauteur = 118;
  return (
    <div style={cadre}>
      {e.titre && <div style={titre}>{e.titre}</div>}
      <div style={{position: 'relative', flex: 1}}>
        {e.etapes.map((etape: any, i: number) => {
          const a = easeOut(prog(t, e._t.etapes[i], e._t.etapes[i] + 0.35));
          const haut = largeur * (1 - (i / n) * 0.62);
          const bas = largeur * (1 - ((i + 1) / n) * 0.62);
          const derniere = i === n - 1;
          const valeur = typeof etape.valeur === 'number' ? nombreFr(lerp(0, etape.valeur, a)) : etape.valeur;
          return (
            <div key={i} style={{position: 'absolute', left: 0, top: i * (hauteur + 12), width: largeur, height: hauteur, opacity: a, transform: `scaleX(${(0.6 + 0.4 * a).toFixed(3)})`}}>
              <svg width={largeur} height={hauteur} style={{position: 'absolute', inset: 0}}>
                <path
                  d={`M${(largeur - haut) / 2} 1 H${(largeur + haut) / 2} L${(largeur + bas) / 2} ${hauteur - 1} H${(largeur - bas) / 2} Z`}
                  fill={derniere ? 'rgba(255,77,0,0.16)' : 'rgba(255,255,255,0.07)'} stroke={derniere ? accent : 'rgba(255,255,255,0.7)'} strokeWidth={2} strokeLinejoin="round"
                />
              </svg>
              <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                <div style={{fontFamily: 'Figtree Black', fontSize: 38, color: derniere ? accent : '#fff', lineHeight: 1}}>{valeur}</div>
                <div style={{fontFamily: 'Figtree Medium', fontSize: 21, color: 'rgba(255,255,255,0.75)', marginTop: 6}}>{etape.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Gros chiffre : le nombre défile au centre d'un anneau orange qui se remplit.
export const GrosChiffre: React.FC<{e: any; t: number; charte: any}> = ({e, t, charte}) => {
  const accent = charte.couleurs.orange;
  const [a, b] = e._t.comptage;
  const p = easeOut(prog(t, a, b));
  const r = 160;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{...cadre, alignItems: 'center'}}>
      {e.titre && <div style={{...titre, textAlign: 'center'}}>{e.titre}</div>}
      <div style={{position: 'relative', width: 2 * r + 24, height: 2 * r + 24, marginTop: 20}}>
        <svg width={2 * r + 24} height={2 * r + 24} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
          <circle cx={r + 12} cy={r + 12} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10} />
          <circle cx={r + 12} cy={r + 12} r={r} fill="none" stroke={accent} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${circ * p * (e.remplissage ?? 1)} ${circ}`} />
        </svg>
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Figtree Black', fontSize: 104, color: '#fff', letterSpacing: -3}}>
          {e.prefixe && <span style={{color: accent}}>{e.prefixe}</span>}
          {nombreFr(lerp(e.de ?? 0, e.valeur, p), e.decimales ?? 0)}
          {e.suffixe && <span style={{color: accent, fontSize: 64}}>{e.suffixe}</span>}
        </div>
      </div>
      {e.legende && <div style={{fontFamily: 'Figtree Medium', fontSize: 30, color: 'rgba(255,255,255,0.85)', marginTop: 34, textAlign: 'center', lineHeight: 1.3}}>{e.legende}</div>}
    </div>
  );
};

// Checklist : chaque ligne se coche à son tour (coche orange qui se dessine).
export const Checklist: React.FC<{e: any; t: number; charte: any}> = ({e, t, charte}) => {
  const accent = charte.couleurs.orange;
  return (
    <div style={cadre}>
      {e.titre && <div style={titre}>{e.titre}</div>}
      <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
        {e.items.map((item: string, i: number) => {
          const apparition = easeOut(prog(t, e._t.panneau + i * 0.08, e._t.panneau + i * 0.08 + 0.3));
          const coche = easeOut(prog(t, e._t.coches[i], e._t.coches[i] + 0.25));
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, opacity: apparition, transform: `translateX(${((1 - apparition) * 24).toFixed(1)}px)`}}>
              <div style={{width: 42, height: 42, borderRadius: 11, flexShrink: 0, border: `2px solid ${coche > 0 ? accent : 'rgba(255,255,255,0.6)'}`, background: coche > 0 ? 'rgba(255,77,0,0.12)' : 'transparent', position: 'relative'}}>
                <svg viewBox="0 0 24 24" width={38} height={38} style={{position: 'absolute', left: 0, top: 0}}>
                  <path d="M5.5 12.5 L10 17 L18.5 7.5" pathLength={1} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - coche} />
                </svg>
              </div>
              <div style={{fontFamily: 'Figtree Medium', fontSize: 28, lineHeight: 1.25, color: coche > 0.5 ? '#fff' : 'rgba(255,255,255,0.55)'}}>{item}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

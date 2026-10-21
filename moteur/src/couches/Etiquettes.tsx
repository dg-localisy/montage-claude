import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeInOut, easeOut, emDepuisAss, prog} from '../temps';

// Famille « étiquettes » : un deuxième langage visuel, différent des cartes en verre et des pastilles.
// Étiquettes noires à angles droits, texte blanc en Figtree, petite barre blanche sur le bord gauche,
// dévoilées par un balayage de gauche à droite et retirées par un balayage vers la droite.
// Lisibles sur un vêtement clair. Réglages : charte → moteur.etiquettes.

const balayage = (t: number, a: number, duree: number, fin: number, sortie: number) => {
  const entree = easeInOut(prog(t, a, a + duree));
  const retrait = easeInOut(prog(t, fin - sortie, fin));
  return {entree, retrait, clip: `inset(0 ${((1 - entree) * 100).toFixed(2)}% 0 ${(retrait * 100).toFixed(2)}%)`};
};

// Une étiquette : boîte noire, barre blanche à gauche, contenu qui glisse un peu après la boîte.
const Etiquette: React.FC<{t: number; a: number; fin: number; E: any; claire?: boolean; style?: React.CSSProperties; children: React.ReactNode}> = ({t, a, fin, E, claire, style, children}) => {
  const {entree, clip} = balayage(t, a, E.duree_balayage_s, fin, E.duree_sortie_s);
  const texte = easeOut(prog(t, a + E.duree_balayage_s * 0.45, a + E.duree_balayage_s * 1.3));
  return (
    <div style={{position: 'relative', display: 'inline-block', background: claire ? '#fff' : `rgba(0,0,0,${E.opacite_fond})`, clipPath: clip,
      boxShadow: claire ? '0 10px 30px rgba(0,0,0,0.35)' : 'none', ...style}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: E.barre_px, background: claire ? '#000' : '#fff', transform: `scaleY(${entree.toFixed(3)})`, transformOrigin: '50% 0'}} />
      <div style={{opacity: texte, transform: `translateX(${((1 - texte) * -18).toFixed(1)}px)`}}>{children}</div>
    </div>
  );
};

// ---------- titre en bandeaux (accroche) et nom en bandeau (présentation) ----------
// titre_bandeau : une ligne par bandeau, sous le visage, juste au-dessus des sous-titres.
// variante « nom » : un seul bandeau posé sur la ligne des sous-titres (qui s'effacent avec remplace_temps), petit sur-titre facultatif.
export const TitreBandeau: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const E = charte.moteur.etiquettes;
  const st = charte.sous_titres.normal;
  const nom = e.variante === 'nom';
  const lignes: string[] = e._t.lignes;
  const taille = e.taille ?? (nom ? E.nom_taille_px : E.titre_taille_px);
  const padV = Math.round(taille * 0.2);
  const padH = Math.round(taille * 0.38);
  const hBande = Math.round(taille * 0.92) + 2 * padV;
  const ecart = E.ecart_bandes_px;
  const emST = emDepuisAss(st.taille_ass);
  const hautST = st.position.ligne_de_base_y - 0.72 * emST;
  // nom, ou position « sous_titres » : le bloc est centré sur la ligne des sous-titres (qui s'effacent avec remplace_temps) ;
  // sinon le dernier bandeau finit juste au-dessus des sous-titres
  const surLaLigne = nom || e.position === 'sous_titres';
  const total = lignes.length * hBande + (lignes.length - 1) * ecart;
  const haut = surLaLigne ? st.position.ligne_de_base_y - 0.36 * emST - total / 2 : hautST - E.marge_sous_titres_px - total;
  const Es = e.sortie_s !== undefined ? {...E, duree_sortie_s: e.sortie_s} : E;
  const surTaille = E.surtitre_taille_px;

  return (
    <div style={{position: 'absolute', left: 0, top: haut, width: W, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ecart}}>
      {nom && e.surtitre && (
        <div style={{position: 'absolute', top: -surTaille - 16, left: 0, width: W, textAlign: 'center', fontFamily: 'Figtree Bold', fontSize: surTaille, letterSpacing: '0.14em',
          color: '#fff', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.7)', opacity: easeOut(prog(t, e.debut + 0.25, e.debut + 0.55)) * (1 - prog(t, e.fin - 0.25, e.fin))}}>
          {e.surtitre}
        </div>
      )}
      {lignes.map((ligne, i) => (
        <Etiquette key={i} t={t} a={e.temps_lignes?.[i] ?? e.debut + i * E.decalage_bandes_s} fin={e.fin - (lignes.length - 1 - i) * 0.04} E={Es}>
          <div style={{fontFamily: nom ? 'Figtree ExtraBold' : 'Figtree Black', fontSize: taille, lineHeight: `${hBande}px`, height: hBande, padding: `0 ${padH}px 0 ${padH + E.barre_px}px`,
            color: '#fff', letterSpacing: nom ? '0.05em' : '0.01em', whiteSpace: 'nowrap'}}>
            {ligne}
          </div>
        </Etiquette>
      ))}
    </div>
  );
};

// ---------- compteur à rouleaux ----------
// Le chiffre défile comme un compteur mécanique (le dernier chiffre tourne le plus vite), dans une boîte noire ;
// la légende arrive ensuite dans une étiquette blanche, en dessous. Champs : valeur, prefixe, suffixe, legende, y.
const Rouleau: React.FC<{pos: number; vitesse: number; h: number; id: string}> = ({pos, vitesse, h, id}) => {
  const p = ((pos % 10) + 10) % 10;
  const flou = Math.min(10, Math.abs(vitesse) * 0.06 * h / 10);
  return (
    <span style={{display: 'inline-block', height: h, overflow: 'hidden', verticalAlign: 'top'}}>
      <svg width="0" height="0" style={{position: 'absolute'}}><defs><filter id={id}><feGaussianBlur stdDeviation={`0 ${flou.toFixed(2)}`} /></filter></defs></svg>
      <span style={{display: 'block', transform: `translateY(${(-p * h).toFixed(2)}px)`, filter: flou > 0.3 ? `url(#${id})` : 'none'}}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => <span key={i} style={{display: 'block', height: h, lineHeight: `${h}px`}}>{d}</span>)}
      </span>
    </span>
  );
};

export const Compteur: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const E = charte.moteur.etiquettes;
  const taille = e.taille ?? E.compteur_taille_px;
  const [a, b] = e._t.comptage;
  const courbe = (x: number) => easeOut(prog(x, a, b));
  const valeur = Math.round(e.valeur);
  const chiffres = String(valeur).split('');
  const n = chiffres.length;
  const h = Math.round(taille * 1.02);
  const y = e.y ?? E.compteur_y;
  const boite = balayage(t, e.debut, 0.28, e.fin, E.duree_sortie_s);
  const monte = easeOut(prog(t, e.debut, e.debut + 0.3));
  const arrive = t > b ? 1 + 0.05 * Math.exp(-(t - b) * 12) : 1;

  return (
    <div style={{position: 'absolute', left: 0, width: W, top: y - h / 2, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{position: 'relative', background: `rgba(0,0,0,${E.opacite_fond})`, clipPath: boite.clip, padding: `0 ${Math.round(taille * 0.22)}px`,
        transform: `translateY(${((1 - monte) * 30).toFixed(1)}px) scale(${arrive.toFixed(4)})`}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: E.barre_px, background: '#fff'}} />
        <div style={{fontFamily: 'Figtree Black', fontSize: taille, color: '#fff', height: h, lineHeight: `${h}px`, display: 'flex', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums'}}>
          {e.prefixe && <span>{e.prefixe}</span>}
          {chiffres.map((_, i) => {
            const puissance = Math.pow(10, n - 1 - i);
            const pos = (valeur * courbe(t)) / puissance;
            const vitesse = ((valeur * courbe(t + 1 / fps)) / puissance - pos) * fps;
            return <Rouleau key={i} pos={pos} vitesse={vitesse} h={h} id={`rouleau-${e.id}-${i}`} />;
          })}
          {e.suffixe && <span>{e.suffixe}</span>}
        </div>
      </div>
      {e.legende && (
        <Etiquette t={t} a={b - 0.05} fin={e.fin} E={E} claire style={{marginTop: -6}}>
          <div style={{fontFamily: 'Figtree ExtraBold', fontSize: E.legende_taille_px, color: '#000', textTransform: 'uppercase', letterSpacing: '0.08em', padding: `10px 22px 10px ${22 + E.barre_px}px`, whiteSpace: 'nowrap'}}>
            {e.legende}
          </div>
        </Etiquette>
      )}
    </div>
  );
};

// ---------- frise chronologique ----------
// Une ligne blanche descend, un losange s'allume à chaque étape et une étiquette noire se dévoile à côté.
// L'étape en cours est pleine, les précédentes s'estompent un peu. Champs : titre, items [{texte, etape}], temps, x, y.
export const Frise: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const E = charte.moteur.etiquettes;
  const F = E.frise;
  const x0 = e.x ?? F.x;
  const y0 = e.y ?? F.y;
  const temps: number[] = e._t.items;
  const items = e.items.map((it: any) => (typeof it === 'string' ? {texte: it} : it));
  const hTitre = F.titre_taille_px + 26;
  const debutLigne = y0 + hTitre + 14;
  const rangee = (i: number) => debutLigne + 10 + i * F.hauteur_rangee_px;
  // la ligne descend jusqu'à l'étape en cours
  let bas = debutLigne;
  temps.forEach((ti, i) => {
    const cible = rangee(i) + F.hauteur_rangee_px * 0.42;
    const precedent = i === 0 ? debutLigne : rangee(i - 1) + F.hauteur_rangee_px * 0.42;
    if (t >= ti - 0.25) bas = precedent + (cible - precedent) * easeInOut(prog(t, ti - 0.25, ti));
  });
  const enCours = temps.filter((ti) => t >= ti).length - 1;
  const sortie = easeInOut(prog(t, e.fin - E.duree_sortie_s, e.fin));

  return (
    <div style={{position: 'absolute', inset: 0, opacity: 1 - sortie, transform: `translateX(${(-40 * sortie).toFixed(1)}px)`}}>
      <div style={{position: 'absolute', left: x0 - 12, top: y0}}>
        <Etiquette t={t} a={e.debut} fin={e.fin + 1} E={E}>
          <div style={{fontFamily: 'Figtree Black', fontSize: F.titre_taille_px, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: `${hTitre}px`,
            padding: `0 20px 0 ${20 + E.barre_px}px`, whiteSpace: 'nowrap'}}>
            {e.titre}
          </div>
        </Etiquette>
      </div>
      <div style={{position: 'absolute', left: x0 - 2, top: debutLigne, width: 4, height: Math.max(0, bas - debutLigne), background: '#fff', boxShadow: '0 0 12px rgba(0,0,0,0.5)'}} />
      {items.map((it: any, i: number) => {
        const ti = temps[i];
        if (t < ti - 0.02) return null;
        const pop = spring({frame: (t - ti) * fps, fps, config: {damping: 11, stiffness: 180}});
        const estompe = i < enCours ? 1 - 0.42 * easeOut(prog(t, temps[i + 1], temps[i + 1] + 0.25)) : 1;
        const cy = rangee(i) + F.hauteur_rangee_px * 0.42;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: x0 - 11, top: cy - 11, width: 22, height: 22, background: '#fff', border: '3px solid #000', boxSizing: 'border-box',
              transform: `rotate(45deg) scale(${pop.toFixed(3)})`}} />
            <div style={{position: 'absolute', left: x0 + 34, top: rangee(i), opacity: estompe}}>
              <Etiquette t={t} a={ti} fin={e.fin + 1} E={E}>
                <div style={{padding: `9px 22px 10px ${20 + E.barre_px}px`, whiteSpace: 'nowrap'}}>
                  {it.etape && <div style={{fontFamily: 'Figtree Bold', fontSize: F.etape_taille_px, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1.1}}>{it.etape}</div>}
                  <div style={{fontFamily: 'Figtree Bold', fontSize: F.texte_taille_px, color: '#fff', lineHeight: 1.15}}>{it.texte}</div>
                </div>
              </Etiquette>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------- bilan : ce qui marche est coché, ce qui ne marche pas est rayé ----------
// Étiquettes empilées sous le visage. Champs : items [{texte, marque: "coche"}], temps, barrer: {index, temps}, y.
export const Bilan: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const E = charte.moteur.etiquettes;
  const B = E.bilan;
  // s'il dure jusqu'à la fin de la vidéo, il reste affiché jusqu'à la dernière image (pas de balayage de sortie coupé)
  const finSortie = e.fin >= durationInFrames / fps - 0.05 ? e.fin + 1 : e.fin;
  const temps: number[] = e._t.items;
  const items = e.items.map((it: any) => (typeof it === 'string' ? {texte: it} : it));
  const taille = B.texte_taille_px;

  return (
    <div style={{position: 'absolute', left: 0, width: W, top: e.y ?? B.y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: E.ecart_bandes_px + 4}}>
      {items.map((it: any, i: number) => {
        const ti = temps[i];
        if (t < ti - 0.02) return <div key={i} style={{height: taille * 1.15 + 24}} />;
        const coche = easeOut(prog(t, ti + 0.25, ti + 0.55));
        const barre = e.barrer && e.barrer.index === i ? easeInOut(prog(t, e.barrer.temps, e.barrer.temps + 0.35)) : 0;
        return (
          <Etiquette key={i} t={t} a={ti} fin={finSortie} E={E}>
            <div style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 16, padding: `12px 26px 12px ${20 + E.barre_px}px`, whiteSpace: 'nowrap'}}>
              {it.marque === 'coche' && (
                <svg viewBox="0 0 24 24" width={taille * 0.95} height={taille * 0.95}>
                  <path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray={26} strokeDashoffset={(26 * (1 - coche)).toFixed(2)} />
                </svg>
              )}
              <div style={{position: 'relative', fontFamily: 'Figtree Bold', fontSize: taille, color: '#fff', lineHeight: 1.15, opacity: 1 - 0.35 * barre}}>
                {it.texte}
                {barre > 0 && <div style={{position: 'absolute', left: -6, top: '54%', height: 5, width: `calc(${(barre * 100).toFixed(1)}% + 12px)`, background: '#fff', borderRadius: 3}} />}
              </div>
            </div>
          </Etiquette>
        );
      })}
    </div>
  );
};

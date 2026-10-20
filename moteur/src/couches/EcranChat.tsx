import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeInOut, easeOut, prog} from '../temps';

// Écran façon ChatGPT (noir et blanc), dans l'esprit de la vidéo de référence : une fenêtre arrive en 3D et flotte
// sur un fond sombre, la question se tape lettre par lettre, un curseur vient cliquer sur « envoyer »,
// puis l'assistant « réfléchit » (point qui pulse). Jamais de réponse : on n'invente rien.
// Champs : debut, fin, question, salutation (facultatif). Réglages : charte → moteur.ecran_chat.
// La fenêtre reste au-dessus des sous-titres (qui restent affichés par-dessus).
export const EcranChat: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t >= e.fin) return null;
  const C = charte.moteur.ecran_chat;
  const T = e._t;

  const fond = easeOut(prog(t, e.debut, e.debut + 0.18));
  const entree = spring({frame: (t - e.debut) * fps, fps, config: {damping: 15, stiffness: 110, mass: 0.9}});
  const derive = prog(t, e.debut, e.fin); // lente dérive pendant tout l'écran, comme dans la référence
  const nb = Math.max(0, Math.min(e.question.length, Math.floor((t - T.frappe) * T.vitesse)));
  const envoye = t >= T.envoi;
  const saisi = envoye ? '' : e.question.slice(0, nb);
  const bulle = easeOut(prog(t, T.envoi, T.envoi + 0.22));
  const curseurTexte = !envoye && (nb < e.question.length || Math.floor(t * 3) % 2 === 0);
  const clic = t >= T.envoi - 0.05 && t < T.envoi + 0.1;

  const texte = '#ececec';
  const lf = C.fenetre_largeur_px;
  const hf = C.fenetre_hauteur_px;
  const xf = (W - lf) / 2;
  const yf = C.fenetre_y;
  // position du bouton « envoyer » dans la fenêtre, et trajet du curseur jusqu'à lui
  const bouton = {x: lf - 40 - 38, y: hf - 60 - 55};
  const trajet = easeInOut(prog(t, T.envoi - 0.55, T.envoi - 0.08));
  const curseur = {x: lf + 120 + (bouton.x - lf - 120) * trajet, y: hf + 160 + (bouton.y - hf - 160) * trajet};

  const rotX = (1 - entree) * 32 + 7 - 3 * derive;
  const rotY = (1 - entree) * -22 - 7 + 4 * derive;
  const echelle = 0.72 + 0.28 * entree + 0.04 * derive;

  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, #222 0%, #0b0b0b 60%, #030303 100%)', opacity: fond}}>
      <div style={{position: 'absolute', inset: 0, perspective: 1700, perspectiveOrigin: `50% ${yf + hf / 2}px`}}>
        <div
          style={{
            position: 'absolute', left: xf, top: yf, width: lf, height: hf, borderRadius: 44, background: '#212121',
            border: '1.5px solid rgba(255,255,255,0.14)', boxShadow: '0 70px 140px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4)',
            transform: `translateY(${((1 - entree) * 260).toFixed(1)}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(${echelle.toFixed(4)})`,
            transformOrigin: '50% 50%', opacity: Math.min(1, entree * 1.5), overflow: 'visible',
          }}
        >
          {/* en-tête */}
          <div style={{position: 'absolute', top: 38, left: 44, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'Figtree SemiBold', fontSize: 44, color: texte}}>
            ChatGPT
            <svg viewBox="0 0 24 24" width={28} height={28}><path d="M6 9 L12 15 L18 9" fill="none" stroke="#b4b4b4" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          {/* avant l'envoi : la phrase d'accueil ; après : la question en bulle, et l'assistant qui réfléchit */}
          <div style={{position: 'absolute', left: 0, width: lf, top: hf * 0.36, textAlign: 'center', fontFamily: 'Figtree Medium', fontSize: 56, color: texte, opacity: 1 - bulle}}>
            {e.salutation || C.salutation}
          </div>
          {bulle > 0 && (
            <div style={{position: 'absolute', right: 44, top: 140, maxWidth: lf * 0.72, padding: '24px 32px', borderRadius: 36, background: '#303030', color: texte,
              fontFamily: 'Figtree Regular', fontSize: 42, lineHeight: 1.3, opacity: bulle, transform: `translateY(${((1 - bulle) * 150).toFixed(1)}px)`}}>
              {e.question}
            </div>
          )}
          {bulle > 0.6 && (
            <div style={{position: 'absolute', left: 54, top: 330, width: 28, height: 28, borderRadius: 14, background: texte,
              transform: `scale(${(0.75 + 0.25 * Math.abs(Math.sin((t - T.envoi) * 6))).toFixed(3)})`}} />
          )}
          {/* barre de saisie */}
          <div style={{position: 'absolute', left: 40, right: 40, bottom: 60, minHeight: 110, borderRadius: 40, background: '#303030', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', gap: 18, padding: '0 16px 0 26px'}}>
            <svg viewBox="0 0 24 24" width={36} height={36} style={{flexShrink: 0}}><path d="M12 5 V19 M5 12 H19" fill="none" stroke="#b4b4b4" strokeWidth={2} strokeLinecap="round" /></svg>
            <div style={{flex: 1, fontFamily: 'Figtree Regular', fontSize: 42, lineHeight: 1.25, color: saisi ? texte : '#8f8f8f', padding: '22px 0'}}>
              {saisi || 'Poser une question'}
              {saisi && curseurTexte && <span style={{display: 'inline-block', width: 3, height: 40, background: texte, marginLeft: 3, verticalAlign: 'middle'}} />}
            </div>
            <div style={{width: 76, height: 76, borderRadius: 38, flexShrink: 0, background: saisi ? '#ffffff' : '#676767', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${clic ? 0.86 : 1})`}}>
              <svg viewBox="0 0 24 24" width={36} height={36}><path d="M12 19 V6 M6 11 L12 5 L18 11" fill="none" stroke={saisi ? '#000' : '#2f2f2f'} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
          {/* curseur de souris qui vient cliquer sur « envoyer » */}
          {t >= T.envoi - 0.6 && (
            <svg viewBox="0 0 24 24" width={64} height={64} style={{position: 'absolute', left: curseur.x, top: curseur.y, transform: `scale(${clic ? 0.85 : 1})`, transformOrigin: '0 0',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))', opacity: easeOut(prog(t, T.envoi - 0.6, T.envoi - 0.45))}}>
              <path d="M3 2 L3 19 L7.5 14.8 L10.5 21.5 L13.3 20.3 L10.4 13.7 L16.5 13.7 Z" fill="#fff" stroke="#000" strokeWidth={1.2} strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

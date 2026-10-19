import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, prog} from '../temps';

// Écran plein cadre façon ChatGPT (mode sombre, donc noir et blanc) : une question se tape lettre par lettre,
// s'envoie, puis l'assistant « réfléchit » (point qui pulse). Jamais de réponse : on n'invente rien.
// Champs : debut, fin, question, salutation (facultatif). Réglages : charte → moteur.ecran_chat.
// Tout se place au-dessus des sous-titres (qui restent affichés par-dessus).
export const EcranChat: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t >= e.fin) return null;
  const C = charte.moteur.ecran_chat;
  const T = e._t;

  const entree = easeOut(prog(t, e.debut, e.debut + 0.2));
  const nb = Math.max(0, Math.min(e.question.length, Math.floor((t - T.frappe) * T.vitesse)));
  const envoye = t >= T.envoi;
  const saisi = envoye ? '' : e.question.slice(0, nb);
  const bulle = easeOut(prog(t, T.envoi, T.envoi + 0.22));
  const curseur = !envoye && (nb < e.question.length || Math.floor(t * 3) % 2 === 0);
  const appui = t >= T.envoi - 0.06 && t < T.envoi + 0.08 ? 0.88 : 1;

  const texte = '#ececec';
  const largeurBarre = 940;
  const yBarre = C.barre_y;

  return (
    <AbsoluteFill style={{background: '#212121', opacity: entree}}>
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${((1 - entree) * 30).toFixed(1)}px)`}}>
        {/* en-tête */}
        <div style={{position: 'absolute', top: 120, left: 70, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'Figtree SemiBold', fontSize: 46, color: texte}}>
          ChatGPT
          <svg viewBox="0 0 24 24" width={34} height={34}><path d="M6 9 L12 15 L18 9" fill="none" stroke="#b4b4b4" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <svg viewBox="0 0 24 24" width={52} height={52} style={{position: 'absolute', top: 118, right: 70}}>
          <path d="M4 20 H20 M14.5 5.5 L18.5 9.5 M7 17 L7.6 13.4 L16 5 L19 8 L10.6 16.4 Z" fill="none" stroke="#b4b4b4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* avant l'envoi : la phrase d'accueil ; après : la question en bulle, et l'assistant qui réfléchit */}
        <div style={{position: 'absolute', left: 0, width: W, top: yBarre - 210, textAlign: 'center', fontFamily: 'Figtree Medium', fontSize: 60, color: texte, opacity: 1 - bulle}}>
          {e.salutation || C.salutation}
        </div>
        {bulle > 0 && (
          <div style={{position: 'absolute', right: 70, top: yBarre - 330, maxWidth: 760, padding: '30px 40px', borderRadius: 48, background: '#303030', color: texte,
            fontFamily: 'Figtree Regular', fontSize: 44, lineHeight: 1.3, opacity: bulle, transform: `translateY(${((1 - bulle) * 120).toFixed(1)}px)`}}>
            {e.question}
          </div>
        )}
        {bulle > 0.6 && (
          <div style={{position: 'absolute', left: 80, top: yBarre - 120, width: 34, height: 34, borderRadius: 17, background: texte,
            transform: `scale(${(0.75 + 0.25 * Math.abs(Math.sin((t - T.envoi) * 6))).toFixed(3)})`}} />
        )}

        {/* barre de saisie */}
        <div style={{position: 'absolute', left: (W - largeurBarre) / 2, top: yBarre, width: largeurBarre, minHeight: 150, borderRadius: 52, background: '#303030',
          display: 'flex', alignItems: 'center', gap: 22, padding: '0 22px 0 30px', boxSizing: 'border-box'}}>
          <svg viewBox="0 0 24 24" width={44} height={44} style={{flexShrink: 0}}><path d="M12 5 V19 M5 12 H19" fill="none" stroke="#b4b4b4" strokeWidth={2} strokeLinecap="round" /></svg>
          <div style={{flex: 1, fontFamily: 'Figtree Regular', fontSize: 42, lineHeight: 1.25, color: saisi ? texte : '#8f8f8f', padding: '28px 0'}}>
            {saisi || 'Poser une question'}
            {saisi && curseur && <span style={{display: 'inline-block', width: 3, height: 46, background: texte, marginLeft: 3, verticalAlign: 'middle'}} />}
          </div>
          <div style={{width: 92, height: 92, borderRadius: 46, flexShrink: 0, background: saisi ? '#ffffff' : '#676767', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${appui})`}}>
            <svg viewBox="0 0 24 24" width={44} height={44}><path d="M12 19 V6 M6 11 L12 5 L18 11" fill="none" stroke={saisi ? '#000' : '#2f2f2f'} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

import React from 'react';
import {easeOut, prog} from '../temps';

// Fenêtre de chat IA : mon message se tape tout seul, s'envoie, l'IA « écrit… » puis répond.
export const ChatIA: React.FC<{e: any; t: number; charte: any}> = ({e, t, charte}) => {
  const C = charte.moteur.chat;
  const accent = charte.couleurs.orange;
  const T = e._t;
  const nbLettres = Math.max(0, Math.min(e.message.length, Math.floor((t - T.frappe) * C.lettres_par_s)));
  const envoye = t >= T.envoi;
  const texteSaisi = envoye ? '' : e.message.slice(0, nbLettres);
  const bulleMoi = easeOut(prog(t, T.envoi, T.envoi + 0.2));
  const points = t >= T.points[0] && t < T.points[1];
  const motsReponse = e.reponse.split(' ');
  const nbMots = t >= T.reponse ? Math.min(motsReponse.length, 1 + Math.floor((t - T.reponse) * C.mots_par_s)) : 0;
  const bulleIA = easeOut(prog(t, T.reponse, T.reponse + 0.2));
  const curseur = !envoye && Math.floor(t * 3) % 2 === 0;

  const bulle: React.CSSProperties = {padding: '16px 20px', borderRadius: 24, fontSize: 25, lineHeight: 1.3, maxWidth: '86%'};

  return (
    <div style={{position: 'absolute', inset: 0, background: '#0e0e0e', borderRadius: 32, border: '1.5px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6)'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '22px 22px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)'}}>
        <div style={{position: 'relative', width: 46, height: 46, borderRadius: 23, background: '#1e1e1e', border: '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg viewBox="0 0 24 24" width={24} height={24}><path d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" /></svg>
          <div style={{position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, background: accent, border: '2px solid #0e0e0e'}} />
        </div>
        <div>
          <div style={{fontFamily: 'Figtree SemiBold', fontSize: 26, color: '#fff'}}>{e.titre || 'Assistant IA'}</div>
          <div style={{fontFamily: 'Figtree Regular', fontSize: 19, color: '#8a8a8a', marginTop: 2}}>{points ? 'écrit…' : 'en ligne'}</div>
        </div>
      </div>

      <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14, padding: '18px 18px 10px'}}>
        {bulleMoi > 0 && (
          <div style={{...bulle, alignSelf: 'flex-end', background: '#fff', color: '#000', fontFamily: 'Figtree Medium', borderBottomRightRadius: 6, opacity: bulleMoi, transform: `translateY(${((1 - bulleMoi) * 20).toFixed(1)}px) scale(${(0.92 + 0.08 * bulleMoi).toFixed(3)})`, transformOrigin: '100% 100%'}}>
            {e.message}
          </div>
        )}
        {points && (
          <div style={{...bulle, alignSelf: 'flex-start', background: '#1f1f1f', display: 'flex', gap: 8, padding: '20px 22px', borderBottomLeftRadius: 6}}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{width: 11, height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.75)', transform: `translateY(${(-6 * Math.max(0, Math.sin((t - T.points[0]) * 9 - i * 0.9))).toFixed(1)}px)`}} />
            ))}
          </div>
        )}
        {nbMots > 0 && (
          <div style={{...bulle, alignSelf: 'flex-start', background: '#1f1f1f', color: '#fff', fontFamily: 'Figtree Regular', borderBottomLeftRadius: 6, opacity: bulleIA, transform: `translateY(${((1 - bulleIA) * 20).toFixed(1)}px)`}}>
            {motsReponse.slice(0, nbMots).join(' ')}
          </div>
        )}
      </div>

      <div style={{display: 'flex', alignItems: 'center', gap: 12, margin: '6px 16px 18px', padding: '0 8px 0 20px', height: 60, borderRadius: 30, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)'}}>
        <div style={{flex: 1, fontFamily: 'Figtree Regular', fontSize: 22, color: texteSaisi ? '#fff' : '#6d6d6d', whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {texteSaisi || 'Écrire un message…'}
          {texteSaisi && curseur && <span style={{display: 'inline-block', width: 2, height: 26, background: '#fff', marginLeft: 2, verticalAlign: 'middle'}} />}
        </div>
        <div style={{width: 44, height: 44, borderRadius: 22, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${t >= T.envoi && t < T.envoi + 0.15 ? 0.85 : 1})`}}>
          <svg viewBox="0 0 24 24" width={22} height={22}><path d="M12 19 V6 M6 11 L12 5 L18 11" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
    </div>
  );
};

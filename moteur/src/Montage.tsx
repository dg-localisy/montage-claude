import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Accroche} from './couches/Accroche';
import {Ambiance, CarteFin, Lumieres} from './couches/Ambiance';
import {Camera} from './couches/Camera';
import {Carte} from './couches/Carte';
import {Chiffre} from './couches/Chiffre';
import {GrandTitre} from './couches/GrandTitre';
import {Icone} from './couches/Icone';
import {Sons} from './couches/Sons';
import {SousTitres} from './couches/SousTitres';
import {usePolices} from './polices';
import {fondu} from './temps';

export type Props = {projet: any; charte: any};

// Compose toute la vidéo, du fond vers l'avant :
// caméra → cartes → icônes et chiffres → grands titres → accroche → sous-titres → lumières → ambiance → carte de fin → sons
export const Montage: React.FC<Props> = ({projet, charte}) => {
  usePolices(charte);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const effets = projet.effets;
  const de = (type: string) => effets.filter((e: any) => e.type === type);
  // voile sombre discret derrière les icônes et les chiffres, pour la lisibilité
  const voile = Math.max(0, ...[...de('icone'), ...de('chiffre')].map((e: any) => fondu(t, e.debut, e.fin, 0.2)));

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Camera projet={projet} charte={charte} />
      {de('carte').map((e: any) => <Carte key={e.id} e={e} charte={charte} />)}
      {voile > 0 && <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0) 100%)', opacity: voile}} />}
      {de('icone').map((e: any) => <Icone key={e.id} e={e} charte={charte} />)}
      {de('chiffre').map((e: any) => <Chiffre key={e.id} e={e} charte={charte} />)}
      {de('grand_titre').map((e: any) => <GrandTitre key={e.id} e={e} charte={charte} />)}
      {de('accroche').map((e: any) => <Accroche key={e.id} e={e} charte={charte} projet={projet} />)}
      <SousTitres projet={projet} charte={charte} />
      <Lumieres projet={projet} charte={charte} />
      <Ambiance projet={projet} charte={charte} />
      {de('carte_fin').map((e: any) => <CarteFin key={e.id} e={e} charte={charte} />)}
      <Sons projet={projet} />
    </AbsoluteFill>
  );
};

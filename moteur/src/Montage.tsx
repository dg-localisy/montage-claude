import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Accroche} from './couches/Accroche';
import {Ambiance, CarteFin, Lumieres, Signature} from './couches/Ambiance';
import {Camera} from './couches/Camera';
import {Carte} from './couches/Carte';
import {Chiffre} from './couches/Chiffre';
import {EcranChat} from './couches/EcranChat';
import {GrandTitre} from './couches/GrandTitre';
import {Icone} from './couches/Icone';
import {Liste} from './couches/Liste';
import {PlanDeCoupe} from './couches/PlanDeCoupe';
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
  // (seulement pour les icônes posées librement : les icônes liées à un mot et les chiffres sont sous le visage)
  const libres = de('icone').filter((e: any) => e.mot_id === undefined);
  const voile = Math.max(0, ...libres.map((e: any) => fondu(t, e.debut, e.fin, 0.2)));

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Camera projet={projet} charte={charte} />
      {de('plan_de_coupe').map((e: any) => <PlanDeCoupe key={e.id} e={e} charte={charte} etalonnage={projet.ambiance.etalonnage} />)}
      {de('ecran_chat').map((e: any) => <EcranChat key={e.id} e={e} charte={charte} />)}
      {de('carte').map((e: any) => <Carte key={e.id} e={e} charte={charte} />)}
      {voile > 0 && <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0) 100%)', opacity: voile}} />}
      {libres.map((e: any) => <Icone key={e.id} e={e} charte={charte} />)}
      {de('liste').map((e: any) => <Liste key={e.id} e={e} charte={charte} />)}
      {de('chiffre').map((e: any) => <Chiffre key={e.id} e={e} charte={charte} />)}
      {de('grand_titre').map((e: any) => <GrandTitre key={e.id} e={e} charte={charte} />)}
      {de('accroche').map((e: any) => <Accroche key={e.id} e={e} charte={charte} projet={projet} />)}
      <SousTitres projet={projet} charte={charte} />
      <Lumieres projet={projet} charte={charte} />
      <Ambiance projet={projet} charte={charte} />
      {de('signature').map((e: any) => <Signature key={e.id} e={e} charte={charte} />)}
      {de('carte_fin').map((e: any) => <CarteFin key={e.id} e={e} charte={charte} />)}
      <Sons projet={projet} />
    </AbsoluteFill>
  );
};

import React from 'react';
import {Composition, AbsoluteFill} from 'remotion';
const Test: React.FC = () => <AbsoluteFill style={{background: '#000', color: '#fff', fontSize: 80, justifyContent: 'center', alignItems: 'center'}}>Test</AbsoluteFill>;
export const Racine: React.FC = () => <Composition id="Test" component={Test} durationInFrames={30} fps={30} width={1080} height={1920} />;

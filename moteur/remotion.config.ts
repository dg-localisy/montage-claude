// Réglages pour « npx remotion studio » / « npx remotion render ».
// Les scripts (scripts/rendu.mjs) passent leurs propres options et n'utilisent pas ce fichier.
import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

const local = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (process.env.MOTEUR_NAVIGATEUR) Config.setBrowserExecutable(process.env.MOTEUR_NAVIGATEUR);
else if (fs.existsSync(local)) Config.setBrowserExecutable(local);
Config.setVideoImageFormat('jpeg');

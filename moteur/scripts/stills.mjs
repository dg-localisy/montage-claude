// Images fixes de contrôle seulement (aucun rendu vidéo) : node scripts/stills.mjs chemin/effets.json
process.argv.push('--stills-seulement');
await import('./rendu.mjs');

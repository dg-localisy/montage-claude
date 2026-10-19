// Petites fonctions de temps et d'animation partagées par tous les calques.
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const prog = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeIn = (x: number) => Math.pow(clamp(x), 3);
export const easeInOut = (x: number) => {
  const c = clamp(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
// 0 avant a, monte jusqu'à 1 en `d` secondes, reste à 1, redescend à 0 pour finir à b
export const fondu = (t: number, a: number, b: number, d: number) => {
  if (t < a || t > b) return 0;
  return Math.min(easeInOut(prog(t, a, a + d)), easeInOut(1 - prog(t, b - d, b)));
};
// taille ASS (libass) -> taille CSS : Figtree fait 1201 unités de haut pour 1000 d'em
export const emDepuisAss = (taille: number) => (taille * 1000) / 1201;
export const nombreFr = (v: number, decimales = 0) =>
  v.toFixed(decimales).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const sansPonctuation = (s: string) => s.normalize('NFC').toUpperCase().replace(/[!?;:.,…»«"“”]/g, '');

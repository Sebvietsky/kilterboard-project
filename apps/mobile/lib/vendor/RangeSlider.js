// Wrapper runtime : Metro charge ce .js et ré-exporte la vraie lib.
// Le type-check passe par RangeSlider.d.ts (co-localisé), qui a priorité de
// résolution sur ce .js → le .tsx non typé de rn-range-slider n'est jamais
// tiré dans le programme TypeScript.
export { default } from "rn-range-slider";

// Palette fixe utilisée dans les écrans admin : contrairement au thème joueur
// (qui suit le sport actif de la session via --brand*), l'admin voit padel ET
// badminton en même temps, donc chaque élément garde la couleur de SON sport,
// peu importe le sélecteur de session.
export const SPORT_COLORS = {
  padel: {
    bg: 'rgba(124,58,237,0.14)',
    dim: 'rgba(124,58,237,0.10)',
    border: '#7C3AED',
    text: '#C084FC',
  },
  badminton: {
    bg: 'rgba(163,230,53,0.14)',
    dim: 'rgba(163,230,53,0.10)',
    border: '#A3E635',
    text: '#BEF264',
  },
  // Pour ce qui ne concerne pas un sport en particulier (bloc "tous terrains",
  // annonce/événement commun aux deux sports).
  neutral: {
    bg: 'rgba(139,148,158,0.12)',
    dim: 'rgba(139,148,158,0.08)',
    border: '#8B949E',
    text: '#C9D1D9',
  },
}

export const SPORT_LABELS = { padel: 'Padel', badminton: 'Badminton' }

export function sportColor(sport) {
  return SPORT_COLORS[sport] || SPORT_COLORS.neutral
}

// BoidColor.ts

// A color of a family: hue, saturation, and lightness in dark mode then in light mode
type Stop = [lineage: number, hue: number, saturation: number, darkLightness: number, lightLightness: number];

// The color is the mark of a family, inherited from a parent: only a mutant gets a new shade, so the lineages can be seen
// - boids go from the blue of the first ones to green and nearly yellow on one side, to deep violet on the other
// - predators go from red to orange on one side, to mauve on the other
const BOID_STOPS: Stop[] = [
  [-1, 276, 85, 60, 38],
  [-0.5, 258, 95, 67, 45],
  [0, 235, 100, 70, 47],
  [0.35, 190, 90, 60, 36],
  [0.7, 130, 75, 58, 34],
  [1, 72, 90, 58, 36],
];
const PREDATOR_STOPS: Stop[] = [
  [-1, 302, 75, 72, 45],
  [0, 358, 100, 70, 47],
  [1, 382, 100, 60, 45],
];

// The shade of a lineage, between the two closest stops
function lineageColor(stops: Stop[], lineage: number, darkMode: boolean): [number, number, number] {
  const value = Math.max(-1, Math.min(1, lineage));
  let index = 0;
  while (index < stops.length - 2 && value > stops[index + 1][0]) {
    index++;
  }
  const [from, to] = [stops[index], stops[index + 1]];
  const t = (value - from[0]) / (to[0] - from[0]);
  const mix = (i: number) => from[i] + (to[i] - from[i]) * t;
  return [mix(1) % 360, mix(2), darkMode ? mix(3) : mix(4)];
}

// - a digesting predator loses its saturation
// - a dead boid fades away in grey
// - a Super Predator is golden
export function boidColor(
  isPredator: boolean,
  isDead: boolean,
  lineage: number,
  alpha: number,
  darkMode: boolean,
  opacity: number = 1,
  isSuper: boolean = false
): string {
  if (isDead) {
    return darkMode ? `rgba(255, 255, 255, ${alpha * opacity})` : `rgba(0, 0, 0, ${alpha * opacity})`;
  }
  if (isSuper) {
    return `hsla(45, 100%, ${darkMode ? 62 : 45}%, ${opacity})`;
  }

  const [hue, saturation, lightness] = lineageColor(isPredator ? PREDATOR_STOPS : BOID_STOPS, lineage, darkMode);
  return `hsla(${Math.round(hue)}, ${Math.round(isPredator ? saturation * alpha : saturation)}%, ${Math.round(lightness)}%, ${opacity})`;
}

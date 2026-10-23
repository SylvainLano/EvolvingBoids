// BoidColor.ts

// The color is derived from the genes:
// - speed shifts the hue (boids: violet <- blue -> cyan, predators: orange <- red -> magenta)
// - fertility shifts the lightness (more fertile is brighter)
// - a digesting predator loses its saturation
// - a dead boid fades away in grey
export function boidColor(
  isPredator: boolean,
  isDead: boolean,
  speedTrait: number,
  fertilityTrait: number,
  alpha: number,
  darkMode: boolean,
  opacity: number = 1
): string {
  if (isDead) {
    return darkMode ? `rgba(255, 255, 255, ${alpha * opacity})` : `rgba(0, 0, 0, ${alpha * opacity})`;
  }

  const hue = isPredator
    ? (360 - 40 * speedTrait) % 360
    : 240 - 50 * speedTrait;
  const saturation = isPredator ? 100 * alpha : 100;
  const lightness = (darkMode ? (isPredator ? 72 : 70) : 45) + 12 * fertilityTrait;

  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
}

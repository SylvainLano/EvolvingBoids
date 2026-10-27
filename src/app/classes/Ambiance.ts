// Ambiance.ts
import { CLASSIC_PALETTE, Palette } from './BoidColor';
import type { BoidShape } from './CanvasRenderer';

export type AmbianceName = 'classic' | 'abyss' | 'sunset' | 'aurora' | 'neon' | 'paper' | 'reef' | 'cosmos' | 'storm' | 'embers' | 'sakura';

// The look of the world: its background, the colors of the families, how they glow and leave their trails
export interface Ambiance {
  name: AmbianceName;
  title: string;
  dark: boolean | null;         // the dark mode that suits it, null to follow the one of the user
  glow: boolean;                // additive light, halos and glowing trails, or plain colors: silhouettes, ink
  palette: Palette;
  rainbow: boolean;             // the boids take the color of their heading instead of the one of their family
  trailFade: number;            // in seconds, the long trails are nearly gone after this time
  plankton: { color: [number, number, number], alpha: number } | null;   // null for the colors of the seasons
  algae: string | null;         // null for the colors of the seasons
  shape: BoidShape;             // the shape the cinema mode gives the boids with this ambiance
}

// The palettes have one lightness: an ambiance has its own background, whatever the dark mode
// The hues between two stops are mixed as numbers: from 350 to 10, the families between them would be cyan, 370 keeps them red
const stops = (...values: [number, number, number, number][]) =>
  values.map(([lineage, hue, saturation, lightness]) => [lineage, hue, saturation, lightness, lightness] as [number, number, number, number, number]);

export const AMBIANCES: Record<AmbianceName, Ambiance> = {
  classic: {
    name: 'classic', title: 'Classic', dark: null, glow: true, palette: CLASSIC_PALETTE, rainbow: false, trailFade: 1.5,
    plankton: null, algae: null, shape: 'arrow',
  },
  // Bioluminescent fish in the deep sea, under the light shafts and the falling marine snow
  abyss: {
    name: 'abyss', title: 'Abyss', dark: true, glow: true, rainbow: false, trailFade: 1.2,
    palette: {
      boids: stops([-1, 215, 90, 62], [0, 188, 100, 62], [1, 160, 85, 58]),
      predators: stops([-1, 290, 80, 66], [0, 325, 95, 66], [1, 345, 95, 63]),
    },
    plankton: { color: [40, 180, 230], alpha: 0.3 }, algae: 'rgba(40, 170, 150, 0.7)', shape: 'fish',
  },
  // Dark birds against a sunset sky, like a murmuration of starlings
  sunset: {
    name: 'sunset', title: 'Sunset', dark: true, glow: false, rainbow: false, trailFade: 0.5,
    palette: {
      boids: stops([-1, 270, 45, 14], [0, 250, 40, 10], [1, 225, 45, 16]),
      predators: stops([-1, 340, 60, 20], [0, 355, 70, 22], [1, 15, 70, 24]),
      dead: '50, 20, 50',
    },
    plankton: { color: [255, 215, 150], alpha: 0.25 }, algae: 'rgba(60, 25, 60, 0.8)', shape: 'bird',
  },
  // Glowing comets under the northern lights
  aurora: {
    name: 'aurora', title: 'Aurora', dark: true, glow: true, rainbow: false, trailFade: 2.5,
    palette: {
      boids: stops([-1, 170, 70, 78], [0, 140, 80, 80], [1, 100, 75, 78]),
      predators: stops([-1, 260, 80, 75], [0, 285, 85, 72], [1, 310, 85, 72]),
    },
    plankton: { color: [80, 255, 170], alpha: 0.18 }, algae: 'rgba(120, 255, 180, 0.6)', shape: 'comets',
  },
  // Rainbow light painting on a black grid, the color of a boid is its heading
  neon: {
    name: 'neon', title: 'Neon', dark: true, glow: true, rainbow: true, trailFade: 2,
    palette: {
      boids: stops([-1, 300, 100, 65], [1, 180, 100, 65]),
      predators: stops([-1, 0, 0, 92], [1, 0, 0, 98]),
    },
    plankton: { color: [255, 60, 220], alpha: 0.15 }, algae: 'rgba(60, 255, 120, 0.85)', shape: 'comets',
  },
  // Ink on paper, the trails like brush strokes
  paper: {
    name: 'paper', title: 'Paper', dark: false, glow: false, rainbow: false, trailFade: 1.5,
    palette: {
      boids: stops([-1, 230, 35, 25], [0, 215, 30, 18], [1, 195, 35, 24]),
      predators: stops([-1, 345, 55, 30], [0, 355, 65, 32], [1, 10, 65, 34]),
      dead: '60, 50, 40',
    },
    plankton: { color: [90, 150, 170], alpha: 0.22 }, algae: 'rgba(70, 110, 60, 0.8)', shape: 'arrow',
  },
  // Tropical fish in the daylight of a reef, under the rippling light of the surface, the algae like corals
  reef: {
    name: 'reef', title: 'Reef', dark: true, glow: false, rainbow: false, trailFade: 0.6,
    palette: {
      boids: stops([-1, 225, 85, 45], [-0.4, 320, 80, 62], [0, 405, 100, 55], [1, 420, 100, 58]),
      predators: stops([-1, 205, 18, 30], [1, 195, 15, 24]),
      dead: '220, 240, 245',
    },
    plankton: { color: [255, 255, 225], alpha: 0.18 }, algae: 'rgba(255, 110, 120, 0.8)', shape: 'fish',
  },
  // Blue-white comets among the nebulae, hunted by red stars
  cosmos: {
    name: 'cosmos', title: 'Cosmos', dark: true, glow: true, rainbow: false, trailFade: 3,
    palette: {
      boids: stops([-1, 195, 85, 78], [0, 215, 90, 84], [1, 240, 80, 82]),
      predators: stops([-1, 355, 90, 62], [1, 380, 95, 60]),
    },
    plankton: { color: [150, 120, 255], alpha: 0.15 }, algae: 'rgba(160, 140, 255, 0.55)', shape: 'comets',
  },
  // Pale seabirds in a stormy sky, hunted by dark ones, under a slanting rain and a distant lightning now and then
  storm: {
    name: 'storm', title: 'Storm', dark: true, glow: false, rainbow: false, trailFade: 0.4,
    palette: {
      boids: stops([-1, 215, 20, 86], [0, 210, 10, 92], [1, 190, 15, 88]),
      predators: stops([-1, 220, 25, 8], [1, 260, 20, 11]),
      dead: '25, 30, 40',
    },
    plankton: { color: [170, 190, 220], alpha: 0.18 }, algae: 'rgba(30, 38, 50, 0.8)', shape: 'bird',
  },
  // Sparks over the embers of a fire, hunted by white-hot ones
  embers: {
    name: 'embers', title: 'Embers', dark: true, glow: true, rainbow: false, trailFade: 1,
    palette: {
      boids: stops([-1, 12, 100, 55], [0, 28, 100, 57], [1, 46, 100, 60]),
      predators: stops([-1, 35, 100, 85], [0, 48, 80, 93], [1, 58, 100, 88]),
    },
    plankton: { color: [255, 90, 30], alpha: 0.18 }, algae: 'rgba(255, 80, 20, 0.6)', shape: 'comets',
  },
  // Plum birds in a pale dawn, among the falling cherry petals, the algae like dark branches
  sakura: {
    name: 'sakura', title: 'Sakura', dark: false, glow: false, rainbow: false, trailFade: 0.8,
    palette: {
      boids: stops([-1, 295, 35, 30], [0, 318, 40, 32], [1, 340, 40, 36]),
      predators: stops([-1, 350, 20, 16], [1, 370, 30, 19]),
      dead: '120, 90, 100',
    },
    plankton: { color: [240, 150, 180], alpha: 0.2 }, algae: 'rgba(90, 60, 70, 0.75)', shape: 'bird',
  },
};

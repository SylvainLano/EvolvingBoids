// DemoMode.ts
import type { MainComponent } from '../main/main.component';

// Simulation parameters that change from one scene to another, morphed smoothly during the transitions
type SceneParams = Pick<MainComponent,
  'alignmentRadius' | 'cohesionRadius' | 'boidsSeparationRadius' | 'fleeRadius' | 'fleeFactor' | 'predatorsSeparationRadius' | 'trailLength'>;

interface DemoScene {
  title: string;
  params: SceneParams;
  minBoids: number;       // under this, a new flock arrives
  maxBoids: number;       // over this, boids stop reproducing
  minPredators: number;   // under this, a new predator arrives
  maxPredators: number;   // over this, predators stop reproducing
}

const SCENES: DemoScene[] = [
  {
    title: 'Shoal',
    params: { alignmentRadius: 40, cohesionRadius: 50, boidsSeparationRadius: 20, fleeRadius: 80, fleeFactor: 5, predatorsSeparationRadius: 60, trailLength: 8 },
    minBoids: 120, maxBoids: 260, minPredators: 2, maxPredators: 5,
  },
  {
    title: 'Murmuration',
    params: { alignmentRadius: 70, cohesionRadius: 90, boidsSeparationRadius: 15, fleeRadius: 100, fleeFactor: 6, predatorsSeparationRadius: 120, trailLength: 10 },
    minBoids: 200, maxBoids: 350, minPredators: 1, maxPredators: 3,
  },
  {
    title: 'Fireflies',
    params: { alignmentRadius: 10, cohesionRadius: 30, boidsSeparationRadius: 35, fleeRadius: 60, fleeFactor: 3, predatorsSeparationRadius: 80, trailLength: 4 },
    minBoids: 100, maxBoids: 220, minPredators: 1, maxPredators: 3,
  },
  {
    title: 'Night Hunt',
    params: { alignmentRadius: 35, cohesionRadius: 45, boidsSeparationRadius: 20, fleeRadius: 140, fleeFactor: 9, predatorsSeparationRadius: 50, trailLength: 14 },
    minBoids: 150, maxBoids: 280, minPredators: 4, maxPredators: 8,
  },
];

// Settings changed by the demo, restored when it stops
const SAVED_SETTINGS = [
  'darkMode', 'glow', 'drawQuadtree', 'renderer', 'simulationMode', 'lowFPSAction', 'pauseSimulation', 'timeScale',
  'boidReproductionChances', 'predatorReproductionChances',
  'alignmentRadius', 'cohesionRadius', 'boidsSeparationRadius', 'fleeRadius', 'fleeFactor', 'predatorsSeparationRadius', 'trailLength',
] as const;
type SavedSettings = Partial<Pick<MainComponent, typeof SAVED_SETTINGS[number]>>;

// A screensaver mode: no interface, scenes following each other, and a director keeping the ecosystem alive forever
export class DemoMode {
  active = false;
  sceneTitle = '';
  showTitle = false;          // the scene title is displayed for a while when a scene starts
  showHint = false;           // how to exit is displayed for a while when the mouse moves

  readonly sceneDuration = 150000;
  readonly transitionDuration = 12000;
  readonly titleDuration = 6000;
  readonly hintDuration = 2500;
  readonly directorInterval = 1000;
  readonly boidReproductionChances = 30;      // reproduction chances in percent, when the population is not too large
  readonly predatorReproductionChances = 10;
  readonly minFPSToGrow = 45;             // under this, the population stops growing

  private saved: SavedSettings = {};
  private sceneIndex = -1;
  private sceneStart = 0;
  private fromParams!: SceneParams;
  private lastDirectorTick = 0;
  private lastFlockArrival = 0;
  private lastPredatorArrival = 0;
  private lastMouseMove = -Infinity;
  private wakeLock: WakeLockSentinel | null = null;
  private enteredFullscreen = false;

  constructor(private sim: MainComponent) {}

  // Fullscreen can only be requested from a user action (click, key)
  start(fullscreen: boolean) {
    if (this.active) {
      return;
    }
    this.active = true;
    this.saved = Object.fromEntries(SAVED_SETTINGS.map(key => [key, this.sim[key]])) as SavedSettings;
    Object.assign(this.sim, {
      darkMode: true, glow: true, drawQuadtree: false, renderer: 'canvas',
      simulationMode: 'Infinite', lowFPSAction: 'PopulationControl', pauseSimulation: false, timeScale: 1,
    });
    this.sim.mousePosition = null;

    const now = performance.now();
    this.sceneIndex = -1;
    this.nextScene(now);
    this.lastDirectorTick = this.lastFlockArrival = this.lastPredatorArrival = now;

    if (fullscreen && document.fullscreenElement === null && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen()
        .then(() => this.enteredFullscreen = true)
        .catch(() => this.enteredFullscreen = false);
    }
    this.requestWakeLock();
  }

  stop() {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.showTitle = this.showHint = false;
    Object.assign(this.sim, this.saved);

    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
    if (this.enteredFullscreen && document.fullscreenElement !== null) {
      document.exitFullscreen().catch(() => {});
    }
    this.enteredFullscreen = false;
  }

  toggle() {
    if (this.active) {
      this.stop();
    } else {
      this.start(true);
    }
  }

  // Called at each frame
  update(timestamp: number) {
    if (!this.active) {
      return;
    }
    const elapsed = timestamp - this.sceneStart;
    if (elapsed >= this.sceneDuration) {
      this.nextScene(timestamp);
    } else {
      this.morph(Math.min(1, elapsed / this.transitionDuration));
    }
    this.showTitle = elapsed < this.titleDuration;
    this.showHint = timestamp - this.lastMouseMove < this.hintDuration;

    if (timestamp - this.lastDirectorTick >= this.directorInterval) {
      this.lastDirectorTick = timestamp;
      this.direct(timestamp);
    }
  }

  onMouseMove() {
    this.lastMouseMove = performance.now();
  }

  // The wake lock is released by the browser when the page is hidden
  onVisibilityChange() {
    if (this.active && document.visibilityState === 'visible') {
      this.requestWakeLock();
    }
  }

  // Leaving the fullscreen (with Escape, which the page doesn't receive) also leaves the demo
  onFullscreenChange() {
    if (this.active && this.enteredFullscreen && document.fullscreenElement === null) {
      this.enteredFullscreen = false;
      this.stop();
    }
  }

  private get scene(): DemoScene {
    return SCENES[this.sceneIndex];
  }

  private nextScene(timestamp: number) {
    this.fromParams = {
      alignmentRadius: this.sim.alignmentRadius,
      cohesionRadius: this.sim.cohesionRadius,
      boidsSeparationRadius: this.sim.boidsSeparationRadius,
      fleeRadius: this.sim.fleeRadius,
      fleeFactor: this.sim.fleeFactor,
      predatorsSeparationRadius: this.sim.predatorsSeparationRadius,
      trailLength: this.sim.trailLength,
    };
    // A random scene, never the same twice in a row
    let index = Math.floor(Math.random() * SCENES.length);
    if (index === this.sceneIndex) {
      index = (index + 1) % SCENES.length;
    }
    this.sceneIndex = index;
    this.sceneStart = timestamp;
    this.sceneTitle = this.scene.title;
  }

  // Smoothly move the parameters from the previous scene to the current one
  private morph(progress: number) {
    const eased = progress * progress * (3 - 2 * progress);
    const from = this.fromParams;
    const to = this.scene.params;
    const lerp = (a: number, b: number) => a + (b - a) * eased;
    Object.assign(this.sim, {
      alignmentRadius: lerp(from.alignmentRadius, to.alignmentRadius),
      cohesionRadius: lerp(from.cohesionRadius, to.cohesionRadius),
      boidsSeparationRadius: lerp(from.boidsSeparationRadius, to.boidsSeparationRadius),
      fleeRadius: lerp(from.fleeRadius, to.fleeRadius),
      fleeFactor: lerp(from.fleeFactor, to.fleeFactor),
      predatorsSeparationRadius: lerp(from.predatorsSeparationRadius, to.predatorsSeparationRadius),
      trailLength: Math.round(lerp(from.trailLength, to.trailLength)),
    });
  }

  // Keep both populations within the scene ranges, so the demo never collapses nor freezes the computer
  private direct(timestamp: number) {
    const scene = this.scene;
    const boids = this.sim.boids.length;
    const predators = this.sim.predators.filter(predator => !predator.isDead).length;
    const canGrow = this.sim.fps >= this.minFPSToGrow;

    this.sim.boidReproductionChances = boids < scene.maxBoids && canGrow ? this.boidReproductionChances : 0;
    this.sim.predatorReproductionChances = predators < scene.maxPredators ? this.predatorReproductionChances : 0;

    if (boids < scene.minBoids && timestamp - this.lastFlockArrival > 4000) {
      this.lastFlockArrival = timestamp;
      this.arrive(false, Math.min(25, scene.minBoids - boids + 5));
    }

    // Hungry predators starve quickly, so the missing ones arrive together as a pack
    if (predators < scene.minPredators && timestamp - this.lastPredatorArrival > 5000) {
      this.lastPredatorArrival = timestamp;
      this.arrive(true, scene.minPredators - predators);
    } else if (boids > scene.maxBoids * 1.25 && predators < scene.maxPredators && timestamp - this.lastPredatorArrival > 8000) {
      this.lastPredatorArrival = timestamp;
      this.arrive(true, 1);
    }
  }

  // A group enters from a random border, heading inside, with the genes of the current (or recently dead) population
  private arrive(isPredator: boolean, count: number) {
    const width = this.sim.containerWidth;
    const height = this.sim.containerHeight;
    const border = Math.floor(Math.random() * 4);
    const along = 0.2 + Math.random() * 0.6;
    const heading = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }][border];

    const heritages = this.sim.inheritGenes(isPredator, count);

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 80;
      const depth = 2 + Math.random() * 30;
      const position = [
        { x: depth, y: along * height + spread },
        { x: width - depth, y: along * height + spread },
        { x: along * width + spread, y: depth },
        { x: along * width + spread, y: height - depth },
      ][border];
      const { genome, generation } = heritages[i];
      const rate = isPredator ? this.sim.predatorReproductionRate : this.sim.boidReproductionRate;

      this.sim.insertNewBoid(
        position,
        { x: heading.x + (Math.random() - 0.5) * 0.3, y: heading.y + (Math.random() - 0.5) * 0.3 },
        isPredator,
        genome,
        Math.random() * rate,
        this.sim.quadtree,
        generation
      );
    }
  }

  private async requestWakeLock() {
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      this.wakeLock = null;
    }
  }
}

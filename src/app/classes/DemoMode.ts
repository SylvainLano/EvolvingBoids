// DemoMode.ts
import type { MainComponent } from '../main/main.component';
import type { Simulation } from './Simulation';
import type { Boid } from './Boid';
import type { Camera } from './CanvasRenderer';
import { AMBIANCES, AmbianceName } from './Ambiance';

// Simulation parameters that change from one scene to another, morphed smoothly during the transitions
type SceneParams = Pick<Simulation,
  'alignmentRadius' | 'cohesionRadius' | 'boidsSeparationRadius' | 'fleeRadius' | 'fleeFactor' | 'predatorsSeparationRadius' | 'trailLength'>;

// The shots of the camera: the whole world, or a flock followed from a middle distance, or close
type ShotKind = 'wide' | 'medium' | 'close';

interface Shot {
  kind: ShotKind;
  start: number;          // performance.now() at its start
  end: number;            // performance.now() at its end
  subject: Boid | null;   // the boid whose flock is followed
}

interface DemoScene {
  title: string;
  ambiance: AmbianceName;   // its background, its colors and the shape of the boids
  params: SceneParams;
  minBoids: number;       // under this, a new flock arrives
  maxBoids: number;       // over this, boids stop reproducing
  minPredators: number;   // under this, a new predator arrives
  maxPredators: number;   // over this, predators stop reproducing
}

export const SCENES: DemoScene[] = [
  {
    title: 'Shoal',
    ambiance: 'abyss',
    params: { alignmentRadius: 40, cohesionRadius: 50, boidsSeparationRadius: 20, fleeRadius: 80, fleeFactor: 5, predatorsSeparationRadius: 60, trailLength: 8 },
    minBoids: 120, maxBoids: 260, minPredators: 2, maxPredators: 5,
  },
  {
    title: 'Murmuration',
    ambiance: 'sunset',
    params: { alignmentRadius: 70, cohesionRadius: 90, boidsSeparationRadius: 15, fleeRadius: 100, fleeFactor: 6, predatorsSeparationRadius: 120, trailLength: 10 },
    minBoids: 200, maxBoids: 350, minPredators: 1, maxPredators: 3,
  },
  {
    title: 'Fireflies',
    ambiance: 'aurora',
    params: { alignmentRadius: 10, cohesionRadius: 30, boidsSeparationRadius: 35, fleeRadius: 60, fleeFactor: 3, predatorsSeparationRadius: 80, trailLength: 4 },
    minBoids: 100, maxBoids: 220, minPredators: 1, maxPredators: 3,
  },
  {
    title: 'Night Hunt',
    ambiance: 'neon',
    params: { alignmentRadius: 35, cohesionRadius: 45, boidsSeparationRadius: 20, fleeRadius: 100, fleeFactor: 6, predatorsSeparationRadius: 50, trailLength: 14 },
    minBoids: 150, maxBoids: 280, minPredators: 1, maxPredators: 2,
  },
  {
    title: 'Ink',
    ambiance: 'paper',
    params: { alignmentRadius: 45, cohesionRadius: 55, boidsSeparationRadius: 22, fleeRadius: 90, fleeFactor: 6, predatorsSeparationRadius: 70, trailLength: 8 },
    minBoids: 120, maxBoids: 240, minPredators: 2, maxPredators: 4,
  },
  {
    title: 'Reef',
    ambiance: 'reef',
    params: { alignmentRadius: 40, cohesionRadius: 60, boidsSeparationRadius: 18, fleeRadius: 85, fleeFactor: 5, predatorsSeparationRadius: 90, trailLength: 6 },
    minBoids: 140, maxBoids: 280, minPredators: 1, maxPredators: 3,
  },
  {
    title: 'Cosmos',
    ambiance: 'cosmos',
    params: { alignmentRadius: 55, cohesionRadius: 80, boidsSeparationRadius: 25, fleeRadius: 90, fleeFactor: 5, predatorsSeparationRadius: 100, trailLength: 12 },
    minBoids: 120, maxBoids: 240, minPredators: 1, maxPredators: 3,
  },
  {
    title: 'Storm',
    ambiance: 'storm',
    params: { alignmentRadius: 60, cohesionRadius: 70, boidsSeparationRadius: 18, fleeRadius: 110, fleeFactor: 7, predatorsSeparationRadius: 90, trailLength: 8 },
    minBoids: 180, maxBoids: 320, minPredators: 2, maxPredators: 3,
  },
  {
    title: 'Embers',
    ambiance: 'embers',
    params: { alignmentRadius: 20, cohesionRadius: 35, boidsSeparationRadius: 28, fleeRadius: 70, fleeFactor: 4, predatorsSeparationRadius: 70, trailLength: 6 },
    minBoids: 130, maxBoids: 260, minPredators: 1, maxPredators: 3,
  },
  {
    title: 'Sakura',
    ambiance: 'sakura',
    params: { alignmentRadius: 65, cohesionRadius: 85, boidsSeparationRadius: 20, fleeRadius: 95, fleeFactor: 5, predatorsSeparationRadius: 110, trailLength: 8 },
    minBoids: 160, maxBoids: 300, minPredators: 1, maxPredators: 2,
  },
];

// A scene named in a link, by its title or its ambiance, whatever the case and the spaces: night-hunt, Sakura...
export function findScene(name: string): number {
  const simple = (text: string) => text.toLowerCase().replace(/[^a-z]/g, '');
  return SCENES.findIndex(scene => simple(scene.title) === simple(name) || scene.ambiance === simple(name));
}

// Settings changed by the demo, restored when it stops: some of the display, some of the simulation
// The ambiance first: it sets the dark mode that suits it, the one of the user comes after
const SAVED_VIEW = ['ambiance', 'darkMode', 'glow', 'drawQuadtree', 'renderer', 'timeScale', 'boidShape', 'longTrails'] as const;
const SAVED_SIMULATION = [
  'simulationMode', 'lowFPSAction', 'pauseSimulation', 'seasonsEnabled', 'plantsEnabled', 'boidReproductionChances', 'predatorReproductionChances',
  'alignmentRadius', 'cohesionRadius', 'boidsSeparationRadius', 'fleeRadius', 'fleeFactor', 'predatorsSeparationRadius', 'trailLength',
] as const;
type SavedView = Partial<Pick<MainComponent, typeof SAVED_VIEW[number]>>;
type SavedSimulation = Partial<Pick<Simulation, typeof SAVED_SIMULATION[number]>>;

// The cinema mode, a screensaver: no interface, scenes following each other, each in its own ambiance, a camera framing
// the flocks, and a director keeping the ecosystem alive forever. The user can choose a scene, and stay on it
export class DemoMode {
  active = false;
  sceneTitle = '';
  showTitle = false;          // the scene title is displayed for a while when a scene starts
  showHint = false;           // how to exit is displayed for a while when the mouse moves
  fade = 0;                   // the black veil between two scenes, from 0 to 1
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  locked = false;             // the scene goes on until it is unlocked, instead of giving way to the next one

  readonly sceneDuration = 150000;
  readonly unlockedRest = 20000;          // once unlocked, a scene goes on at least this long before the next one
  readonly transitionDuration = 12000;
  readonly titleDuration = 6000;
  readonly hintDuration = 3000;
  readonly fadeDuration = 1500;           // to black at the end of a scene, and back at the start of the next one
  readonly shotZooms: Record<ShotKind, number> = { wide: 1, medium: 1.6, close: 2.3 };
  readonly shotDurations: Record<ShotKind, [number, number]> = { wide: [10000, 15000], medium: [18000, 26000], close: [16000, 24000] };
  readonly panStiffness = 0.8;            // in radians per second: the camera settles on a new framing in about 6 seconds
  readonly followStiffness = 1.6;         // then it holds the followed flock tighter, so that a fast one doesn't leave the picture
  readonly tighteningTime = 3;            // in seconds from the start of a shot, to hold the flock tighter
  readonly zoomStiffness = 0.45;
  readonly flockRadius = 90;              // in px, the boids around the followed one make the flock the camera frames
  readonly leadTime = 0.4;                // in seconds: the camera looks a little ahead of the flock, which swims into the picture
  readonly brakingDistance = 50;          // in px from a border, the camera starts slowing down
  readonly directorInterval = 1000;
  readonly boidReproductionChances = 30;      // reproduction chances in percent, when the population is not too large
  readonly predatorReproductionChances = 10;
  readonly minFPSToGrow = 45;             // under this, the population stops growing

  private savedView: SavedView = {};
  private savedSimulation: SavedSimulation = {};
  private sceneIndex = -1;
  private sceneStart = 0;
  private sceneEnd = 0;                            // Infinity while the scene is locked
  private chosenIndex: number | null = null;       // the scene chosen by the user, coming after the fade to black
  private fromParams!: SceneParams;
  private lastDirectorTick = 0;
  private lastFlockArrival = 0;
  private lastPredatorArrival = 0;
  private lastMouseMove = -Infinity;
  private shot: Shot = { kind: 'wide', start: 0, end: 0, subject: null };
  private cameraSpeed = { x: 0, y: 0, zoom: 0 };
  private flock = { x: 0, y: 0, vx: 0, vy: 0 };     // where the followed flock is, and how fast it swims, smoothed
  private lastFrame = 0;
  private worldSize = { width: 0, height: 0 };     // the size of the world the camera was placed in
  private wakeLock: WakeLockSentinel | null = null;
  private enteredFullscreen = false;

  constructor(private app: MainComponent) {}

  private get sim(): Simulation {
    return this.app.sim;
  }

  // Fullscreen can only be requested from a user action (click, key)
  // A scene named by a link comes first, and stays
  start(fullscreen: boolean, sceneName: string | null = null) {
    if (this.active) {
      return;
    }
    const chosen = sceneName === null ? -1 : findScene(sceneName);
    this.chosenIndex = chosen >= 0 ? chosen : null;
    this.locked = chosen >= 0;
    // The demo drives the simulation on its own: a running challenge is left
    this.app.challenges.close();
    this.active = true;
    this.savedView = Object.fromEntries(SAVED_VIEW.map(key => [key, this.app[key]])) as SavedView;
    this.savedSimulation = Object.fromEntries(SAVED_SIMULATION.map(key => [key, this.sim[key]])) as SavedSimulation;
    Object.assign(this.app, { darkMode: true, glow: true, drawQuadtree: false, renderer: 'canvas', timeScale: 1, longTrails: true });
    Object.assign(this.sim, { simulationMode: 'Infinite', lowFPSAction: 'PopulationControl', pauseSimulation: false, seasonsEnabled: true, plantsEnabled: true });
    this.sim.mousePosition = null;

    const now = performance.now();
    this.sceneIndex = -1;
    this.nextScene(now);
    // It starts with a wide shot
    this.camera = { x: this.sim.width / 2, y: this.sim.height / 2, zoom: 1 };
    this.cameraSpeed = { x: 0, y: 0, zoom: 0 };
    this.shot = { kind: 'wide', start: now, end: now + this.shotDurations.wide[0], subject: null };
    this.worldSize = { width: this.sim.width, height: this.sim.height };
    this.lastFrame = now;
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
    Object.assign(this.app, this.savedView);
    Object.assign(this.sim, this.savedSimulation);

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
    if (timestamp >= this.sceneEnd) {
      this.nextScene(timestamp);
      this.cut(timestamp);
    } else {
      this.morph(Math.min(1, (timestamp - this.sceneStart) / this.transitionDuration));
    }
    const sinceStart = timestamp - this.sceneStart;
    this.showTitle = sinceStart < this.titleDuration;
    this.showHint = timestamp - this.lastMouseMove < this.hintDuration;
    // From black at the start of a scene, to black at its end: the ambiance changes in the dark
    this.fade = Math.max(0, 1 - sinceStart / this.fadeDuration, 1 - (this.sceneEnd - timestamp) / this.fadeDuration);
    this.moveCamera(timestamp);

    if (timestamp - this.lastDirectorTick >= this.directorInterval) {
      this.lastDirectorTick = timestamp;
      this.direct(timestamp);
    }
  }

  onMouseMove() {
    this.lastMouseMove = performance.now();
  }

  // The title of the scene on the screen, or of the one chosen to come next
  get chosenTitle(): string {
    return SCENES[this.chosenIndex ?? this.sceneIndex]?.title ?? '';
  }

  // Stay on this scene, or let the scenes follow each other again. A scene already fading away gives way to the next one,
  // which stays. An unlocked scene doesn't end at once, the time to enjoy it a little longer
  toggleLock() {
    const now = this.lastFrame;
    this.locked = !this.locked;
    if (this.locked && this.chosenIndex === null && this.sceneEnd - now > this.fadeDuration) {
      this.sceneEnd = Infinity;
    } else if (!this.locked && this.sceneEnd === Infinity) {
      this.sceneEnd = Math.max(this.sceneStart + this.sceneDuration, now + this.unlockedRest);
    }
    this.onMouseMove();
  }

  // The next or the previous scene, after a fade to black from where the veil already is. Locked, the chosen one stays
  changeScene(step: number) {
    const now = this.lastFrame;
    this.chosenIndex = ((this.chosenIndex ?? this.sceneIndex) + step + SCENES.length) % SCENES.length;
    this.sceneEnd = Math.min(this.sceneEnd, now + this.fadeDuration * (1 - this.fade));
    this.onMouseMove();
  }

  // A click or a tap shows how to exit, a second one while it is shown exits: a phone has no key to do it
  onClick() {
    if (this.showHint) {
      this.stop();
    } else {
      this.onMouseMove();
    }
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
    // The scene chosen by the user, or a random one, never the same twice in a row
    let index = this.chosenIndex ?? Math.floor(Math.random() * SCENES.length);
    if (this.chosenIndex === null && index === this.sceneIndex) {
      index = (index + 1) % SCENES.length;
    }
    this.chosenIndex = null;
    this.sceneIndex = index;
    this.sceneStart = timestamp;
    this.sceneEnd = this.locked ? Infinity : timestamp + this.sceneDuration;
    this.sceneTitle = this.scene.title;
    const ambiance = AMBIANCES[this.scene.ambiance];
    Object.assign(this.app, { ambiance: ambiance.name, boidShape: ambiance.shape, darkMode: ambiance.dark ?? true });
    // The predators beyond those of the new scene leave in the dark
    this.sim.retire(this.sim.predators.filter(predator => !predator.isDead && !predator.isSuper).slice(this.scene.maxPredators));
  }

  // The camera moves like critically damped springs: it speeds up and slows down smoothly, never overshoots, and
  // follows a swimming flock without lagging behind, its speed being fed forward
  // It never shows beyond the world, without ever stopping abruptly: its target stays inside the world, and it only
  // steps back as far as the picture stays inside, coming back toward the middle first
  private moveCamera(timestamp: number) {
    const elapsed = Math.min(0.1, Math.max(0, (timestamp - this.lastFrame) / 1000));
    this.lastFrame = timestamp;
    if (timestamp >= this.shot.end) {
      this.nextShot(timestamp);
    }
    // The world got another size (a phone turned, a window resized): the camera keeps its place in it, like the boids
    if (this.sim.width !== this.worldSize.width || this.sim.height !== this.worldSize.height) {
      const scaleX = this.worldSize.width > 0 ? this.sim.width / this.worldSize.width : 1;
      const scaleY = this.worldSize.height > 0 ? this.sim.height / this.worldSize.height : 1;
      this.camera.x *= scaleX;
      this.camera.y *= scaleY;
      this.flock.x *= scaleX;
      this.flock.y *= scaleY;
      this.cameraSpeed = { x: 0, y: 0, zoom: 0 };
      this.worldSize = { width: this.sim.width, height: this.sim.height };
    }
    const camera = this.camera;
    const target = this.framing(elapsed, camera.zoom);
    const speed = this.cameraSpeed;
    const spring = (position: number, velocity: number, goal: number, goalVelocity: number, stiffness: number) =>
      velocity + (stiffness ** 2 * (goal - position) + 2 * stiffness * (goalVelocity - velocity)) * elapsed;
    const widest = this.widestZoom();
    speed.zoom = spring(camera.zoom, speed.zoom, Math.max(target.zoom, widest), 0, this.zoomStiffness);
    camera.zoom = Math.max(1, camera.zoom + speed.zoom * elapsed);
    // Gentle at the start of a shot, the time to reach the flock, then tighter
    const tightening = this.shot.kind === 'wide' ? 0 : Math.min(1, (timestamp - this.shot.start) / 1000 / this.tighteningTime);
    const stiffness = this.panStiffness + (this.followStiffness - this.panStiffness) * tightening;
    speed.x = spring(camera.x, speed.x, target.x, target.vx, stiffness);
    speed.y = spring(camera.y, speed.y, target.y, target.vy, stiffness);
    camera.x += speed.x * elapsed;
    camera.y += speed.y * elapsed;
    this.keepInside();
  }

  // The widest zoom that keeps the picture inside the world, where the camera is
  private widestZoom(): number {
    const { x, y } = this.camera;
    const width = this.sim.width;
    const height = this.sim.height;
    return Math.max(1, width / 2 / Math.max(1, Math.min(x, width - x)), height / 2 / Math.max(1, Math.min(y, height - y)));
  }

  // A last guard, which the springs shouldn't need: the picture inside the world, the camera stopped against the border
  private keepInside() {
    const camera = this.camera;
    const halfWidth = this.sim.width / 2 / camera.zoom;
    const halfHeight = this.sim.height / 2 / camera.zoom;
    const x = Math.min(this.sim.width - halfWidth, Math.max(halfWidth, camera.x));
    const y = Math.min(this.sim.height - halfHeight, Math.max(halfHeight, camera.y));
    if (x !== camera.x) {
      camera.x = x;
      this.cameraSpeed.x = 0;
    }
    if (y !== camera.y) {
      camera.y = y;
      this.cameraSpeed.y = 0;
    }
  }

  // Between two scenes, in the dark, the camera cuts to a new shot instead of moving
  private cut(timestamp: number) {
    this.nextShot(timestamp);
    const target = this.framing(0, Infinity);
    this.camera = { x: target.x, y: target.y, zoom: target.zoom };
    this.cameraSpeed = { x: 0, y: 0, zoom: 0 };
  }

  // After a wide shot, the camera comes closer to the largest flock. After a closer one, it steps back now and then,
  // or keeps on following the same flock from another distance
  private nextShot(timestamp: number) {
    const previous = this.shot;
    const kind: ShotKind = previous.kind === 'wide' ? (Math.random() < 0.5 ? 'close' : 'medium')
      : Math.random() < 0.35 ? 'wide' : previous.kind === 'close' ? 'medium' : 'close';
    const [shortest, longest] = this.shotDurations[kind];
    let subject: Boid | null = null;
    if (kind !== 'wide') {
      const keep = previous.subject !== null && !previous.subject.isDead && this.flockAround(previous.subject).length >= 5;
      const largest = this.largestFlock();
      subject = keep ? previous.subject : largest === null ? null : this.closestBoid(largest);
    }
    this.shot = { kind: subject === null ? 'wide' : kind, start: timestamp, end: timestamp + shortest + Math.random() * (longest - shortest), subject };
    if (subject !== null) {
      this.flock = this.measureFlock(subject);
    }
  }

  // Where the shot wants the camera: the center of the world for a wide shot, otherwise the followed flock, a little ahead
  // of it, held so that the picture stays inside the world, at the zoom of the shot and at the current one, the widest.
  // Where it is held back, the camera doesn't follow the speed of the flock
  private framing(elapsed: number, currentZoom: number): { x: number, y: number, vx: number, vy: number, zoom: number } {
    const width = this.sim.width;
    const height = this.sim.height;
    if (this.shot.kind !== 'wide' && (this.shot.subject === null || this.shot.subject.isDead)) {
      // The followed boid is gone: the camera follows the boid closest to where it was
      this.shot.subject = this.closestBoid(this.flock);
    }
    const subject = this.shot.subject;
    if (this.shot.kind === 'wide' || subject === null) {
      return { x: width / 2, y: height / 2, vx: 0, vy: 0, zoom: 1 };
    }
    // The flock is smoothed over about a second, the boids around the followed one come and go
    const measured = this.measureFlock(subject);
    const smoothing = elapsed === 0 ? 1 : 1 - Math.exp(-elapsed / 0.8);
    const flock = this.flock;
    flock.x += (measured.x - flock.x) * smoothing;
    flock.y += (measured.y - flock.y) * smoothing;
    flock.vx += (measured.vx - flock.vx) * smoothing;
    flock.vy += (measured.vy - flock.vy) * smoothing;
    const zoom = this.shotZooms[this.shot.kind];
    const halfWidth = width / 2 / Math.min(zoom, currentZoom);
    const halfHeight = height / 2 / Math.min(zoom, currentZoom);
    const hold = (wanted: number, size: number, half: number) => Math.min(size - half, Math.max(half, wanted));
    // The speed of the flock is followed less and less toward a border, so that the camera slows down before it
    const brake = (position: number, velocity: number, size: number, half: number) =>
      velocity * Math.max(0, Math.min(1, (velocity < 0 ? position - half : size - half - position) / this.brakingDistance));
    const x = hold(flock.x + flock.vx * this.leadTime, width, halfWidth);
    const y = hold(flock.y + flock.vy * this.leadTime, height, halfHeight);
    return { x, y, vx: brake(x, flock.vx, width, halfWidth), vy: brake(y, flock.vy, height, halfHeight), zoom };
  }

  // The boids around one of them
  private flockAround(boid: Boid): Boid[] {
    return this.sim.boids.filter(other => !other.isDead
      && (other.position.x - boid.position.x) ** 2 + (other.position.y - boid.position.y) ** 2 < this.flockRadius ** 2);
  }

  // The center of the flock around a boid, and its speed in px per second
  private measureFlock(subject: Boid): { x: number, y: number, vx: number, vy: number } {
    const flock = this.flockAround(subject);
    const members = flock.length > 0 ? flock : [subject];
    const mean = (value: (boid: Boid) => number) => members.reduce((sum, boid) => sum + value(boid), 0) / members.length;
    return {
      x: mean(boid => boid.position.x),
      y: mean(boid => boid.position.y),
      vx: mean(boid => boid.velocity.x) * this.sim.stepsPerSecond,
      vy: mean(boid => boid.velocity.y) * this.sim.stepsPerSecond,
    };
  }

  private closestBoid(point: { x: number, y: number }): Boid | null {
    let closest: Boid | null = null;
    let closestDistance = Infinity;
    for (const boid of this.sim.boids) {
      const distance = (boid.position.x - point.x) ** 2 + (boid.position.y - point.y) ** 2;
      if (!boid.isDead && distance < closestDistance) {
        closest = boid;
        closestDistance = distance;
      }
    }
    return closest;
  }

  // The center of the flock worth filming, among the boids around a few of them: a large one, away from the borders,
  // as the camera can't center a flock along a border without showing beyond the world
  private largestFlock(): { x: number, y: number } | null {
    const boids = this.sim.boids.filter(boid => !boid.isDead);
    const width = this.sim.width;
    const height = this.sim.height;
    let best: { x: number, y: number } | null = null;
    let bestScore = 0;
    for (const boid of boids.slice(0, 40)) {
      const flock = boids.filter(other => (other.position.x - boid.position.x) ** 2 + (other.position.y - boid.position.y) ** 2 < 120 ** 2);
      const center = {
        x: flock.reduce((sum, other) => sum + other.position.x, 0) / flock.length,
        y: flock.reduce((sum, other) => sum + other.position.y, 0) / flock.length,
      };
      const border = Math.min(center.x, width - center.x, center.y, height - center.y);
      const score = flock.length * (0.2 + 0.8 * Math.min(1, border / (Math.min(width, height) / 4)));
      if (score > bestScore) {
        best = center;
        bestScore = score;
      }
    }
    return best;
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
    const boids = this.sim.boids.filter(boid => !boid.isDead).length;
    const predators = this.sim.predators.filter(predator => !predator.isDead && !predator.isSuper).length;
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
    const width = this.sim.width;
    const height = this.sim.height;
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

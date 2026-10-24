// CanvasRenderer.ts
import type { Boid, Point } from './Boid';
import type { Plant } from './Plants';
import type { Quadtree } from './Quadtree';
import { boidColor } from './BoidColor';
import { AMBIANCES, Ambiance } from './Ambiance';
import { Backdrop } from './Backdrop';

// A ring spreading around a newborn mutant
export interface MutantHalo {
  boid: Boid;
  start: number;      // performance.now() at birth, the halo lasts in real time so it stays visible when the simulation is sped up
}

// How the boids are drawn: arrow heads, fish and sharks, birds and hawks, the letter of their family, or glowing comets
export type BoidShape = 'arrow' | 'fish' | 'bird' | 'letters' | 'comets';

// What the cinema mode frames: the point at the center of the screen, and how close
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface RenderOptions {
  darkMode: boolean;
  glow: boolean;                  // additive blending and halos, only visible in dark mode
  displayQuadtreeCount: boolean;
  shape: BoidShape;
  ambiance: Ambiance;
  longTrails: boolean;            // trails of light fading away in a few seconds, like a long exposure
  camera: Camera | null;          // the whole world when null
  fade: number;                   // from 0 to 1, a black veil between two scenes of the cinema mode
  quality: number;                // 1, or 0.5 when the FPS gets low: fewer lights in the background, shorter long trails
}

// What a bubble of the Explain mode circles: a boid or an area, and the bubble itself, linked to it by a thin line
export interface Explained {
  subject: Boid | { center: Point, radius: number };
  bubble: { x: number, y: number, width: number, height: number } | null;
}

// What the user drew with the mouse tools
export interface WorldDrawing {
  food: { texture: HTMLCanvasElement, width: number, height: number } | null;   // one pixel per cell, scaled up
  plants: { plants: Plant[], reach: (plant: Plant) => number, scale: (plant: Plant) => number, color: string } | null;   // how far and how big each one has grown, the color of the season
  obstacles: Point[][];
  currents: Point[][];
  currentWidth: number;                                                     // width of the band carrying the boids
  stroke: { kind: 'obstacle' | 'current', points: Point[] } | null;         // the line being drawn
  eraser: { position: Point, radius: number } | null;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private pixelRatio = 1;

  private readonly trailOpacities = [0.12, 0.25, 0.45];   // the trail is drawn in 3 parts, more opaque near the boid
  private readonly haloOpacity = 0.35;
  readonly mutantHaloDuration = 1200;         // in ms
  private readonly mutantHaloRadius = 30;
  private readonly currentDashSpeed = 0.03;   // in px per ms, the dashes of a current flow in its direction
  private readonly plantWidths = [1.5, 1.1, 0.8];   // in px, of the trunk of a grown alga, of its branches and of theirs
  private haloSprites = new Map<string, HTMLCanvasElement>();
  private beats = new WeakMap<Boid, { value: number, time: number }>();   // the beat of the tail or of the wings of each boid
  private letterFont = '';                    // the font of the letters is only set when it changes, it is costly
  private ambiance: Ambiance = AMBIANCES.classic;
  private backdrop = new Backdrop();
  // The long trails are painted on their own layer, which fades away a little at each frame
  private trailLayer: HTMLCanvasElement | null = null;
  private trailKey = '';
  private trailTime = 0;
  private lastPainted = new WeakMap<Boid, Point>();
  private readonly trailWidths = { boid: 1.6, predator: 2.4, super: 3.2 };   // in px
  private readonly trailFadeInterval = 1 / 12;   // in seconds between two fadings of the long trails

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  // Match the canvas resolution with its displayed size, including high density screens
  private fitToDisplaySize() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) {
      return;
    }
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  // Groups are drawn in order, so the last one is on top
  // The inspected boid is circled, with how far it sees when its sight is limited
  render(groups: Boid[][], quadtrees: Quadtree[] | null, options: RenderOptions, mutantHalos: MutantHalo[],
    highlighted: { boid: Boid, sight: number | null, field: number } | null, explained: Explained | null, world: WorldDrawing) {
    this.fitToDisplaySize();
    const ctx = this.ctx;
    const now = performance.now();
    this.letterFont = '';
    this.ambiance = options.ambiance;
    // An ambiance has its own background, the classic one follows the dark mode
    const darkMode = options.ambiance.dark ?? options.darkMode;

    // Drawing on the screen, or on the world framed by the camera of the cinema mode
    const onScreen = () => ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    const camera = options.camera;
    const onWorld = () => camera === null ? onScreen() : ctx.setTransform(this.pixelRatio * camera.zoom, 0, 0, this.pixelRatio * camera.zoom,
      this.pixelRatio * (this.width / 2 - camera.x * camera.zoom), this.pixelRatio * (this.height / 2 - camera.y * camera.zoom));

    // An opaque background, so the additive blending of the glow is computed against it: the one of the scene,
    // filmed by the camera like the world, then the darker edges of the lens, on the screen
    onScreen();
    ctx.globalCompositeOperation = 'source-over';
    this.backdrop.fill(ctx, options.ambiance, darkMode, this.width, this.height);
    onWorld();
    this.backdrop.drawScene(ctx, options.ambiance, this.width, this.height, now, options.quality);
    onScreen();
    this.backdrop.drawLens(ctx, options.ambiance, this.width, this.height);
    onWorld();

    if (quadtrees !== null) {
      this.drawQuadtrees(quadtrees, { ...options, darkMode });
    }

    // The plankton is a smooth glowing mist, scaled up from one pixel per cell
    if (world.food !== null) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(world.food.texture, 0, 0, world.food.width, world.food.height);
    }

    // The algae grow on the sea floor, under everything else
    if (world.plants !== null) {
      for (const plant of world.plants.plants) {
        this.drawPlant(plant, world.plants.reach(plant), world.plants.scale(plant), world.plants.color);
      }
    }

    // The currents flow under the boids, the obstacles stand among them
    for (const current of world.currents) {
      this.drawCurrent(current, world.currentWidth, now, darkMode);
    }
    for (const obstacle of world.obstacles) {
      this.drawObstacle(obstacle, darkMode);
    }
    if (world.stroke !== null) {
      if (world.stroke.kind === 'obstacle') {
        this.drawObstacle(world.stroke.points, darkMode);
      } else {
        this.drawCurrent(world.stroke.points, world.currentWidth, now, darkMode);
      }
    }

    const additive = darkMode && options.glow && options.ambiance.glow;
    if (options.longTrails) {
      this.paintLongTrails(groups, darkMode, additive, now, options.quality);
      ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      ctx.drawImage(this.trailLayer!, 0, 0, this.width, this.height);
    } else {
      this.trailLayer = null;
    }
    ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';

    for (const group of groups) {
      if (!options.longTrails) {
        for (const boid of group) {
          this.drawTrail(boid, darkMode);
        }
      }
      if (additive) {
        for (const boid of group) {
          this.drawHalo(boid, darkMode);
        }
      }
      for (const boid of group) {
        this.drawBody(boid, darkMode, options.shape, now);
      }
    }

    for (const halo of mutantHalos) {
      this.drawMutantHalo(halo, now, darkMode);
    }

    ctx.globalCompositeOperation = 'source-over';
    if (highlighted !== null) {
      this.drawHighlight(highlighted.boid, highlighted.sight, highlighted.field, darkMode);
    }
    if (explained !== null) {
      this.drawExplained(explained, now, darkMode);
    }
    if (world.eraser !== null) {
      this.drawEraser(world.eraser.position, world.eraser.radius, darkMode);
    }

    // The black veil of the cinema mode between two scenes, over the whole screen
    onScreen();
    if (options.fade > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, options.fade)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  // The color of a boid: the shade of its family in the palette of the ambiance, or the hue of its heading for the rainbow
  private color(boid: Boid, darkMode: boolean, opacity: number = 1): string {
    if (this.ambiance.rainbow && !boid.isPredator && !boid.isDead) {
      return `hsla(${this.headingHue(boid)}, 100%, 62%, ${opacity})`;
    }
    return boidColor(boid.isPredator, boid.isDead, boid.genome.lineage, boid.alpha, darkMode, opacity, boid.isSuper, this.ambiance.palette);
  }

  // The heading of a boid as a hue, in steps of 10° so that the halos can be reused
  private headingHue(boid: Boid): number {
    return Math.round(((Math.atan2(boid.velocity.y, boid.velocity.x) * 180 / Math.PI + 360) % 360) / 10) * 10 % 360;
  }

  // The long trails: the layer fades away a little, as much in a second whatever the FPS, then each boid paints the way
  // it swam since the last frame. The layer covers the world, the camera frames it like the rest
  private paintLongTrails(groups: Boid[][], darkMode: boolean, additive: boolean, now: number, quality: number) {
    const key = `${this.canvas.width}|${this.canvas.height}|${this.ambiance.name}|${darkMode}`;
    if (this.trailLayer === null || key !== this.trailKey) {
      this.trailKey = key;
      this.trailLayer = document.createElement('canvas');
      this.trailLayer.width = this.canvas.width;
      this.trailLayer.height = this.canvas.height;
      this.lastPainted = new WeakMap();
      this.trailTime = now;
    }
    const ctx = this.trailLayer.getContext('2d')!;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    // Nearly gone (5 % left) after the fading time of the ambiance, twice as fast when the FPS gets low.
    // The layer fades by steps, a few times per second: a tiny fade at each frame would leave faint lines forever,
    // as the opacity of a pixel is rounded back up to its value
    const elapsed = Math.min(0.25, (now - this.trailTime) / 1000);
    if (elapsed >= this.trailFadeInterval) {
      this.trailTime = now;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.pow(0.05, elapsed / (this.ambiance.trailFade * quality))})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Square ends: the round ones of the short pieces would overlap, and add up into beads of light
    ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
    ctx.lineCap = 'butt';
    for (const group of groups) {
      for (const boid of group) {
        const from = this.lastPainted.get(boid);
        const to = { x: boid.position.x, y: boid.position.y };
        this.lastPainted.set(boid, to);
        // A newcomer, or a boid moved by hand, doesn't paint a line across the screen
        if (from === undefined || (to.x - from.x) ** 2 + (to.y - from.y) ** 2 > 60 ** 2) {
          continue;
        }
        ctx.lineWidth = boid.isSuper ? this.trailWidths.super : boid.isPredator ? this.trailWidths.predator : this.trailWidths.boid;
        ctx.strokeStyle = this.color(boid, darkMode, additive ? 0.55 : 0.5);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
  }

  // A small tree, drawn as far as it has grown from its root, at its size: the last segment is drawn in part
  // The trunk is thicker than the branches, and they all get thicker as the alga grows
  private drawPlant(plant: Plant, reach: number, scale: number, color: string) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let depth = 0; depth < this.plantWidths.length; depth++) {
      ctx.lineWidth = this.plantWidths[depth] * scale;
      ctx.beginPath();
      for (const segment of plant.twig) {
        if (segment.depth !== depth || segment.from >= reach) {
          continue;
        }
        const length = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
        const part = Math.min(1, (reach - segment.from) / length);
        ctx.moveTo(plant.x + segment.x1 * scale, plant.y + segment.y1 * scale);
        ctx.lineTo(plant.x + (segment.x1 + (segment.x2 - segment.x1) * part) * scale, plant.y + (segment.y1 + (segment.y2 - segment.y1) * part) * scale);
      }
      ctx.stroke();
    }
  }

  // A wall the boids can't cross
  private drawObstacle(points: Point[], darkMode: boolean) {
    if (points.length < 2) {
      return;
    }
    const ctx = this.ctx;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = darkMode ? '#475569' : '#94a3b8';
    this.tracePath(points);
    ctx.stroke();
  }

  // A translucent band, with dashes flowing in the direction of the current
  private drawCurrent(points: Point[], width: number, now: number, darkMode: boolean) {
    if (points.length < 2) {
      return;
    }
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineWidth = width;
    ctx.strokeStyle = darkMode ? 'rgba(56, 189, 248, 0.07)' : 'rgba(14, 116, 144, 0.07)';
    this.tracePath(points);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = darkMode ? 'rgba(56, 189, 248, 0.45)' : 'rgba(14, 116, 144, 0.4)';
    ctx.setLineDash([4, 14]);
    ctx.lineDashOffset = -now * this.currentDashSpeed;
    this.tracePath(points);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  private tracePath(points: Point[]) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
  }

  private drawEraser(position: Point, radius: number, darkMode: boolean) {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The ring grows and fades away, following the newborn
  private drawMutantHalo(halo: MutantHalo, now: number, darkMode: boolean) {
    const progress = (now - halo.start) / this.mutantHaloDuration;
    if (progress < 0 || progress >= 1) {
      return;
    }
    const boid = halo.boid;
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    ctx.strokeStyle = boidColor(boid.isPredator, false, boid.genome.lineage, 1, darkMode, 1 - progress, false, this.ambiance.palette);
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, 4 + this.mutantHaloRadius * progress, 0, Math.PI * 2);
    ctx.stroke();
  }

  // A circle around the inspected boid, and a dashed line as far as it sees: a circle, or a cone around where it swims
  private drawHighlight(boid: Boid, sight: number | null, field: number, darkMode: boolean) {
    const ctx = this.ctx;
    const { x, y } = boid.position;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(x, y, this.bodyLength(boid) * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    if (sight !== null) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.3)';
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      if (field >= 360) {
        ctx.arc(x, y, sight, 0, Math.PI * 2);
      } else {
        const heading = Math.atan2(boid.velocity.y, boid.velocity.x);
        const half = field / 2 * Math.PI / 180;
        ctx.moveTo(x, y);
        ctx.arc(x, y, sight, heading - half, heading + half);
        ctx.closePath();
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // A gently pulsing amber ring around what a bubble explains: a boid, or a whole area with a dashed line,
  // and a thin line from the bubble to the ring, when they are apart
  private drawExplained(explained: Explained, now: number, darkMode: boolean) {
    const ctx = this.ctx;
    const subject = explained.subject;
    const pulse = 1 + 0.1 * Math.sin(now / 250);
    const isArea = 'center' in subject;
    const center = isArea ? subject.center : subject.position;
    const radius = (isArea ? subject.radius : this.bodyLength(subject) * 1.8) * pulse;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    if (isArea) {
      ctx.setLineDash([8, 6]);
    }
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const bubble = explained.bubble;
    if (bubble === null) {
      return;
    }
    // From the closest point of the bubble to the edge of the ring
    const from = {
      x: Math.min(bubble.x + bubble.width, Math.max(bubble.x, center.x)),
      y: Math.min(bubble.y + bubble.height, Math.max(bubble.y, center.y)),
    };
    const distance = Math.hypot(from.x - center.x, from.y - center.y);
    if (distance <= radius + 8) {
      return;
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = darkMode ? 'rgba(251, 191, 36, 0.55)' : 'rgba(217, 119, 6, 0.6)';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(center.x + (from.x - center.x) * radius / distance, center.y + (from.y - center.y) * radius / distance);
    ctx.stroke();
  }

  private drawQuadtrees(quadtrees: Quadtree[], options: RenderOptions) {
    const ctx = this.ctx;
    ctx.lineWidth = 1;
    ctx.strokeStyle = options.darkMode ? '#223044' : 'lightgrey';
    ctx.fillStyle = options.darkMode ? '#223044' : '#EEEEEE';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const quadtree of quadtrees) {
      ctx.strokeRect(quadtree.x + 0.5, quadtree.y + 0.5, quadtree.width, quadtree.height);
      if (options.displayQuadtreeCount) {
        ctx.font = `${quadtree.height / 1.5}px Monaco, monospace`;
        ctx.fillText(`${quadtree.entities.length}`, quadtree.x + quadtree.width / 2, quadtree.y + quadtree.height / 2);
      }
    }
  }

  // A slow boid is bigger, a fast one smaller, rounded so the halos can be reused
  private bodyLength(boid: Boid): number {
    return boid.isSuper ? 18 : (boid.isPredator ? 12 : 8) * Math.round(boid.size * 10) / 10;
  }

  private drawTrail(boid: Boid, darkMode: boolean) {
    const trail = boid.trail;
    if (trail.length < 2) {
      return;
    }
    const ctx = this.ctx;
    ctx.lineWidth = boid.isSuper ? 3.5 : boid.isPredator ? 2.5 : 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const parts = this.trailOpacities.length;
    for (let part = 0; part < parts; part++) {
      // Each part shares its first point with the end of the previous one, so the trail stays continuous
      const start = Math.floor(part * (trail.length - 1) / parts);
      const end = Math.floor((part + 1) * (trail.length - 1) / parts);
      if (end <= start) {
        continue;
      }
      ctx.strokeStyle = this.color(boid, darkMode, this.trailOpacities[part]);
      ctx.beginPath();
      ctx.moveTo(trail[start].x, trail[start].y);
      for (let i = start + 1; i <= end; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();
    }
  }

  private drawHalo(boid: Boid, darkMode: boolean) {
    if (boid.isDead) {
      return;
    }
    const radius = this.bodyLength(boid) * 1.6;
    const sprite = this.haloSprite(boid, darkMode, radius);
    this.ctx.drawImage(sprite, boid.position.x - radius, boid.position.y - radius, radius * 2, radius * 2);
  }

  // A soft radial gradient is costly to create, so each halo is pre-rendered once per (rounded) color and reused
  private haloSprite(boid: Boid, darkMode: boolean, radius: number): HTMLCanvasElement {
    const round = (value: number) => Math.round(value * 10) / 10;
    const lineage = round(boid.genome.lineage);
    const alpha = round(boid.alpha);
    const hue = this.ambiance.rainbow && !boid.isPredator ? this.headingHue(boid) : null;
    const key = `${this.ambiance.name}|${hue}|${boid.isPredator}|${boid.isSuper}|${lineage}|${alpha}|${darkMode}|${radius}|${this.pixelRatio}`;

    let sprite = this.haloSprites.get(key);
    if (sprite === undefined) {
      sprite = document.createElement('canvas');
      const size = Math.ceil(radius * 2 * this.pixelRatio);
      sprite.width = sprite.height = size;
      const spriteCtx = sprite.getContext('2d')!;
      const gradient = spriteCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      const color = (opacity: number) => hue !== null ? `hsla(${hue}, 100%, 62%, ${opacity})`
        : boidColor(boid.isPredator, false, lineage, alpha, darkMode, opacity, boid.isSuper, this.ambiance.palette);
      gradient.addColorStop(0, color(this.haloOpacity));
      gradient.addColorStop(1, color(0));
      spriteCtx.fillStyle = gradient;
      spriteCtx.fillRect(0, 0, size, size);
      this.haloSprites.set(key, sprite);
    }
    return sprite;
  }

  // The body of a boid in the chosen shape, pointing in the direction of its velocity
  // The fish and the birds are drawn a bit bigger than the arrows, for their shape to be seen
  private drawBody(boid: Boid, darkMode: boolean, shape: BoidShape, now: number) {
    const ctx = this.ctx;
    const length = this.bodyLength(boid) * (boid.isDead ? 2 - boid.alpha : 1) * (shape === 'fish' || shape === 'bird' ? 1.4 : 1);
    ctx.fillStyle = this.color(boid, darkMode);
    if (shape === 'letters') {
      this.drawLetter(boid, length);
      return;
    }
    // A comet is a bright round head, its tail is its trail
    if (shape === 'comets') {
      ctx.beginPath();
      ctx.arc(boid.position.x, boid.position.y, length * 0.28, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const { x, y } = boid.position;
    // Local point (forward, side), in body lengths, rotated to the screen
    const point = (forward: number, side: number) => {
      ctx.lineTo(x + (forward * cos - side * sin) * length, y + (forward * sin + side * cos) * length);
    };

    ctx.beginPath();
    if (shape === 'fish') {
      this.fishPath(boid, point, now);
    } else if (shape === 'bird') {
      this.birdPath(boid, point, now);
    } else {
      point(0.6, 0);
      point(-0.4, 0.375);
      point(-0.15, 0);
      point(-0.4, -0.375);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Where a boid is in the beat of its tail or of its wings: the faster it swims the faster it beats, a dead one stops
  private beat(boid: Boid, now: number, rate: number): number {
    let phase = this.beats.get(boid);
    if (phase === undefined) {
      phase = { value: Math.random() * Math.PI * 2, time: now };
      this.beats.set(boid, phase);
    }
    if (!boid.isDead) {
      const speed = Math.sqrt(boid.velocity.x ** 2 + boid.velocity.y ** 2);
      phase.value += (now - phase.time) * rate * (0.4 + speed);
    }
    phase.time = now;
    return phase.value;
  }

  // A fish seen from above, its tail waving, or a shark with its pectoral fins and its crescent tail
  private fishPath(boid: Boid, point: (forward: number, side: number) => void, now: number) {
    const wave = Math.sin(this.beat(boid, now, 0.006)) * 0.1;
    if (boid.isPredator) {
      point(0.6, 0);
      point(0.3, 0.1);
      point(0.1, 0.13);
      point(-0.08, 0.32);
      point(-0.05, 0.11);
      point(-0.32, 0.05 + wave * 0.6);
      point(-0.6, 0.24 + wave * 1.6);
      point(-0.48, wave);
      point(-0.6, -0.18 + wave * 1.6);
      point(-0.32, -0.05 + wave * 0.6);
      point(-0.05, -0.11);
      point(-0.08, -0.32);
      point(0.1, -0.13);
      point(0.3, -0.1);
    } else {
      point(0.55, 0);
      point(0.3, 0.17);
      point(-0.05, 0.17);
      point(-0.3, 0.05 + wave * 0.6);
      point(-0.55, 0.22 + wave * 1.6);
      point(-0.45, wave);
      point(-0.55, -0.22 + wave * 1.6);
      point(-0.3, -0.05 + wave * 0.6);
      point(-0.05, -0.17);
      point(0.3, -0.17);
    }
  }

  // A bird seen from above, flapping its wings, or a hawk with wider wings and a forked tail
  private birdPath(boid: Boid, point: (forward: number, side: number) => void, now: number) {
    const flap = 0.5 + 0.5 * Math.cos(this.beat(boid, now, 0.012));
    const span = (boid.isPredator ? 0.42 : 0.3) + (boid.isPredator ? 0.36 : 0.32) * flap;
    const sweep = -0.05 - 0.1 * flap;
    point(0.5, 0);
    point(0.18, 0.08);
    point(sweep, span);
    point(-0.12, 0.08);
    if (boid.isPredator) {
      point(-0.5, 0.14);
      point(-0.38, 0);
      point(-0.5, -0.14);
    } else {
      point(-0.42, 0.09);
      point(-0.42, -0.09);
    }
    point(-0.12, -0.08);
    point(sweep, -span);
    point(0.18, -0.08);
  }

  // The letter of the family of a boid, from the shade of its lineage: a mutant gets the next or the previous one
  // Lowercase for the boids, uppercase for the predators, and an omega for the Super Predators
  private drawLetter(boid: Boid, length: number) {
    const ctx = this.ctx;
    const letter = boid.isSuper ? 'Ω' : 'abcdefghi'[Math.round((boid.genome.lineage + 1) / 0.25)] ?? 'e';
    const font = `bold ${Math.round(length * 1.4)}px Monaco, monospace`;
    if (font !== this.letterFont) {
      ctx.font = font;
      this.letterFont = font;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(boid.isPredator && !boid.isSuper ? letter.toUpperCase() : letter, boid.position.x, boid.position.y);
  }
}

// CanvasRenderer.ts
import type { Boid, Point } from './Boid';
import type { Plant } from './Plants';
import type { Quadtree } from './Quadtree';
import { boidColor } from './BoidColor';

// A ring spreading around a newborn mutant
export interface MutantHalo {
  boid: Boid;
  start: number;      // performance.now() at birth, the halo lasts in real time so it stays visible when the simulation is sped up
}

// How the boids are drawn: arrow heads, fish and sharks, birds and hawks, or the letter of their family
export type BoidShape = 'arrow' | 'fish' | 'bird' | 'letters';

export interface RenderOptions {
  darkMode: boolean;
  glow: boolean;                  // additive blending and halos, only visible in dark mode
  displayQuadtreeCount: boolean;
  shape: BoidShape;
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
    highlighted: { boid: Boid, sight: number | null } | null, explained: Explained | null, world: WorldDrawing) {
    this.fitToDisplaySize();
    const ctx = this.ctx;
    const now = performance.now();
    this.letterFont = '';

    // An opaque background, so the additive blending of the glow is computed against it
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = options.darkMode ? '#0f172a' : 'white';
    ctx.fillRect(0, 0, this.width, this.height);

    if (quadtrees !== null) {
      this.drawQuadtrees(quadtrees, options);
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
      this.drawCurrent(current, world.currentWidth, now, options.darkMode);
    }
    for (const obstacle of world.obstacles) {
      this.drawObstacle(obstacle, options.darkMode);
    }
    if (world.stroke !== null) {
      if (world.stroke.kind === 'obstacle') {
        this.drawObstacle(world.stroke.points, options.darkMode);
      } else {
        this.drawCurrent(world.stroke.points, world.currentWidth, now, options.darkMode);
      }
    }

    const additive = options.darkMode && options.glow;
    if (additive) {
      ctx.globalCompositeOperation = 'lighter';
    }

    for (const group of groups) {
      for (const boid of group) {
        this.drawTrail(boid, options.darkMode);
      }
      if (additive) {
        for (const boid of group) {
          this.drawHalo(boid, options.darkMode);
        }
      }
      for (const boid of group) {
        this.drawBody(boid, options.darkMode, options.shape, now);
      }
    }

    for (const halo of mutantHalos) {
      this.drawMutantHalo(halo, now, options.darkMode);
    }

    ctx.globalCompositeOperation = 'source-over';
    if (highlighted !== null) {
      this.drawHighlight(highlighted.boid, highlighted.sight, options.darkMode);
    }
    if (explained !== null) {
      this.drawExplained(explained, now);
    }
    if (world.eraser !== null) {
      this.drawEraser(world.eraser.position, world.eraser.radius, options.darkMode);
    }
  }

  private color(boid: Boid, darkMode: boolean, opacity: number = 1): string {
    return boidColor(boid.isPredator, boid.isDead, boid.genome.lineage, boid.alpha, darkMode, opacity, boid.isSuper);
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
    ctx.strokeStyle = boidColor(boid.isPredator, false, boid.genome.lineage, 1, darkMode, 1 - progress);
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, 4 + this.mutantHaloRadius * progress, 0, Math.PI * 2);
    ctx.stroke();
  }

  // A circle around the inspected boid, and a dashed one as far as it sees the predators
  private drawHighlight(boid: Boid, sight: number | null, darkMode: boolean) {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, this.bodyLength(boid) * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    if (sight !== null) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.3)';
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(boid.position.x, boid.position.y, sight, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // A gently pulsing amber ring around what a bubble explains: a boid, or a whole area with a dashed line,
  // and a thin line from the bubble to the ring, when they are apart
  private drawExplained(explained: Explained, now: number) {
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
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
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
    const key = `${boid.isPredator}|${boid.isSuper}|${lineage}|${alpha}|${darkMode}|${radius}|${this.pixelRatio}`;

    let sprite = this.haloSprites.get(key);
    if (sprite === undefined) {
      sprite = document.createElement('canvas');
      const size = Math.ceil(radius * 2 * this.pixelRatio);
      sprite.width = sprite.height = size;
      const spriteCtx = sprite.getContext('2d')!;
      const gradient = spriteCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, boidColor(boid.isPredator, false, lineage, alpha, darkMode, this.haloOpacity, boid.isSuper));
      gradient.addColorStop(1, boidColor(boid.isPredator, false, lineage, alpha, darkMode, 0, boid.isSuper));
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

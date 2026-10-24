// CanvasRenderer.ts
import type { Boid, Point } from './Boid';
import type { Quadtree } from './Quadtree';
import { boidColor } from './BoidColor';

// A ring spreading around a newborn mutant
export interface MutantHalo {
  boid: Boid;
  start: number;      // performance.now() at birth, the halo lasts in real time so it stays visible when the simulation is sped up
}

export interface RenderOptions {
  darkMode: boolean;
  glow: boolean;                  // additive blending and halos, only visible in dark mode
  displayQuadtreeCount: boolean;
}

// What the user drew with the mouse tools
export interface WorldDrawing {
  food: { texture: HTMLCanvasElement, width: number, height: number } | null;   // one pixel per cell, scaled up
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
  private haloSprites = new Map<string, HTMLCanvasElement>();

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
  render(groups: Boid[][], quadtrees: Quadtree[] | null, options: RenderOptions, mutantHalos: MutantHalo[],
    highlighted: Boid | null, explained: Boid | { center: Point, radius: number } | null, world: WorldDrawing) {
    this.fitToDisplaySize();
    const ctx = this.ctx;
    const now = performance.now();

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
        this.drawBody(boid, options.darkMode);
      }
    }

    for (const halo of mutantHalos) {
      this.drawMutantHalo(halo, now, options.darkMode);
    }

    ctx.globalCompositeOperation = 'source-over';
    if (highlighted !== null) {
      this.drawHighlight(highlighted, options.darkMode);
    }
    if (explained !== null) {
      this.drawExplained(explained, now);
    }
    if (world.eraser !== null) {
      this.drawEraser(world.eraser.position, world.eraser.radius, options.darkMode);
    }
  }

  private color(boid: Boid, darkMode: boolean, opacity: number = 1): string {
    return boidColor(boid.isPredator, boid.isDead, boid.speedTrait, boid.fertilityTrait, boid.alpha, darkMode, opacity, boid.isSuper);
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
    ctx.strokeStyle = boidColor(boid.isPredator, false, boid.speedTrait, boid.fertilityTrait, 1, darkMode, 1 - progress);
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, 4 + this.mutantHaloRadius * progress, 0, Math.PI * 2);
    ctx.stroke();
  }

  // A circle around the inspected boid
  private drawHighlight(boid: Boid, darkMode: boolean) {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, this.bodyLength(boid) * 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // A gently pulsing amber ring around what a bubble explains: a boid, or a whole area with a dashed line
  private drawExplained(explained: Boid | { center: Point, radius: number }, now: number) {
    const ctx = this.ctx;
    const pulse = 1 + 0.1 * Math.sin(now / 250);
    const isArea = 'center' in explained;
    const center = isArea ? explained.center : explained.position;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    if (isArea) {
      ctx.setLineDash([8, 6]);
    }
    ctx.beginPath();
    ctx.arc(center.x, center.y, (isArea ? explained.radius : this.bodyLength(explained) * 1.8) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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

  private bodyLength(boid: Boid): number {
    return boid.isSuper ? 18 : boid.isPredator ? 12 : 8;
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
    const speed = round(boid.speedTrait);
    const fertility = round(boid.fertilityTrait);
    const alpha = round(boid.alpha);
    const key = `${boid.isPredator}|${boid.isSuper}|${speed}|${fertility}|${alpha}|${darkMode}|${radius}|${this.pixelRatio}`;

    let sprite = this.haloSprites.get(key);
    if (sprite === undefined) {
      sprite = document.createElement('canvas');
      const size = Math.ceil(radius * 2 * this.pixelRatio);
      sprite.width = sprite.height = size;
      const spriteCtx = sprite.getContext('2d')!;
      const gradient = spriteCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, boidColor(boid.isPredator, false, speed, fertility, alpha, darkMode, this.haloOpacity, boid.isSuper));
      gradient.addColorStop(1, boidColor(boid.isPredator, false, speed, fertility, alpha, darkMode, 0, boid.isSuper));
      spriteCtx.fillStyle = gradient;
      spriteCtx.fillRect(0, 0, size, size);
      this.haloSprites.set(key, sprite);
    }
    return sprite;
  }

  // An arrow head pointing in the direction of the velocity
  private drawBody(boid: Boid, darkMode: boolean) {
    const ctx = this.ctx;
    const length = this.bodyLength(boid) * (boid.isDead ? 2 - boid.alpha : 1);
    const halfWidth = length * 0.375;
    const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const { x, y } = boid.position;
    // Local point (forward, side) rotated to the screen
    const point = (forward: number, side: number) => {
      ctx.lineTo(x + forward * cos - side * sin, y + forward * sin + side * cos);
    };

    ctx.fillStyle = this.color(boid, darkMode);
    ctx.beginPath();
    point(length * 0.6, 0);
    point(-length * 0.4, halfWidth);
    point(-length * 0.15, 0);
    point(-length * 0.4, -halfWidth);
    ctx.closePath();
    ctx.fill();
  }
}

// CanvasRenderer.ts
import type { Boid } from './Boid';
import type { Quadtree } from './Quadtree';
import { boidColor } from './BoidColor';

export interface RenderOptions {
  darkMode: boolean;
  glow: boolean;                  // additive blending and halos, only visible in dark mode
  displayQuadtreeCount: boolean;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private pixelRatio = 1;

  private readonly trailOpacities = [0.12, 0.25, 0.45];   // the trail is drawn in 3 parts, more opaque near the boid
  private readonly haloOpacity = 0.35;
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
  render(groups: Boid[][], quadtrees: Quadtree[] | null, options: RenderOptions) {
    this.fitToDisplaySize();
    const ctx = this.ctx;

    // An opaque background, so the additive blending of the glow is computed against it
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = options.darkMode ? '#0f172a' : 'white';
    ctx.fillRect(0, 0, this.width, this.height);

    if (quadtrees !== null) {
      this.drawQuadtrees(quadtrees, options);
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
    return boid.isPredator ? 12 : 8;
  }

  private drawTrail(boid: Boid, darkMode: boolean) {
    const trail = boid.trail;
    if (trail.length < 2) {
      return;
    }
    const ctx = this.ctx;
    ctx.lineWidth = boid.isPredator ? 2.5 : 1.5;
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
      ctx.strokeStyle = boidColor(boid.isPredator, boid.isDead, boid.speedTrait, boid.fertilityTrait, boid.alpha, darkMode, this.trailOpacities[part]);
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
    const key = `${boid.isPredator}|${speed}|${fertility}|${alpha}|${darkMode}|${radius}|${this.pixelRatio}`;

    let sprite = this.haloSprites.get(key);
    if (sprite === undefined) {
      sprite = document.createElement('canvas');
      const size = Math.ceil(radius * 2 * this.pixelRatio);
      sprite.width = sprite.height = size;
      const spriteCtx = sprite.getContext('2d')!;
      const gradient = spriteCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, boidColor(boid.isPredator, false, speed, fertility, alpha, darkMode, this.haloOpacity));
      gradient.addColorStop(1, boidColor(boid.isPredator, false, speed, fertility, alpha, darkMode, 0));
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

    ctx.fillStyle = boidColor(boid.isPredator, boid.isDead, boid.speedTrait, boid.fertilityTrait, boid.alpha, darkMode);
    ctx.beginPath();
    point(length * 0.6, 0);
    point(-length * 0.4, halfWidth);
    point(-length * 0.15, 0);
    point(-length * 0.4, -halfWidth);
    ctx.closePath();
    ctx.fill();
  }
}

// Backdrop.ts
import type { Ambiance } from './Ambiance';

// A small light drifting in the background: marine snow, a star
interface Particle {
  x: number;              // in fractions of the world size, a little beyond it
  y: number;
  size: number;           // in px
  speed: number;          // in fractions of the world height per second
  phase: number;
}

// The background of an ambiance belongs to the scene: the camera films it like the world, a little beyond it as the camera
// may show beyond the borders. Only the vignette, an effect of the lens, stays on the screen
// Its smooth parts (the gradients of the sky or of the sea, the sun) are painted once per size, at half resolution,
// the sharp ones (the grid, the grain of the paper) and the moving lights at each frame
// They are only decoration: the simulation knows nothing about them
export class Backdrop {
  private still: HTMLCanvasElement | null = null;
  private stillKey = '';
  private grain: CanvasPattern | null = null;
  private vignette: HTMLCanvasElement | null = null;
  private vignetteKey = '';
  private particles: Particle[] = [];
  private particlesKey = '';
  private ribbons = new Map<string, HTMLCanvasElement>();
  private lastTime = 0;

  readonly snowCount = 180;
  readonly starCount = 220;
  readonly stillResolution = 0.5;   // the gradients are smooth, half of the pixels are enough
  readonly beyond = 0.25;           // part of the world size the background covers beyond each border

  // Under the background, in case the camera shows even farther: the color of its edges
  fill(ctx: CanvasRenderingContext2D, ambiance: Ambiance, darkMode: boolean, width: number, height: number) {
    const colors: Record<string, string> = { abyss: '#01050c', sunset: '#1e1b4b', aurora: '#020617', neon: '#06010c', paper: '#efe5cf' };
    ctx.fillStyle = colors[ambiance.name] ?? (darkMode ? '#0f172a' : 'white');
    ctx.fillRect(0, 0, width, height);
  }

  // The background of the scene, in the coordinates of the world: the camera transform is already applied
  // The quality goes down to 0.5 when the FPS gets low: fewer lights, coarser aurora
  drawScene(ctx: CanvasRenderingContext2D, ambiance: Ambiance, width: number, height: number, now: number, quality: number) {
    const elapsed = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (ambiance.name === 'classic') {
      return;
    }
    const left = -width * this.beyond;
    const top = -height * this.beyond;
    const areaWidth = width * (1 + 2 * this.beyond);
    const areaHeight = height * (1 + 2 * this.beyond);

    const key = `${ambiance.name}|${width}|${height}`;
    if (key !== this.stillKey) {
      this.stillKey = key;
      this.still = this.paintStill(ambiance, width, height);
    }
    if (this.still !== null) {
      ctx.drawImage(this.still, left, top, areaWidth, areaHeight);
    }
    if (key !== this.particlesKey) {
      this.particlesKey = key;
      this.particles = this.createParticles(ambiance);
    }

    if (ambiance.name === 'neon') {
      this.drawGrid(ctx, left, top, areaWidth, areaHeight);
    } else if (ambiance.name === 'paper') {
      ctx.fillStyle = this.paperGrain(ctx);
      ctx.fillRect(left, top, areaWidth, areaHeight);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const count = Math.round(this.particles.length * quality);
    if (ambiance.name === 'abyss') {
      this.drawShafts(ctx, width, height, now);
      // The marine snow falls slowly, swaying, and starts again from the top
      ctx.fillStyle = 'rgba(190, 225, 255, 0.35)';
      for (const particle of this.particles.slice(0, count)) {
        particle.y += particle.speed * elapsed;
        if (particle.y > 1 + this.beyond) {
          particle.y = -this.beyond;
          particle.x = -this.beyond + Math.random() * (1 + 2 * this.beyond);
        }
        const x = (particle.x + Math.sin(now / 1500 + particle.phase) * 0.004) * width;
        ctx.beginPath();
        ctx.arc(x, particle.y * height, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ambiance.name === 'aurora') {
      // The stars twinkle, the aurora ripples above them
      for (const particle of this.particles.slice(0, count)) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.35 * (0.5 + 0.5 * Math.sin(now / 700 + particle.phase))})`;
        ctx.fillRect(particle.x * width, particle.y * height, particle.size, particle.size);
      }
      this.drawAurora(ctx, left, areaWidth, height, now, quality);
    }
    ctx.restore();
  }

  // The darker edges of the picture, an effect of the lens: on the screen, whatever the camera films
  drawLens(ctx: CanvasRenderingContext2D, ambiance: Ambiance, width: number, height: number) {
    const color = ambiance.name === 'neon' ? 'rgba(0, 0, 0, 0.7)' : ambiance.name === 'paper' ? 'rgba(120, 85, 40, 0.22)' : null;
    if (color === null) {
      return;
    }
    const key = `${color}|${width}|${height}`;
    if (key !== this.vignetteKey) {
      this.vignetteKey = key;
      this.vignette = document.createElement('canvas');
      this.vignette.width = Math.max(1, Math.round(width * this.stillResolution));
      this.vignette.height = Math.max(1, Math.round(height * this.stillResolution));
      const vignette = this.vignette.getContext('2d')!;
      vignette.scale(this.stillResolution, this.stillResolution);
      const gradient = vignette.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.hypot(width, height) / 2);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, color);
      vignette.fillStyle = gradient;
      vignette.fillRect(0, 0, width, height);
    }
    ctx.drawImage(this.vignette!, 0, 0, width, height);
  }

  // The smooth parts: the gradients of the sky or of the sea, set on the world and going on beyond it, and the sun
  private paintStill(ambiance: Ambiance, width: number, height: number): HTMLCanvasElement | null {
    const stops: Record<string, [number, string][]> = {
      abyss: [[0, '#082a4d'], [0.5, '#041427'], [1, '#01050c']],
      sunset: [[0, '#1e1b4b'], [0.4, '#6d2a6b'], [0.72, '#e05d5d'], [1, '#f8b26a']],
      aurora: [[0, '#020617'], [0.6, '#03100f'], [1, '#04180f']],
      neon: [[0, '#06010c'], [1, '#06010c']],
      paper: [[0, '#f3ead6'], [1, '#f3ead6']],
    };
    if (stops[ambiance.name] === undefined) {
      return null;
    }
    const canvas = document.createElement('canvas');
    const scale = this.stillResolution;
    canvas.width = Math.max(1, Math.round(width * (1 + 2 * this.beyond) * scale));
    canvas.height = Math.max(1, Math.round(height * (1 + 2 * this.beyond) * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.translate(width * this.beyond, height * this.beyond);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    stops[ambiance.name].forEach(([offset, color]) => gradient.addColorStop(offset, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(-width * this.beyond, -height * this.beyond, width * (1 + 2 * this.beyond), height * (1 + 2 * this.beyond));

    if (ambiance.name === 'sunset') {
      // A low sun and its glow
      const sun = { x: width * 0.72, y: height * 0.8, radius: Math.min(width, height) * 0.08 };
      const glow = ctx.createRadialGradient(sun.x, sun.y, sun.radius, sun.x, sun.y, sun.radius * 6);
      glow.addColorStop(0, 'rgba(255, 220, 160, 0.45)');
      glow.addColorStop(1, 'rgba(255, 220, 160, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - sun.radius * 6, sun.y - sun.radius * 6, sun.radius * 12, sun.radius * 12);
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, sun.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  }

  // The grid of the neon, sharp at any zoom
  private drawGrid(ctx: CanvasRenderingContext2D, left: number, top: number, areaWidth: number, areaHeight: number) {
    const spacing = 48;
    ctx.strokeStyle = 'rgba(190, 70, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(left / spacing) * spacing; x < left + areaWidth; x += spacing) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + areaHeight);
    }
    for (let y = Math.ceil(top / spacing) * spacing; y < top + areaHeight; y += spacing) {
      ctx.moveTo(left, y);
      ctx.lineTo(left + areaWidth, y);
    }
    ctx.stroke();
  }

  // The grain of the paper, a small tile repeated
  private paperGrain(ctx: CanvasRenderingContext2D): CanvasPattern {
    if (this.grain === null) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 128;
      const tileCtx = tile.getContext('2d')!;
      for (let i = 0; i < 128 * 128 / 60; i++) {
        tileCtx.fillStyle = Math.random() < 0.5 ? 'rgba(120, 90, 50, 0.05)' : 'rgba(255, 255, 255, 0.12)';
        tileCtx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
      }
      this.grain = ctx.createPattern(tile, 'repeat')!;
    }
    return this.grain;
  }

  // The lights spread over the world and a little beyond it
  private createParticles(ambiance: Ambiance): Particle[] {
    const count = ambiance.name === 'abyss' ? this.snowCount : ambiance.name === 'aurora' ? this.starCount : 0;
    const spread = () => -this.beyond + Math.random() * (1 + 2 * this.beyond);
    return Array.from({ length: count }, () => ({
      x: spread(),
      y: ambiance.name === 'aurora' ? -this.beyond + Math.random() * (0.75 + this.beyond) : spread(),
      size: ambiance.name === 'aurora' ? (Math.random() < 0.85 ? 1 : 2) : 0.6 + Math.random() * 1.4,
      speed: 0.004 + Math.random() * 0.012,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  // Light shafts from the surface, slowly swaying
  private drawShafts(ctx: CanvasRenderingContext2D, width: number, height: number, now: number) {
    const top = -height * this.beyond;
    for (let i = 0; i < 7; i++) {
      const x = width * (-0.1 + 0.2 * i) + Math.sin(now / 5000 + i * 1.7) * width * 0.04;
      const spread = width * (0.05 + 0.02 * Math.sin(now / 3700 + i));
      const slant = width * 0.12;
      const gradient = ctx.createLinearGradient(0, top, 0, height * 0.9);
      gradient.addColorStop(0, `rgba(110, 190, 255, ${0.07 + 0.03 * Math.sin(now / 2300 + i * 2.1)})`);
      gradient.addColorStop(1, 'rgba(110, 190, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x - spread * 0.4, top);
      ctx.lineTo(x + spread * 0.4, top);
      ctx.lineTo(x + slant + spread * 1.6, height * 0.9);
      ctx.lineTo(x + slant - spread * 1.6, height * 0.9);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Three ribbons of light rippling in the upper sky: each column is a pre-drawn vertical gradient, stretched
  private drawAurora(ctx: CanvasRenderingContext2D, left: number, areaWidth: number, height: number, now: number, quality: number) {
    const bands: [string, number][] = [['80, 255, 160', 0.16], ['60, 220, 230', 0.24], ['170, 110, 255', 0.31]];
    const step = quality < 1 ? 8 : 4;
    bands.forEach(([color, level], band) => {
      const sprite = this.ribbon(color);
      for (let x = Math.floor(left / step) * step; x < left + areaWidth; x += step) {
        const y = height * level + Math.sin(x / 190 + now / 3200 + band * 2) * height * 0.05 + Math.sin(x / 90 + now / 1700 + band) * 4;
        const length = height * (0.12 + 0.06 * Math.sin(x / 120 + now / 2600 + band));
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(x / 260 + now / 2100 + band * 1.3);
        ctx.drawImage(sprite, x, y, step, length);
      }
    });
    ctx.globalAlpha = 1;
  }

  // A column of light, brightest near its base, fading upward and quickly downward
  private ribbon(color: string): HTMLCanvasElement {
    let sprite = this.ribbons.get(color);
    if (sprite === undefined) {
      sprite = document.createElement('canvas');
      sprite.width = 1;
      sprite.height = 128;
      const ctx = sprite.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 128);
      gradient.addColorStop(0, `rgba(${color}, 0)`);
      gradient.addColorStop(0.75, `rgba(${color}, 0.25)`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1, 128);
      this.ribbons.set(color, sprite);
    }
    return sprite;
  }
}

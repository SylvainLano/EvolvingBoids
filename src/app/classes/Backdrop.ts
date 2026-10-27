// Backdrop.ts
import type { Ambiance, AmbianceName } from './Ambiance';

// A small thing drifting in the background: marine snow, a bubble, a star, a raindrop, a spark, a petal
interface Particle {
  x: number;              // in fractions of the world size, a little beyond it
  y: number;
  size: number;           // in px
  speed: number;          // in fractions of the world height per second
  phase: number;
}

// Soft light or shade, around a point of the background
interface Blobs {
  count: number;
  x: number;              // the center of the blobs and how far they spread, in fractions of the world size
  y: number;
  spreadX: number;
  spreadY: number;
  radius: number;         // in fractions of the smallest side of the world
  color: string;          // r, g, b
  alpha: number;
}

// The same random numbers at each painting, for the nebulae and the clouds to keep their shapes when the size changes
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The background of an ambiance belongs to the scene: the camera films it like the world. It goes on a little beyond it,
// in case the camera ever shows more. Only the vignette, an effect of the lens, stays on the screen
// Its smooth parts (the gradients of the sky or of the sea, the sun, the nebulae, the clouds) are painted once per size,
// at half resolution, the sharp ones (the grid, the grain of the paper, the light of a reef) and the moving ones at each frame
// They are only decoration: the simulation knows nothing about them
export class Backdrop {
  private still: HTMLCanvasElement | null = null;
  private stillKey = '';
  private grain: CanvasPattern | null = null;
  private caustics: CanvasPattern | null = null;
  private vignette: HTMLCanvasElement | null = null;
  private vignetteKey = '';
  private particles: Particle[] = [];
  private particlesKey = '';
  private ribbons = new Map<string, HTMLCanvasElement>();
  private lightning = { next: 0, start: -Infinity, x: 0, y: 0 };
  private lastTime = 0;

  readonly particleCounts: Partial<Record<AmbianceName, number>> = { abyss: 210, aurora: 220, cosmos: 380, storm: 700, embers: 220, sakura: 160 };
  readonly bubbleCount = 30;        // the first particles of the abyss are bubbles, the others its marine snow
  readonly stillResolution = 0.5;   // the gradients are smooth, half of the pixels are enough
  readonly beyond = 0.25;           // part of the world size the background covers beyond each border
  // A lightning lights the clouds slowly and rarely, never in flashes: it rises in a third of a second, then fades away
  readonly lightningInterval: [number, number] = [12000, 35000];
  readonly lightningRise = 0.35;
  readonly lightningFade = 0.6;

  // Under the background, in case the camera shows even farther: the color of its edges
  fill(ctx: CanvasRenderingContext2D, ambiance: Ambiance, darkMode: boolean, width: number, height: number) {
    const colors: Partial<Record<AmbianceName, string>> = {
      abyss: '#01050c', sunset: '#1e1b4b', aurora: '#020617', neon: '#06010c', paper: '#efe5cf',
      reef: '#0d6a8f', cosmos: '#03020a', storm: '#2b3341', embers: '#030101', sakura: '#f4e0cf',
    };
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
      this.lightning = { next: now + 6000, start: -Infinity, x: 0, y: 0 };
    }
    const particles = this.particles.slice(0, Math.round(this.particles.length * quality));

    ctx.save();
    switch (ambiance.name) {
      case 'neon':
        this.drawGrid(ctx, left, top, areaWidth, areaHeight);
        break;
      case 'paper':
        ctx.fillStyle = this.paperGrain(ctx);
        ctx.fillRect(left, top, areaWidth, areaHeight);
        break;
      case 'abyss':
        ctx.globalCompositeOperation = 'lighter';
        this.drawShafts(ctx, width, height, now);
        this.drawSnow(ctx, particles.slice(this.bubbleCount), width, height, now, elapsed);
        this.drawBubbles(ctx, particles.slice(0, this.bubbleCount), width, height, now, elapsed);
        break;
      case 'aurora':
        // The stars twinkle, the aurora ripples above them
        ctx.globalCompositeOperation = 'lighter';
        for (const particle of particles) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.35 * (0.5 + 0.5 * Math.sin(now / 700 + particle.phase))})`;
          ctx.fillRect(particle.x * width, particle.y * height, particle.size, particle.size);
        }
        this.drawAurora(ctx, left, areaWidth, height, now, quality);
        break;
      case 'reef':
        ctx.globalCompositeOperation = 'lighter';
        this.drawCaustics(ctx, left, top, areaWidth, areaHeight, now);
        break;
      case 'cosmos':
        ctx.globalCompositeOperation = 'lighter';
        this.drawStars(ctx, particles, width, height, now, elapsed);
        break;
      case 'storm':
        this.drawLightning(ctx, width, height, now);
        this.drawRain(ctx, particles, width, height, elapsed);
        break;
      case 'embers':
        ctx.globalCompositeOperation = 'lighter';
        this.drawSparks(ctx, particles, width, height, now, elapsed);
        break;
      case 'sakura':
        this.drawPetals(ctx, particles, width, height, now, elapsed);
        break;
    }
    ctx.restore();
  }

  // The darker edges of the picture, an effect of the lens: on the screen, whatever the camera films
  drawLens(ctx: CanvasRenderingContext2D, ambiance: Ambiance, width: number, height: number) {
    const colors: Partial<Record<AmbianceName, string>> = {
      neon: 'rgba(0, 0, 0, 0.7)', paper: 'rgba(120, 85, 40, 0.22)', reef: 'rgba(0, 30, 60, 0.35)', cosmos: 'rgba(0, 0, 0, 0.55)',
      storm: 'rgba(5, 8, 15, 0.5)', embers: 'rgba(0, 0, 0, 0.6)', sakura: 'rgba(190, 110, 140, 0.18)',
    };
    const color = colors[ambiance.name];
    if (color === undefined) {
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

  // The smooth parts: the gradients of the sky or of the sea, set on the world and going on beyond it, and what lies in
  // them: the sun, the nebulae, the clouds, the glow of the embers, the hills
  private paintStill(ambiance: Ambiance, width: number, height: number): HTMLCanvasElement | null {
    const stops: Partial<Record<AmbianceName, [number, string][]>> = {
      abyss: [[0, '#082a4d'], [0.5, '#041427'], [1, '#01050c']],
      sunset: [[0, '#1e1b4b'], [0.4, '#6d2a6b'], [0.72, '#e05d5d'], [1, '#f8b26a']],
      aurora: [[0, '#020617'], [0.6, '#03100f'], [1, '#04180f']],
      neon: [[0, '#06010c'], [1, '#06010c']],
      paper: [[0, '#f3ead6'], [1, '#f3ead6']],
      reef: [[0, '#5cc8d8'], [0.45, '#1f9dbd'], [1, '#0d6a8f']],
      cosmos: [[0, '#05030f'], [1, '#03020a']],
      storm: [[0, '#2b3341'], [0.5, '#475265'], [1, '#5f6b7e']],
      embers: [[0, '#030101'], [0.6, '#120302'], [1, '#3a0b03']],
      sakura: [[0, '#fbe3ec'], [0.55, '#f7d4df'], [1, '#f4e0cf']],
    };
    const colors = stops[ambiance.name];
    if (colors === undefined) {
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
    colors.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(-width * this.beyond, -height * this.beyond, width * (1 + 2 * this.beyond), height * (1 + 2 * this.beyond));

    const random = seededRandom(7);
    const paint = (blobs: Blobs) => this.paintBlobs(ctx, blobs, width, height, random);
    switch (ambiance.name) {
      case 'sunset': {
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
        break;
      }
      case 'cosmos':
        // Nebulae, clouds of colored light adding up
        ctx.globalCompositeOperation = 'lighter';
        paint({ count: 18, x: 0.25, y: 0.3, spreadX: 0.45, spreadY: 0.35, radius: 0.22, color: '140, 40, 160', alpha: 0.09 });
        paint({ count: 18, x: 0.75, y: 0.68, spreadX: 0.5, spreadY: 0.35, radius: 0.24, color: '30, 80, 170', alpha: 0.1 });
        paint({ count: 10, x: 0.6, y: 0.15, spreadX: 0.35, spreadY: 0.2, radius: 0.16, color: '20, 150, 160', alpha: 0.07 });
        paint({ count: 10, x: 0.12, y: 0.85, spreadX: 0.3, spreadY: 0.25, radius: 0.18, color: '170, 50, 90', alpha: 0.07 });
        break;
      case 'storm':
        // A heavy ceiling of clouds, its lower edges lit by the day
        paint({ count: 16, x: 0.5, y: 0.45, spreadX: 1.4, spreadY: 0.3, radius: 0.3, color: '130, 140, 160', alpha: 0.08 });
        paint({ count: 34, x: 0.5, y: 0.08, spreadX: 1.5, spreadY: 0.5, radius: 0.32, color: '10, 13, 20', alpha: 0.3 });
        break;
      case 'embers':
        // The glow of the fire bed, from below, and its faint light higher up
        ctx.globalCompositeOperation = 'lighter';
        paint({ count: 14, x: 0.5, y: 0.7, spreadX: 1.4, spreadY: 0.4, radius: 0.35, color: '160, 30, 8', alpha: 0.07 });
        paint({ count: 28, x: 0.5, y: 1.02, spreadX: 1.5, spreadY: 0.35, radius: 0.34, color: '255, 80, 15', alpha: 0.15 });
        break;
      case 'sakura': {
        // The light of the dawn, pink clouds and two lines of faint hills
        paint({ count: 1, x: 0.22, y: 0.18, spreadX: 0, spreadY: 0, radius: 1.1, color: '255, 252, 245', alpha: 0.6 });
        paint({ count: 10, x: 0.6, y: 0.3, spreadX: 1.2, spreadY: 0.3, radius: 0.2, color: '255, 205, 220', alpha: 0.3 });
        const hills: [number, number, string][] = [[0.78, 0.07, 'rgba(205, 165, 190, 0.3)'], [0.88, 0.05, 'rgba(180, 135, 165, 0.32)']];
        hills.forEach(([level, swell, color], index) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(-width * this.beyond, height * (1 + this.beyond));
          for (let x = -width * this.beyond; x <= width * (1 + this.beyond); x += 8) {
            const wave = Math.sin(x / width * 4.2 + index * 2.1) * 0.6 + Math.sin(x / width * 9.7 + index) * 0.4;
            ctx.lineTo(x, height * (level - swell * wave));
          }
          ctx.lineTo(width * (1 + this.beyond), height * (1 + this.beyond));
          ctx.closePath();
          ctx.fill();
        });
        break;
      }
    }
    // The browser dithers its gradients: magnified by the camera, the noise of the half resolution would show as a grid
    const smooth = document.createElement('canvas');
    smooth.width = canvas.width;
    smooth.height = canvas.height;
    const smoothCtx = smooth.getContext('2d')!;
    smoothCtx.filter = 'blur(2px)';
    smoothCtx.drawImage(canvas, 0, 0);
    return smooth;
  }

  // Soft round blobs of light or shade, scattered around a point
  private paintBlobs(ctx: CanvasRenderingContext2D, blobs: Blobs, width: number, height: number, random: () => number) {
    const side = Math.min(width, height);
    for (let i = 0; i < blobs.count; i++) {
      const x = (blobs.x + (random() - 0.5) * blobs.spreadX) * width;
      const y = (blobs.y + (random() - 0.5) * blobs.spreadY) * height;
      const radius = blobs.radius * side * (0.5 + random());
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${blobs.color}, ${blobs.alpha})`);
      gradient.addColorStop(1, `rgba(${blobs.color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
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

  // The things drifting over the world and a little beyond it
  private createParticles(ambiance: Ambiance): Particle[] {
    const count = this.particleCounts[ambiance.name] ?? 0;
    return Array.from({ length: count }, (_, index) => {
      const particle = { x: this.spread(), y: this.spread(), size: 0.6 + Math.random() * 1.4, speed: 0.004 + Math.random() * 0.012, phase: Math.random() * Math.PI * 2 };
      switch (ambiance.name) {
        case 'abyss':
          // The bubbles first, then the marine snow, small and light
          return index < this.bubbleCount ? { ...particle, size: 1.5 + Math.random() * 2, speed: 0.04 + Math.random() * 0.04 }
            : { ...particle, size: 0.4 + Math.random() * 0.7 };
        case 'aurora':
          // The stars stay above the hills
          return { ...particle, y: -this.beyond + Math.random() * (0.75 + this.beyond), size: Math.random() < 0.85 ? 1 : 2 };
        case 'cosmos': {
          // A few bright stars among many faint ones, the bright ones closer, drifting faster
          const size = Math.random() < 0.7 ? 1 : Math.random() < 0.85 ? 1.6 : 2.4;
          return { ...particle, size, speed: 0.002 * size };
        }
        case 'storm':
          return { ...particle, size: 18 + Math.random() * 12, speed: 0.9 + Math.random() * 0.4 };
        case 'embers':
          return { ...particle, size: 0.8 + Math.random() * 1.5, speed: 0.05 + Math.random() * 0.07 };
        case 'sakura':
          return { ...particle, size: 5 + Math.random() * 4, speed: 0.03 + Math.random() * 0.03 };
        default:
          return particle;
      }
    });
  }

  // A random place across the background, in fractions of the world size
  private spread(): number {
    return -this.beyond + Math.random() * (1 + 2 * this.beyond);
  }

  // Keeps a particle over the background: what leaves it on one side comes back on the other
  private wrap(value: number): number {
    const size = 1 + 2 * this.beyond;
    return -this.beyond + (((value + this.beyond) % size) + size) % size;
  }

  // Moves a particle, in fractions of the world size. Drifting sideways, it comes back on the other side; falling or rising
  // out of the background, it comes back from the opposite edge, somewhere else
  private drift(particle: Particle, dx: number, dy: number) {
    particle.x = this.wrap(particle.x + dx);
    particle.y += dy;
    if (particle.y > 1 + this.beyond || particle.y < -this.beyond) {
      particle.y = dy > 0 ? -this.beyond : 1 + this.beyond;
      particle.x = this.spread();
    }
  }

  // The marine snow falls slowly, swaying
  private drawSnow(ctx: CanvasRenderingContext2D, particles: Particle[], width: number, height: number, now: number, elapsed: number) {
    ctx.fillStyle = 'rgba(190, 225, 255, 0.22)';
    for (const particle of particles) {
      this.drift(particle, 0, particle.speed * elapsed);
      const x = (particle.x + Math.sin(now / 1500 + particle.phase) * 0.004) * width;
      ctx.beginPath();
      ctx.arc(x, particle.y * height, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The bubbles rise to the surface, swaying: thin rings of light
  private drawBubbles(ctx: CanvasRenderingContext2D, particles: Particle[], width: number, height: number, now: number, elapsed: number) {
    ctx.strokeStyle = 'rgba(170, 220, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const particle of particles) {
      this.drift(particle, 0, -particle.speed * elapsed);
      const x = (particle.x + Math.sin(now / 900 + particle.phase) * 0.004) * width;
      const y = particle.y * height;
      ctx.moveTo(x + particle.size, y);
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
    }
    ctx.stroke();
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

  // The light of the surface rippling over the reef: two networks of light lines drifting across each other
  private drawCaustics(ctx: CanvasRenderingContext2D, left: number, top: number, areaWidth: number, areaHeight: number, now: number) {
    const pattern = this.causticPattern(ctx);
    const time = now / 1000;
    const layers: [number, number, number, number][] = [[14, 6, 0, 1.7], [-10, 9, 25, 2.3]];
    ctx.fillStyle = pattern;
    ctx.globalAlpha = 0.07;
    for (const [speedX, speedY, angle, scale] of layers) {
      pattern.setTransform(new DOMMatrix().translate(speedX * time, speedY * time).rotate(angle).scale(scale));
      ctx.fillRect(left, top, areaWidth, areaHeight);
    }
    ctx.globalAlpha = 1;
  }

  // A tile of light lines along the borders of random cells, repeated without seams: the cells wrap around the tile
  private causticPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
    if (this.caustics === null) {
      const size = 256;
      const cells = 4;
      const cell = size / cells;
      const random = seededRandom(11);
      const points = Array.from({ length: cells * cells }, (_, i) => ({ x: (i % cells + random()) * cell, y: (Math.floor(i / cells) + random()) * cell }));
      const tile = document.createElement('canvas');
      tile.width = tile.height = size;
      const tileCtx = tile.getContext('2d')!;
      const image = tileCtx.createImageData(size, size);
      const wrap = (value: number) => ((value % size) + size) % size;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          // The lines wave, with waves fitting in the tile
          const u = wrap(x + Math.sin(2 * Math.PI * 2 * y / size) * cell * 0.18 + Math.sin(2 * Math.PI * 5 * y / size) * cell * 0.05);
          const v = wrap(y + Math.sin(2 * Math.PI * 3 * x / size) * cell * 0.18 + Math.sin(2 * Math.PI * 4 * x / size) * cell * 0.05);
          // The two closest points, among those of the cells around, wrapping around the tile
          let first = Infinity;
          let second = Infinity;
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              const column = Math.floor(u / cell) + i;
              const row = Math.floor(v / cell) + j;
              const wrappedColumn = (column + cells) % cells;
              const wrappedRow = (row + cells) % cells;
              const point = points[wrappedRow * cells + wrappedColumn];
              const distance = (point.x + (column - wrappedColumn) * cell - u) ** 2 + (point.y + (row - wrappedRow) * cell - v) ** 2;
              if (distance < first) {
                second = first;
                first = distance;
              } else if (distance < second) {
                second = distance;
              }
            }
          }
          // Bright where two cells meet
          const light = Math.max(0, 1 - (Math.sqrt(second) - Math.sqrt(first)) / (cell * 0.16)) ** 2;
          const index = (y * size + x) * 4;
          image.data[index] = image.data[index + 1] = image.data[index + 2] = 255;
          image.data[index + 3] = Math.round(light * 255);
        }
      }
      tileCtx.putImageData(image, 0, 0);
      this.caustics = ctx.createPattern(tile, 'repeat')!;
    }
    return this.caustics;
  }

  // The stars drift slowly, the closest ones faster, and twinkle
  private drawStars(ctx: CanvasRenderingContext2D, particles: Particle[], width: number, height: number, now: number, elapsed: number) {
    for (const particle of particles) {
      this.drift(particle, -particle.speed * elapsed, 0);
      const twinkle = 0.5 + 0.5 * Math.sin(now / 900 + particle.phase);
      ctx.fillStyle = `rgba(225, 235, 255, ${0.4 + 0.5 * twinkle * (particle.size > 1 ? 1 : 0.6)})`;
      if (particle.size > 2) {
        ctx.beginPath();
        ctx.arc(particle.x * width, particle.y * height, particle.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(particle.x * width, particle.y * height, particle.size, particle.size);
      }
    }
  }

  // Now and then, a lightning hidden in the clouds lights the sky up slowly, and fades away
  private drawLightning(ctx: CanvasRenderingContext2D, width: number, height: number, now: number) {
    const lightning = this.lightning;
    if (now >= lightning.next) {
      const [shortest, longest] = this.lightningInterval;
      lightning.start = now;
      lightning.next = now + shortest + Math.random() * (longest - shortest);
      lightning.x = 0.1 + Math.random() * 0.8;
      lightning.y = Math.random() * 0.3;
    }
    const time = (now - lightning.start) / 1000;
    const rise = Math.min(1, time / this.lightningRise);
    const intensity = time < this.lightningRise ? rise * rise * (3 - 2 * rise) : Math.exp(-(time - this.lightningRise) / this.lightningFade);
    if (intensity < 0.01) {
      return;
    }
    const x = lightning.x * width;
    const y = lightning.y * height;
    const radius = Math.max(width, height);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(200, 215, 255, ${0.3 * intensity})`);
    gradient.addColorStop(1, 'rgba(200, 215, 255, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // The rain falls fast, slanted by the wind
  private drawRain(ctx: CanvasRenderingContext2D, particles: Particle[], width: number, height: number, elapsed: number) {
    const slant = -0.28;
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const particle of particles) {
      this.drift(particle, slant * particle.speed * elapsed * height / width, particle.speed * elapsed);
      const x = particle.x * width;
      const y = particle.y * height;
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant * particle.size, y - particle.size);
    }
    ctx.stroke();
  }

  // The fire breathes, and its sparks rise, swaying and flickering, and die out on their way up
  private drawSparks(ctx: CanvasRenderingContext2D, particles: Particle[], width: number, height: number, now: number, elapsed: number) {
    const breath = 0.5 + 0.25 * Math.sin(now / 1900) + 0.25 * Math.sin(now / 770 + 1);
    const glow = ctx.createLinearGradient(0, height * (1 + this.beyond), 0, height * 0.45);
    glow.addColorStop(0, `rgba(255, 90, 20, ${0.08 + 0.08 * breath})`);
    glow.addColorStop(1, 'rgba(255, 90, 20, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-width * this.beyond, height * 0.45, width * (1 + 2 * this.beyond), height * (0.55 + this.beyond));
    for (const particle of particles) {
      this.drift(particle, 0, -particle.speed * elapsed);
      const life = Math.max(0, Math.min(1, (particle.y + 0.1) / 0.9));
      const flicker = 0.6 + 0.4 * Math.sin(now / 150 + particle.phase * 7);
      const x = (particle.x + Math.sin(now / 700 + particle.phase) * 0.01) * width;
      ctx.fillStyle = `rgba(255, 160, 60, ${0.9 * life * flicker})`;
      ctx.beginPath();
      ctx.arc(x, particle.y * height, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The cherry petals fall slowly, carried by the wind, tumbling over themselves
  private drawPetals(ctx: CanvasRenderingContext2D, particles: Particle[], width: number, height: number, now: number, elapsed: number) {
    const colors = ['rgba(255, 183, 205, 0.85)', 'rgba(255, 222, 232, 0.9)', 'rgba(240, 150, 180, 0.8)'];
    particles.forEach((particle, index) => {
      this.drift(particle, (0.02 + 0.03 * Math.sin(now / 1600 + particle.phase)) * elapsed, particle.speed * elapsed);
      const tumble = Math.cos(now / 900 * (0.6 + particle.phase / 10) + particle.phase);
      ctx.fillStyle = colors[index % colors.length];
      ctx.beginPath();
      ctx.ellipse(particle.x * width, particle.y * height, particle.size * Math.max(0.15, Math.abs(tumble)), particle.size * 0.6,
        now / 2500 + particle.phase * 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// FoodField.ts
import type { Point } from './Boid';

// A fertile area, where the plankton grows, slowly drifting across the screen
interface Patch {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// Plankton eaten by the boids, stored as a quantity of food in each cell of a grid
// It grows back in the fertile patches, and fades away elsewhere
export class FoodField {
  readonly cellSize = 20;
  cols = 0;
  rows = 0;
  food = new Float32Array(0);           // quantity of food in each cell, from 0 to 1
  capacity = new Float32Array(0);       // maximum quantity of food in each cell, given by the patches

  readonly patchSpeed = 0.15;          // in px per step: a patch crosses the screen in a couple of minutes
  readonly regrowthRate = 0.0005;       // part of the missing food growing back per step: a grazed cell is 63 % full again after 2000 steps
  readonly decayRate = 0.0005;          // decay per step of the food above the capacity (sown or left by a patch)
  productivity = 1;                     // the season: the fertile areas hold less in winter, so less grows back
  private patches: Patch[] = [];
  private width = 0;
  private height = 0;

  private image: HTMLCanvasElement | null = null;
  private imageData: ImageData | null = null;

  constructor(width: number, height: number, patchCount: number = 4) {
    this.setSize(width, height);
    this.patches = Array.from({ length: patchCount }, () => this.randomPatch());
    this.updateCapacity();
    this.food.set(this.capacity);
  }

  get patchCount(): number {
    return this.patches.length;
  }

  // Fertile areas appear or vanish, the plankton follows at its own pace
  setPatchCount(count: number) {
    while (this.patches.length < count) {
      this.patches.push(this.randomPatch());
    }
    if (this.patches.length > count) {
      this.patches.length = Math.max(0, count);
    }
  }

  private setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cols = Math.max(1, Math.ceil(width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(height / this.cellSize));
    this.food = new Float32Array(this.cols * this.rows);
    this.capacity = new Float32Array(this.cols * this.rows);
    this.image = null;
    this.imageData = null;
  }

  private randomPatch(): Patch {
    const radius = Math.max(1, Math.min(this.width, this.height) * (0.15 + Math.random() * 0.1));
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: Math.cos(angle) * this.patchSpeed,
      vy: Math.sin(angle) * this.patchSpeed,
      radius,
    };
  }

  // Fit a new window size, keeping the food where it was relative to the screen
  resize(width: number, height: number) {
    const old = { cols: this.cols, rows: this.rows, food: this.food };
    const scaleX = width / this.width;
    const scaleY = height / this.height;
    this.setSize(width, height);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const oldCol = Math.min(old.cols - 1, Math.floor(col * old.cols / this.cols));
        const oldRow = Math.min(old.rows - 1, Math.floor(row * old.rows / this.rows));
        this.food[row * this.cols + col] = old.food[oldRow * old.cols + oldCol];
      }
    }
    for (const patch of this.patches) {
      patch.x *= scaleX;
      patch.y *= scaleY;
    }
    this.updateCapacity();
  }

  private index(point: Point): number {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor(point.x / this.cellSize)));
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor(point.y / this.cellSize)));
    return row * this.cols + col;
  }

  // The patches drift and bounce on the borders, the food grows back like grass, or fades, toward their capacity
  update(steps: number) {
    for (const patch of this.patches) {
      patch.x += patch.vx * steps;
      patch.y += patch.vy * steps;
      if ((patch.x < 0 && patch.vx < 0) || (patch.x > this.width && patch.vx > 0)) {
        patch.vx = -patch.vx;
      }
      if ((patch.y < 0 && patch.vy < 0) || (patch.y > this.height && patch.vy > 0)) {
        patch.vy = -patch.vy;
      }
    }
    this.updateCapacity();

    for (let i = 0; i < this.food.length; i++) {
      const food = this.food[i];
      const capacity = this.capacity[i];
      if (food < capacity) {
        this.food[i] = Math.min(capacity, food + this.regrowthRate * (capacity - food) * steps);
      } else if (food > capacity) {
        this.food[i] = Math.max(capacity, food - this.decayRate * steps);
      }
    }
  }

  // Each patch is a soft disc, the capacity is their sum
  private updateCapacity() {
    for (let row = 0; row < this.rows; row++) {
      const y = (row + 0.5) * this.cellSize;
      for (let col = 0; col < this.cols; col++) {
        const x = (col + 0.5) * this.cellSize;
        let capacity = 0;
        for (const patch of this.patches) {
          const distanceSquared = (x - patch.x) ** 2 + (y - patch.y) ** 2;
          capacity += Math.exp(-distanceSquared / (patch.radius * patch.radius * 0.5));
        }
        this.capacity[row * this.cols + col] = Math.min(1, capacity) * this.productivity;
      }
    }
  }

  // Eat at most the given quantity where the boid is, returns what was eaten
  eat(point: Point, quantity: number): number {
    const i = this.index(point);
    const eaten = Math.min(this.food[i], quantity);
    this.food[i] -= eaten;
    return eaten;
  }

  // Direction toward more food, smelled at two distances: the food nearby, and the patches farther away
  gradient(point: Point): Point {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor(point.x / this.cellSize)));
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor(point.y / this.cellSize)));
    const at = (c: number, r: number) =>
      this.food[Math.min(this.rows - 1, Math.max(0, r)) * this.cols + Math.min(this.cols - 1, Math.max(0, c))];
    let gx = 0;
    let gy = 0;
    for (const reach of [2, 6]) {
      gx += at(col + reach, row) - at(col - reach, row);
      gy += at(col, row + reach) - at(col, row - reach);
    }
    const length = Math.sqrt(gx * gx + gy * gy);
    return length > 0 ? { x: gx / length, y: gy / length } : { x: 0, y: 0 };
  }

  // Add food around a point, it fades away if it is out of the fertile patches
  sow(point: Point, radius: number, quantity: number) {
    this.forCellsAround(point, radius, (i, weight) => {
      this.food[i] = Math.min(1, this.food[i] + quantity * weight);
    });
  }

  erase(point: Point, radius: number) {
    this.forCellsAround(point, radius, (i) => this.food[i] = 0);
  }

  private forCellsAround(point: Point, radius: number, action: (index: number, weight: number) => void) {
    const minCol = Math.max(0, Math.floor((point.x - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((point.x + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((point.y - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((point.y + radius) / this.cellSize));
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const distance = Math.hypot((col + 0.5) * this.cellSize - point.x, (row + 0.5) * this.cellSize - point.y);
        if (distance <= radius) {
          action(row * this.cols + col, 1 - distance / radius);
        }
      }
    }
  }

  // Quantity of food compared to what the patches can hold, as a ratio
  fillRatio(): number {
    let food = 0;
    let capacity = 0;
    for (let i = 0; i < this.food.length; i++) {
      food += this.food[i];
      capacity += this.capacity[i];
    }
    return capacity > 0 ? food / capacity : 0;
  }

  // A small image with one pixel per cell, drawn scaled up and smoothed it looks like a glowing mist
  // It turns from green blue in summer to an icy blue in winter
  texture(darkMode: boolean): HTMLCanvasElement {
    if (this.image === null || this.imageData === null) {
      this.image = document.createElement('canvas');
      this.image.width = this.cols;
      this.image.height = this.rows;
      this.imageData = this.image.getContext('2d')!.createImageData(this.cols, this.rows);
    }
    const cold = Math.min(1, Math.max(0, (1 - this.productivity) / 0.7));
    const mix = (summer: number, winter: number) => summer + (winter - summer) * cold;
    const [red, green, blue, maxAlpha] = darkMode
      ? [mix(45, 165), mix(212, 205), mix(191, 245), 0.32]
      : [mix(34, 70), mix(160, 130), mix(90, 200), 0.28];
    const data = this.imageData.data;
    for (let i = 0; i < this.food.length; i++) {
      data[i * 4] = red;
      data[i * 4 + 1] = green;
      data[i * 4 + 2] = blue;
      data[i * 4 + 3] = Math.min(1, this.food[i]) * maxAlpha * 255;
    }
    this.image.getContext('2d')!.putImageData(this.imageData, 0, 0);
    return this.image;
  }
}

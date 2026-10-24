// Plants.ts
import type { Point } from './Boid';

// A part of the twig of an alga, from its root: it shows once the alga has grown that far
export interface TwigSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  from: number;             // distance from the root along the twig, at the start of the segment
  depth: number;            // 0 on the trunk, 1 on its branches, 2 on theirs
}

// An alga growing in place on the sea floor, nibbled by the boids
export interface Plant {
  x: number;
  y: number;
  biomass: number;          // the food it holds, it grows up to the maximum
  twig: TwigSegment[];      // its shape when fully grown, above its root: a small tree without leaves
  length: number;           // the farthest distance from the root along the twig
}

// The algae: they grow in spring and summer and sow their seeds around them, so they form meadows,
// then they wither in winter and may disappear, and new ones sprout in spring
export class PlantField {
  plants: Plant[] = [];
  readonly maxBiomass = 4;              // a grown plant feeds a small flock for a while
  readonly growthRate = 0.001;          // part of the missing biomass growing back per step at the best of the summer
  readonly witherRate = 0.0004;         // part of the biomass lost per step at the worst of the winter: few plants see the spring
  readonly deadBiomass = 0.15;          // under this, the plant is gone
  readonly rootBiomass = 0.3;           // the boids can't eat below this: a grazed plant grows back, only the winter kills it
  readonly sproutBiomass = 0.4;         // a seed, a sprout or a plant added with the mouse
  readonly startingPlants = 4;          // the first algae, the meadows grow from their seeds
  readonly seedChance = 1 / 4800;       // per step, for a grown plant in good season: a seed about every 80 seconds
  readonly seedSeason = 0.3;            // the plants sow their seeds when the season is better than this, from -1 in winter to 1 in summer
  readonly sproutChance = 1 / 600;      // per step, when there are only a few plants left: new ones come from elsewhere
  readonly seedDistance = [30, 80];     // a seed falls this far from its plant, in px
  readonly spacing = 25;                // two plants are never closer than this, in px
  readonly margin = 40;                 // no plant too close to the borders
  readonly areaPerPlant = 25000;        // in px², for the largest number of plants on the screen
  readonly twigStep = 3;                // length of a segment of a twig, in px
  private width = 0;
  private height = 0;

  // The screen starts with a few algae, already grown
  initialize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.plants = [];
    for (let i = 0; i < this.startingPlants; i++) {
      this.sprout(this.randomPoint(), this.maxBiomass * (0.6 + Math.random() * 0.4));
    }
  }

  get maxPlants(): number {
    return Math.max(4, Math.round(this.width * this.height / this.areaPerPlant));
  }

  get totalBiomass(): number {
    return this.plants.reduce((sum, plant) => sum + plant.biomass, 0);
  }

  // The plants keep their place relative to the screen
  resize(width: number, height: number) {
    const scaleX = this.width > 0 ? width / this.width : 1;
    const scaleY = this.height > 0 ? height / this.height : 1;
    this.width = width;
    this.height = height;
    for (const plant of this.plants) {
      plant.x *= scaleX;
      plant.y *= scaleY;
    }
  }

  // The season sets the growth: from 1 in summer, growing, to the winter food, withering below one half
  update(steps: number, productivity: number) {
    const season = (productivity - 0.5) * 2;
    for (const plant of this.plants) {
      if (season > 0) {
        plant.biomass = Math.min(this.maxBiomass, plant.biomass + this.growthRate * season * (this.maxBiomass - plant.biomass) * steps);
        if (season > this.seedSeason && plant.biomass > this.maxBiomass * 0.6 && Math.random() < this.seedChance * steps) {
          this.seed(plant);
        }
      } else {
        plant.biomass -= this.witherRate * -season * plant.biomass * steps;
      }
    }
    this.plants = this.plants.filter(plant => plant.biomass >= this.deadBiomass);

    // Never extinct for good: when the season is good again, new plants come from elsewhere
    if (season > 0 && this.plants.length < this.startingPlants && Math.random() < this.sproutChance * steps) {
      this.sprout(this.randomPoint(), this.sproutBiomass);
    }
  }

  // The closest plant within the radius, among those accepted
  closest(point: Point, radius: number, accept: (plant: Plant) => boolean = () => true): Plant | null {
    let closest: Plant | null = null;
    let closestDistance = radius * radius;
    for (const plant of this.plants) {
      const distance = (plant.x - point.x) ** 2 + (plant.y - point.y) ** 2;
      if (distance < closestDistance && accept(plant)) {
        closest = plant;
        closestDistance = distance;
      }
    }
    return closest;
  }

  // How far the twig has grown from its root: a sprout is a short stem, its branches show as it grows,
  // and a grazed or withering plant loses them again
  reach(plant: Plant): number {
    return plant.length * Math.min(1, 2 * plant.biomass / this.maxBiomass) ** 0.7;
  }

  // The size of the whole plant, which keeps growing once all its branches are out
  scale(plant: Plant): number {
    return 0.5 + 0.5 * Math.min(1, plant.biomass / this.maxBiomass);
  }

  // The distance at which a boid can nibble an alga, around its root
  radius(plant: Plant): number {
    return 6 + this.reach(plant) * 0.7;
  }

  // What the boids can eat of a plant: all but its roots
  edible(plant: Plant): number {
    return Math.max(0, plant.biomass - this.rootBiomass);
  }

  // A bite, at most what the plant holds above its roots
  eat(plant: Plant, quantity: number): number {
    const eaten = Math.min(this.edible(plant), quantity);
    plant.biomass -= eaten;
    return eaten;
  }

  erase(center: Point, radius: number) {
    this.plants = this.plants.filter(plant => (plant.x - center.x) ** 2 + (plant.y - center.y) ** 2 > radius * radius);
  }

  // A plant added with the mouse, if there is room for it
  add(point: Point): Plant | null {
    return this.sprout(point, this.sproutBiomass);
  }

  private seed(plant: Plant) {
    const angle = Math.random() * Math.PI * 2;
    const distance = this.seedDistance[0] + Math.random() * (this.seedDistance[1] - this.seedDistance[0]);
    this.sprout({ x: plant.x + Math.cos(angle) * distance, y: plant.y + Math.sin(angle) * distance }, this.sproutBiomass);
  }

  private sprout(point: Point, biomass: number): Plant | null {
    const inside = point.x >= this.margin && point.x <= this.width - this.margin && point.y >= this.margin && point.y <= this.height - this.margin;
    if (!inside || this.plants.length >= this.maxPlants || this.closest(point, this.spacing) !== null) {
      return null;
    }
    const twig = this.growTwig();
    const plant = { x: point.x, y: point.y, biomass, twig, length: Math.max(...twig.map(segment => segment.from)) + this.twigStep };
    this.plants.push(plant);
    return plant;
  }

  // A small tree without leaves: a short trunk growing up toward the light, that soon forks into branches,
  // on one side then on the other. The branches spread wide, some bend up, others droop, even below the horizontal
  private growTwig(): TwigSegment[] {
    const twig: TwigSegment[] = [];
    const up = -Math.PI / 2;
    const branch = (x: number, y: number, angle: number, from: number, steps: number, depth: number) => {
      // The trunk is drawn back to the vertical, each branch has its own bend, toward the light or drooping
      const bend = depth === 0 ? 0.3 : (Math.random() - 0.45) * 0.12;
      const forkChance = depth === 0 ? 0.55 : 0.4;
      let side = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < steps; i++) {
        angle += (Math.random() - 0.5) * 0.25 + (up - angle) * bend;
        // No branch hangs straight down
        angle = up + Math.max(-2.4, Math.min(2.4, angle - up));
        const next = { x: x + Math.cos(angle) * this.twigStep, y: y + Math.sin(angle) * this.twigStep };
        twig.push({ x1: x, y1: y, x2: next.x, y2: next.y, from, depth });
        x = next.x;
        y = next.y;
        from += this.twigStep;
        if (depth < 2 && i >= 1 && i < steps - 1 && Math.random() < forkChance) {
          branch(x, y, angle + side * (0.7 + Math.random() * 0.6), from, Math.max(2, Math.round((steps - i) * 0.8)), depth + 1);
          side = -side;
        }
      }
    };
    branch(0, 0, up, 0, 5 + Math.floor(Math.random() * 3), 0);
    return twig;
  }

  private randomPoint(): Point {
    return {
      x: this.margin + Math.random() * Math.max(0, this.width - this.margin * 2),
      y: this.margin + Math.random() * Math.max(0, this.height - this.margin * 2),
    };
  }
}

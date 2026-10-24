import { PlantField } from './Plants';

describe('PlantField', () => {
  let field: PlantField;

  beforeEach(() => {
    field = new PlantField();
    field.initialize(800, 600);
    field.plants = [];
  });

  it('should start with a few algae, the meadows grow from their seeds', () => {
    const fresh = new PlantField();
    fresh.initialize(800, 600);
    expect(fresh.maxPlants).toBe(19);
    expect(fresh.plants.length).toBeGreaterThanOrEqual(2);
    expect(fresh.plants.length).toBeLessThanOrEqual(fresh.startingPlants);
  });

  it('should grow like a small tree: a trunk up toward the light, branches spreading wide, some drooping', () => {
    const trees = [];
    for (let i = 0; i < 100; i++) {
      field.plants = [];
      trees.push(field.add({ x: 400, y: 300 })!);
    }
    const segments = trees.flatMap(tree => tree.twig);
    const trunk = segments.filter(segment => segment.depth === 0);
    const branches = segments.filter(segment => segment.depth > 0);
    expect(trunk.every(segment => segment.y2 < segment.y1)).toBe(true);
    expect(trees.every(tree => tree.twig.filter(segment => segment.depth === 0).length >= 5)).toBe(true);
    expect(trees.filter(tree => tree.twig.some(segment => segment.depth > 0)).length).toBeGreaterThan(80);
    expect(branches.some(segment => segment.y2 > segment.y1)).toBe(true);
    // No branch hangs straight down
    expect(segments.every(segment => Math.abs(segment.x2 - segment.x1) > 0.1 || segment.y2 < segment.y1)).toBe(true);
  });

  it('should show its branches as the alga grows, then keep getting bigger', () => {
    const plant = field.add({ x: 400, y: 300 })!;
    const young = { reach: field.reach(plant), scale: field.scale(plant) };
    plant.biomass = field.maxBiomass / 2;
    expect(field.reach(plant)).toBeGreaterThan(young.reach);
    expect(field.reach(plant)).toBeCloseTo(plant.length);
    const half = field.scale(plant);
    plant.biomass = field.maxBiomass;
    expect(half).toBeGreaterThan(young.scale);
    expect(field.scale(plant)).toBeGreaterThan(half);
  });

  it('should grow in summer, and wither in winter until it is gone', () => {
    const plant = field.add({ x: 400, y: 300 })!;
    field.update(3600, 1);
    expect(plant.biomass).toBeGreaterThan(2);
    for (let minute = 0; minute < 10; minute++) {
      field.update(3600, 0.2);
    }
    expect(field.plants).not.toContain(plant);
  });

  it('should sow seeds around a grown plant in summer, never too close to another one', () => {
    field.add({ x: 400, y: 300 })!.biomass = field.maxBiomass;
    for (let i = 0; i < 600; i++) {
      field.update(60, 1);
    }
    expect(field.plants.length).toBeGreaterThan(1);
    for (const plant of field.plants) {
      const neighbors = field.plants.filter(other => other !== plant && Math.hypot(other.x - plant.x, other.y - plant.y) < field.spacing);
      expect(neighbors).toEqual([]);
    }
  });

  it('should let new plants sprout in a good season when only a few are left', () => {
    for (let i = 0; i < 100; i++) {
      field.update(60, 1);
    }
    expect(field.plants.length).toBeGreaterThan(0);
  });

  it('should be nibbled down to its roots, erased, and kept away from the borders', () => {
    const plant = field.add({ x: 400, y: 300 })!;
    expect(field.eat(plant, 10)).toBeCloseTo(field.sproutBiomass - field.rootBiomass);
    expect(plant.biomass).toBeCloseTo(field.rootBiomass);
    expect(field.eat(plant, 10)).toBe(0);
    field.update(600, 1);
    expect(field.plants).toContain(plant);
    expect(field.add({ x: 10, y: 300 })).toBeNull();
    field.add({ x: 200, y: 200 });
    field.erase({ x: 200, y: 200 }, 20);
    expect(field.closest({ x: 200, y: 200 }, 50)).toBeNull();
  });
});

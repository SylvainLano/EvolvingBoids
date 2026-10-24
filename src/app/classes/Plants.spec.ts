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

  it('should grow like a small tree, up toward the light, with branches now and then', () => {
    const trees = [];
    for (let i = 0; i < 10; i++) {
      trees.push(field.add({ x: 100 + i * 60, y: 300 })!);
    }
    for (const tree of trees) {
      expect(tree.twig.filter(segment => segment.depth === 0).length).toBeGreaterThanOrEqual(6);
      expect(tree.twig.every(segment => segment.y2 < segment.y1)).toBe(true);
    }
    expect(trees.some(tree => tree.twig.some(segment => segment.depth > 0))).toBe(true);
  });

  it('should get taller as the alga grows', () => {
    const plant = field.add({ x: 400, y: 300 })!;
    const young = field.reach(plant);
    plant.biomass = field.maxBiomass;
    expect(field.reach(plant)).toBeGreaterThan(young);
    expect(field.reach(plant)).toBeCloseTo(plant.length);
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

  it('should be nibbled, erased, and kept away from the borders', () => {
    const plant = field.add({ x: 400, y: 300 })!;
    expect(field.eat(plant, 10)).toBe(field.sproutBiomass);
    expect(plant.biomass).toBe(0);
    expect(field.add({ x: 10, y: 300 })).toBeNull();
    field.add({ x: 200, y: 200 });
    field.erase({ x: 200, y: 200 }, 20);
    expect(field.closest({ x: 200, y: 200 }, 50)).toBeNull();
  });
});

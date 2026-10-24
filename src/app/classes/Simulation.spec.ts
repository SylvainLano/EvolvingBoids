import { Simulation } from './Simulation';
import type { Boid } from './Boid';

// A world without anybody, nor reinforcements, to place the boids by hand
function emptySimulation(): Simulation {
  const sim = new Simulation();
  sim.numberOfBoids = 0;
  sim.numberOfPredators = 0;
  sim.simulationMode = 'Continued';
  sim.initialize(800, 600);
  return sim;
}

function addBoid(sim: Simulation, x: number, y: number, vx = 0, vy = 0, isPredator = false): Boid {
  return sim.insertNewBoid({ x, y }, { x: vx, y: vy }, isPredator, sim.createGenome(isPredator), 0)!;
}

function steps(sim: Simulation, count: number) {
  for (let i = 0; i < count; i++) {
    sim.step();
  }
}

describe('Simulation', () => {
  it('should start with its populations inside the screen', () => {
    const sim = new Simulation();
    sim.initialize(800, 600);
    expect(sim.boids.length).toBe(sim.numberOfBoids);
    expect(sim.predators.length).toBe(sim.numberOfPredators);
    for (const boid of [...sim.boids, ...sim.predators]) {
      expect(boid.position.x).toBeGreaterThanOrEqual(0);
      expect(boid.position.x).toBeLessThan(800);
    }
  });

  it('should create the initial population even when the FPS is too low, but not the boids added later', () => {
    const sim = new Simulation();
    sim.fps = 5;
    sim.initialize(800, 600);
    expect(sim.boids.length).toBe(sim.numberOfBoids);
    expect(sim.insertNewBoid({ x: 10, y: 10 }, { x: 0, y: 0 }, false, sim.createGenome(false), 0)).toBeNull();
  });

  it('should keep every boid finite, inside the screen and in the Quadtree', () => {
    const sim = new Simulation();
    sim.initialize(800, 600);
    steps(sim, 1200);
    const all = [...sim.boids, ...sim.predators];
    for (const boid of all) {
      expect(Number.isFinite(boid.position.x) && Number.isFinite(boid.velocity.x)).toBe(true);
      expect(boid.position.x >= 0 && boid.position.x < 800 && boid.position.y >= 0 && boid.position.y < 600).toBe(true);
    }
    const inQuadtree = sim.quadtree.retrieveFinalQuadtrees().reduce((sum, leaf) => sum + leaf.entities.length, 0);
    expect(inQuadtree).toBe(all.length);
  });

  it('should not produce NaN when two boids are at the very same place', () => {
    const sim = emptySimulation();
    const first = addBoid(sim, 300, 300, 1, 0);
    const second = addBoid(sim, 300, 300, 1, 0);
    steps(sim, 10);
    expect(Number.isFinite(first.velocity.x) && Number.isFinite(second.velocity.x)).toBe(true);
  });

  it('should never let a boid or a predator cross an obstacle', () => {
    const sim = emptySimulation();
    sim.foodEnabled = false;
    sim.obstacles.add(Array.from({ length: 51 }, (_, i) => ({ x: 400, y: i * 12 })));
    const boids = Array.from({ length: 20 }, (_, i) => addBoid(sim, 350, 50 + i * 25, 2, 0));
    const predator = addBoid(sim, 300, 300, 2.5, 0, true);
    addBoid(sim, 450, 300); // a prey behind the wall
    steps(sim, 600);
    for (const boid of [...boids, predator]) {
      expect(boid.position.x).toBeLessThan(400);
    }
  });

  it('should let a predator chase a visible prey rather than a closer one behind a wall', () => {
    const sim = emptySimulation();
    sim.foodEnabled = false;
    sim.obstacles.add(Array.from({ length: 51 }, (_, i) => ({ x: 400, y: i * 12 })));
    const predator = addBoid(sim, 380, 300, 0, 0, true);
    addBoid(sim, 420, 300);                 // closer, but behind the wall
    const visible = addBoid(sim, 250, 300); // farther, on the same side
    sim.step();
    expect(predator.preyLink).toBe(visible);
  });

  it('should only let a predator breed when there are enough boids for each predator', () => {
    const breeds = (boids: number) => {
      const sim = emptySimulation();
      sim.foodEnabled = false;
      sim.predatorReproductionChances = 100;
      const predator = addBoid(sim, 300, 300, 0, 0, true);
      addBoid(sim, 302, 300);
      for (let i = 1; i < boids; i++) {
        addBoid(sim, 700, 50 + (i % 25) * 20);
      }
      sim.step();
      return sim.predators.filter(p => p !== predator).length;
    };
    expect(breeds(10)).toBe(0);
    expect(breeds(30)).toBe(1);
  });

  it('should add a fertile area in summer', () => {
    const sim = emptySimulation();
    const at = (yearProgress: number) => {
      sim.elapsedSteps = Math.round((yearProgress - sim.yearStart) * sim.yearDuration * 60 * sim.stepsPerSecond);
      steps(sim, sim.foodUpdateInterval);
      return sim.food.patchCount;
    };
    expect(at(0.4)).toBe(sim.fertileAreas + sim.summerAreas);
    expect(at(0.9)).toBe(sim.fertileAreas);
  });

  it('should let a hungry boid nibble an alga', () => {
    const sim = emptySimulation();
    sim.food.erase({ x: 300, y: 300 }, 200);
    sim.plants.plants = [];
    const plant = sim.plants.add({ x: 300, y: 300 })!;
    const boid = addBoid(sim, 300, 300);
    boid.energy = 0.5;
    sim.step();
    expect(boid.energy).toBeGreaterThan(0.5);
    expect(plant.biomass).toBeLessThan(sim.plants.sproutBiomass);
  });

  it('should let a predator give up a chase that makes no progress, and chase another prey', () => {
    const sim = emptySimulation();
    sim.foodEnabled = false;
    const events: string[] = [];
    sim.onEvent = (event) => events.push(event.type);
    const predator = addBoid(sim, 300, 300, 0, 0, true);
    const tiresome = addBoid(sim, 340, 300);
    const other = addBoid(sim, 300, 420);
    // A chase going on for a while without getting closer than 20 px
    predator.chased = tiresome;
    predator.closestApproach = 20;
    predator.staleSteps = sim.chasePatience * sim.stepsPerSecond;
    sim.step();
    expect(events).toContain('gaveUp');
    expect(predator.ignoredPrey).toBe(tiresome);
    sim.step();
    expect(predator.chased).toBe(other);
  });

  it('should keep on chasing as long as the predator gains ground', () => {
    const sim = emptySimulation();
    sim.foodEnabled = false;
    const predator = addBoid(sim, 300, 300, 0, 0, true);
    const prey = addBoid(sim, 340, 300);
    predator.chased = prey;
    predator.closestApproach = 100;
    predator.staleSteps = sim.chasePatience * sim.stepsPerSecond;
    sim.step();
    expect(predator.ignoredPrey).toBeNull();
    expect(predator.staleSteps).toBe(0);
  });

  it('should carry the boids along a current', () => {
    const sim = emptySimulation();
    sim.foodEnabled = false;
    sim.currents.add([{ x: 100, y: 300 }, { x: 700, y: 300 }]);
    const boid = addBoid(sim, 200, 300);
    steps(sim, 30);
    expect(boid.position.x).toBeGreaterThan(220);
  });

  it('should give the reinforcements of an extinct species the genes of its last dead', () => {
    const sim = emptySimulation();
    const dead = addBoid(sim, 100, 100);
    dead.genome = { maxVelocity: 2.6, reproductionRate: 250, vision: 1.2, lineage: 0.5 };
    dead.generation = 7;
    sim.rememberGenes(dead);
    sim.boids = [];
    const heritages = sim.inheritGenes(false, 10);
    for (const heritage of heritages) {
      expect(heritage.generation).toBe(7);
      expect(heritage.genome).toEqual({ maxVelocity: 2.6, reproductionRate: 250, vision: 1.2, lineage: 0.5 });
      expect(heritage.genome).not.toBe(dead.genome);
    }
  });

  it('should send reinforcements in Infinite mode when only a few boids are left', () => {
    const sim = emptySimulation();
    sim.simulationMode = 'Infinite';
    for (let i = 0; i < 5; i++) {
      addBoid(sim, 100 + i * 50, 300);
    }
    addBoid(sim, 400, 400, 0, 0, true);
    sim.step();
    expect(sim.boids.length).toBeGreaterThanOrEqual(sim.infiniteMinBoids);
  });

  it('should let a Super Predator fade away after its lifetime, without counting it as a predator', () => {
    const sim = emptySimulation();
    addBoid(sim, 100, 100, 0, 0, true);
    const superPredator = sim.addSuperPredator({ x: 400, y: 300 })!;
    sim.step();
    expect(sim.totalPredators).toBe(1);
    steps(sim, sim.superPredatorLifetime * sim.stepsPerSecond);
    expect(superPredator.isDead).toBe(true);
  });

  it('should need energy to nest, only with plankton', () => {
    const sim = emptySimulation();
    const boid = addBoid(sim, 100, 100);
    boid.reproductionCooldown = 0;
    boid.predationCounter = 1e6;
    boid.energy = 0.5;
    expect(sim.isReadyToNest(boid)).toBe(false);
    boid.energy = 0.9;
    expect(sim.isReadyToNest(boid)).toBe(true);
    sim.foodEnabled = false;
    boid.energy = 0;
    expect(sim.isReadyToNest(boid)).toBe(true);
  });

  it('should starve a boid without energy', () => {
    const sim = emptySimulation();
    const boid = addBoid(sim, 100, 100, 2, 0);
    sim.food.erase({ x: 100, y: 100 }, 300);
    boid.energy = 0.0001;
    sim.step();
    expect(boid.isDead).toBe(true);
  });

  it('should give a child the next generation, and genes within the evolution cap', () => {
    const sim = emptySimulation();
    sim.boidEvolutionChances = 100;
    const parent = addBoid(sim, 100, 100);
    const partner = addBoid(sim, 110, 100);
    parent.generation = 3;
    partner.generation = 5;
    for (let i = 0; i < 50; i++) {
      const child = sim.giveBirth(parent, partner)!;
      expect(child.generation).toBe(6);
      expect(child.isMutant).toBe(true);
      expect(child.genome.maxVelocity).toBeLessThanOrEqual(sim.boidMaxVelocity * (1 + sim.boidEvolutionCap / 100));
      expect(child.genome.maxVelocity).toBeGreaterThanOrEqual(sim.boidMaxVelocity * (1 - sim.boidEvolutionCap / 100));
    }
  });

  it('should pass the family color on unchanged, and shift it only with a mutation', () => {
    const sim = emptySimulation();
    const parent = addBoid(sim, 100, 100);
    const partner = addBoid(sim, 110, 100);
    parent.genome.lineage = partner.genome.lineage = 0.3;
    sim.boidEvolutionChances = 0;
    for (let i = 0; i < 20; i++) {
      expect(sim.giveBirth(parent, partner)!.genome.lineage).toBe(0.3);
    }
    sim.boidEvolutionChances = 100;
    for (let i = 0; i < 20; i++) {
      expect(Math.abs(sim.giveBirth(parent, partner)!.genome.lineage - 0.3)).toBeCloseTo(sim.lineageStep);
    }
  });

  it('should let a boid see a predator as far as its vision', () => {
    const fleeing = (vision: number) => {
      const sim = emptySimulation();
      sim.foodEnabled = false;
      const boid = addBoid(sim, 300, 300);
      boid.genome.vision = vision;
      const predator = addBoid(sim, 380, 300, 0, 0, true);
      predator.reproductionCooldown = 1000;
      sim.step();
      return boid.velocity.x;
    };
    expect(fleeing(1.5)).toBeLessThan(0);
    expect(fleeing(1)).toBe(0);
  });

  it('should make good eyes cost energy', () => {
    const spent = (vision: number) => {
      const sim = emptySimulation();
      const boid = addBoid(sim, 300, 300);
      sim.food.erase({ x: 300, y: 300 }, 200);
      boid.genome.vision = vision;
      boid.energy = 0.5;
      sim.step();
      return 0.5 - boid.energy;
    };
    expect(spent(1.5)).toBeGreaterThan(spent(1));
    expect(spent(0.5)).toBeLessThan(spent(1));
  });

  it('should make the slow boids bigger and more enduring, the fast ones smaller', () => {
    const sim = emptySimulation();
    const born = (speed: number) => sim.insertNewBoid({ x: 100, y: 100 }, { x: 0, y: 0 }, false,
      { ...sim.createGenome(false), maxVelocity: sim.boidMaxVelocity * speed }, 0)!;
    const slow = born(0.9);
    const fast = born(1.1);
    expect(slow.size).toBeCloseTo(1.15);
    expect(fast.size).toBeCloseTo(0.85);
    expect(sim.endurance(slow)).toBeGreaterThan(1);
    expect(sim.endurance(fast)).toBeLessThan(1);
  });

  it('should follow the seasons: the plankton at its best in summer, scarce in winter', () => {
    const sim = emptySimulation();
    const at = (yearProgress: number) => {
      sim.elapsedSteps = Math.round((yearProgress - sim.yearStart) * sim.yearDuration * 60 * sim.stepsPerSecond);
      return { season: sim.season.name, productivity: sim.productivity };
    };
    expect(at(0.375)).toEqual({ season: 'Summer', productivity: 1 });
    expect(at(0.875).season).toBe('Winter');
    expect(at(0.875).productivity).toBeCloseTo(sim.winterFood / 100);
    expect(at(1.6).season).toBe('Autumn');
    expect(sim.season.year).toBe(2);
    sim.seasonsEnabled = false;
    expect(sim.productivity).toBe(1);
  });

  it('should tell the display about the births, the mutants, the captures and the causes of death', () => {
    const sim = emptySimulation();
    const events: string[] = [];
    sim.onEvent = (event) => events.push(event.type);
    sim.boidEvolutionChances = 100;
    const parent = addBoid(sim, 100, 100);
    sim.giveBirth(parent, addBoid(sim, 110, 100));
    expect(events).toEqual(['birth', 'mutant']);

    events.length = 0;
    const old = addBoid(sim, 300, 300);
    old.age = 1e9;
    sim.step();
    expect(events).toContain('oldAge');

    events.length = 0;
    sim.erase({ x: 100, y: 100 }, 30);
    expect(events).toContain('erased');
  });

  it('should take an eaten boid out of the simulation for good, the Quadtree included', () => {
    const sim = emptySimulation();
    sim.foodEnabled = false;
    addBoid(sim, 300, 300, 0, 0, true);
    const prey = addBoid(sim, 302, 300, 3, 0);
    sim.step();
    sim.step();
    expect(prey.isDead).toBe(true);
    expect(sim.boids).not.toContain(prey);
    const inQuadtree = sim.quadtree.retrieveFinalQuadtrees().flatMap(leaf => leaf.entities);
    expect(inQuadtree).not.toContain(prey);
  });

  it('should tell which predator caught which prey', () => {
    const sim = emptySimulation();
    sim.foodEnabled = false;
    const captures: { hunter: Boid, prey?: Boid }[] = [];
    sim.onEvent = (event) => {
      if (event.type === 'caught') {
        captures.push({ hunter: event.boid, prey: event.other });
      }
    };
    const predator = addBoid(sim, 300, 300, 0, 0, true);
    const prey = addBoid(sim, 302, 300);
    sim.step();
    expect(captures).toEqual([{ hunter: predator, prey }]);
  });

  it('should erase the boids within the radius only', () => {
    const sim = emptySimulation();
    const near = addBoid(sim, 100, 100);
    const far = addBoid(sim, 300, 300);
    sim.erase({ x: 105, y: 100 }, 30);
    expect(near.isDead).toBe(true);
    expect(far.isDead).toBe(false);
  });

  it('should start over when it gets its first size, and scale the positions on the next resizes', () => {
    const sim = new Simulation();
    sim.initialize(0, 0);
    sim.resize(800, 600);
    expect(sim.boids.length).toBe(sim.numberOfBoids);
    const boid = sim.boids[0];
    const before = { ...boid.position };
    sim.resize(1600, 1200);
    expect(boid.position.x).toBeCloseTo(Math.min(1599, before.x * 2));
    expect(boid.position.y).toBeCloseTo(Math.min(1199, before.y * 2));
  });
});

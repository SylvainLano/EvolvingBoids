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
      expect(Number.isFinite(boid.position.x) && Number.isFinite(boid.velocity.x)).toBeTrue();
      expect(boid.position.x >= 0 && boid.position.x < 800 && boid.position.y >= 0 && boid.position.y < 600).toBeTrue();
    }
    const inQuadtree = sim.quadtree.retrieveFinalQuadtrees().reduce((sum, leaf) => sum + leaf.entities.length, 0);
    expect(inQuadtree).toBe(all.length);
  });

  it('should not produce NaN when two boids are at the very same place', () => {
    const sim = emptySimulation();
    const first = addBoid(sim, 300, 300, 1, 0);
    const second = addBoid(sim, 300, 300, 1, 0);
    steps(sim, 10);
    expect(Number.isFinite(first.velocity.x) && Number.isFinite(second.velocity.x)).toBeTrue();
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
    dead.genome = { maxVelocity: 2.6, reproductionRate: 250 };
    dead.generation = 7;
    sim.rememberGenes(dead);
    sim.boids = [];
    const heritages = sim.inheritGenes(false, 10);
    for (const heritage of heritages) {
      expect(heritage.generation).toBe(7);
      expect(heritage.genome).toEqual({ maxVelocity: 2.6, reproductionRate: 250 });
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
    expect(superPredator.isDead).toBeTrue();
  });

  it('should need energy to nest, only with plankton', () => {
    const sim = emptySimulation();
    const boid = addBoid(sim, 100, 100);
    boid.reproductionCooldown = 0;
    boid.predationCounter = 1e6;
    boid.energy = 0.5;
    expect(sim.isReadyToNest(boid)).toBeFalse();
    boid.energy = 0.9;
    expect(sim.isReadyToNest(boid)).toBeTrue();
    sim.foodEnabled = false;
    boid.energy = 0;
    expect(sim.isReadyToNest(boid)).toBeTrue();
  });

  it('should starve a boid without energy', () => {
    const sim = emptySimulation();
    const boid = addBoid(sim, 100, 100, 2, 0);
    sim.food.erase({ x: 100, y: 100 }, 300);
    boid.energy = 0.0001;
    sim.step();
    expect(boid.isDead).toBeTrue();
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
      expect(child.isMutant).toBeTrue();
      expect(child.genome.maxVelocity).toBeLessThanOrEqual(sim.boidMaxVelocity * (1 + sim.boidEvolutionCap / 100));
      expect(child.genome.maxVelocity).toBeGreaterThanOrEqual(sim.boidMaxVelocity * (1 - sim.boidEvolutionCap / 100));
    }
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
    expect(near.isDead).toBeTrue();
    expect(far.isDead).toBeFalse();
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

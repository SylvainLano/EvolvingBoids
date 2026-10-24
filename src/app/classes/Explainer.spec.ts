import { Explainer, ExplanationArea, isArea, isGroup, subject } from './Explainer';
import { Simulation } from './Simulation';
import type { Boid } from './Boid';

describe('Explainer', () => {
  let sim: Simulation;
  let explainer: Explainer;

  function boid(x = 100, y = 100, isPredator = false): Boid {
    return sim.insertNewBoid({ x, y }, { x: 1, y: 0 }, isPredator, sim.createGenome(isPredator), 0)!;
  }

  // The moment the current bubble ends
  const end = () => explainer.current!.start + explainer.current!.duration;

  beforeEach(() => {
    sim = new Simulation();
    sim.numberOfBoids = 0;
    sim.numberOfPredators = 0;
    sim.foodEnabled = false;
    sim.initialize(800, 600);
    explainer = new Explainer();
  });

  it('should leave time to read calmly, the longer the text the longer', () => {
    expect(Explainer.readingTime('Short.')).toBe(9000);
    expect(Explainer.readingTime('x'.repeat(150))).toBeGreaterThan(Explainer.readingTime('x'.repeat(100)));
    expect(Explainer.readingTime('x'.repeat(1000))).toBe(18000);
  });

  it('should explain nothing while disabled', () => {
    explainer.notify({ type: 'birth', boid: boid() }, 10000);
    expect(explainer.current).toBeNull();
  });

  it('should explain an event, one bubble at a time', () => {
    explainer.setEnabled(true, 10000);
    const child = boid();
    explainer.notify({ type: 'birth', boid: child }, 10000);
    expect(explainer.current?.id).toBe('birth');
    expect(explainer.current?.anchor).toBe(child);
    explainer.notify({ type: 'oldAge', boid: boid() }, 11000);
    expect(explainer.current?.id).toBe('birth');
  });

  it('should end a bubble, wait a while, then explain the next event', () => {
    explainer.setEnabled(true, 10000);
    explainer.notify({ type: 'birth', boid: boid() }, 10000);
    const ended = end();
    explainer.update(sim, ended, false);
    expect(explainer.current).toBeNull();
    explainer.notify({ type: 'oldAge', boid: boid() }, ended + 1000);
    expect(explainer.current).toBeNull();
    explainer.notify({ type: 'oldAge', boid: boid() }, ended + explainer.gap);
    expect(explainer.current?.id).toBe('oldAge');
  });

  it('should show the next bubble right away when the user asks for it', () => {
    explainer.setEnabled(true, 10000);
    explainer.notify({ type: 'birth', boid: boid() }, 10000);
    explainer.next(12000);
    expect(explainer.current).toBeNull();
    explainer.notify({ type: 'oldAge', boid: boid() }, 12000 + explainer.skipGap);
    expect(explainer.current?.id).toBe('oldAge');
  });

  it('should not repeat an explanation too soon, and leave more time after a repeat', () => {
    explainer.setEnabled(true, 10000);
    explainer.notify({ type: 'birth', boid: boid() }, 10000);
    const firstEnd = end();
    explainer.update(sim, firstEnd, false);
    explainer.notify({ type: 'birth', boid: boid() }, firstEnd + explainer.gap);
    expect(explainer.current).toBeNull();
    const repeat = 10000 + explainer.repeatDelay;
    explainer.notify({ type: 'birth', boid: boid() }, repeat);
    expect(explainer.current?.id).toBe('birth');
    const ended = end();
    explainer.update(sim, ended, false);
    explainer.notify({ type: 'oldAge', boid: boid() }, ended + explainer.gap);
    expect(explainer.current).toBeNull();
    explainer.notify({ type: 'oldAge', boid: boid() }, ended + explainer.repeatGap);
    expect(explainer.current?.id).toBe('oldAge');
  });

  it('should mark the round generations, and ignore the births of predators', () => {
    explainer.setEnabled(true, 10000);
    explainer.notify({ type: 'birth', boid: boid(100, 100, true) }, 10000);
    expect(explainer.current).toBeNull();
    const child = boid();
    child.generation = 20;
    explainer.notify({ type: 'birth', boid: child }, 10000);
    expect(explainer.current?.id).toBe('generation');
    expect(explainer.current?.text).toContain('Generation 20');
  });

  it('should explain the arrival of winter next to the season in the counters, or around the plankton without them', () => {
    sim.foodEnabled = true;
    sim.elapsedSteps = Math.round((0.76 - sim.yearStart) * sim.yearDuration * 60 * sim.stepsPerSecond);
    explainer.setEnabled(true, 10000, sim, false, true);
    expect(explainer.current?.id).toBe('winter');
    expect(explainer.current?.anchor).toBe('season');

    sim.food.food.fill(0);
    sim.food.food[15 * sim.food.cols + 20] = 0.9;
    explainer = new Explainer();
    explainer.setEnabled(true, 10000, sim);
    expect(explainer.current?.id).toBe('winter');
    expect(isArea(explainer.current!.anchor)).toBe(true);
  });

  it('should tell how a mutant differs from its parent', () => {
    explainer.setEnabled(true, 10000);
    const parent = boid();
    const child = boid();
    child.genome = { ...parent.genome, maxVelocity: parent.genome.maxVelocity * 1.05 };
    explainer.notify({ type: 'mutant', boid: child, other: parent }, 10000);
    expect(explainer.current?.text).toContain('faster');
  });

  it('should first explain how a flock works, around the flock, and follow it as it swims', () => {
    const flock = [];
    for (let i = 0; i < 6; i++) {
      flock.push(boid(300 + i * 5, 300));
    }
    explainer.setEnabled(true, 10000, sim);
    expect(explainer.current?.id).toBe('flocking');
    const anchor = explainer.current!.anchor;
    expect(isGroup(anchor)).toBe(true);
    expect((subject(anchor) as ExplanationArea).center.x).toBeCloseTo(312.5);
    flock.forEach(member => member.position = { x: member.position.x + 200, y: 300 });
    expect((subject(anchor) as ExplanationArea).center.x).toBeCloseTo(512.5);
  });

  it('should end the bubble soon when its boid is gone, and tell the capture of a chased boid right away', () => {
    explainer.setEnabled(true, 10000);
    const prey = boid();
    explainer.notify({ type: 'birth', boid: prey }, 10000);
    const hunter = boid(120, 100, true);
    explainer.notify({ type: 'caught', boid: hunter, other: prey }, 11000);
    expect(explainer.current?.id).toBe('caught');
    expect(explainer.current?.anchor).toBe(hunter);

    hunter.isDead = true;
    hunter.alpha = 0;
    explainer.update(sim, 12000, false);
    expect(explainer.current).not.toBeNull();
    explainer.update(sim, 11000 + 2 * explainer.lostSubject, false);
    expect(explainer.current).toBeNull();
  });

  it('should explain an event that happened during another bubble, if its boid is still there', () => {
    explainer.setEnabled(true, 10000);
    explainer.notify({ type: 'birth', boid: boid() }, 10000);
    const mutant = boid(200, 200);
    explainer.notify({ type: 'mutant', boid: mutant, other: boid() }, 10500);
    expect(explainer.current?.id).toBe('birth');
    explainer.next(11000);
    explainer.update(sim, 11000 + explainer.skipGap, false);
    expect(explainer.current?.id).toBe('mutant');
    expect(explainer.current?.anchor).toBe(mutant);
  });

  it('should point at the plankton itself, not at a boid, away from the borders', () => {
    sim.foodEnabled = true;
    sim.food.food.fill(0);
    sim.food.food[0] = 1;                         // in the corner
    sim.food.food[15 * sim.food.cols + 20] = 0.9; // in the middle
    boid(50, 50);
    explainer.setEnabled(true, 10000, sim);
    expect(explainer.current?.id).toBe('grazing');
    const anchor = explainer.current!.anchor;
    expect(isArea(anchor) && anchor.center.x === 410 && anchor.center.y === 310).toBe(true);
  });

  it('should hide the bubble when disabled', () => {
    explainer.setEnabled(true, 10000);
    explainer.notify({ type: 'birth', boid: boid() }, 10000);
    explainer.setEnabled(false, 10100);
    expect(explainer.current).toBeNull();
  });
});

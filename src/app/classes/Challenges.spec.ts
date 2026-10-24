import { ChallengeRunner, CHALLENGES, clock } from './Challenges';
import { Simulation } from './Simulation';

describe('Challenges', () => {
  const storageKey = 'evolvingboids.challenges';
  let sim: Simulation;
  let runner: ChallengeRunner;
  const challenge = (id: string) => CHALLENGES.find(c => c.id === id)!;

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    sim = new Simulation();
    sim.initialize(800, 600);
    runner = new ChallengeRunner(sim, () => sim.initialize(800, 600));
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it('should format a duration as minutes and seconds', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(75.4)).toBe('1:15');
  });

  it('should start from its own settings, a new population and nothing drawn, then restore the settings', () => {
    sim.obstacles.add([{ x: 10, y: 10 }, { x: 100, y: 10 }]);
    const coexistence = challenge('coexistence');
    runner.start(coexistence);
    expect(sim.numberOfPredators).toBe(6);
    expect(sim.predators.length).toBe(6);
    expect(sim.simulationMode).toBe('Continued');
    expect(sim.obstacles.isEmpty).toBe(true);
    runner.close();
    expect(sim.numberOfPredators).toBe(3);
    expect(sim.simulationMode).toBe('Infinite');
    expect(runner.active).toBeNull();
  });

  it('should only allow the tools of the challenge', () => {
    expect(runner.isAllowed('boid')).toBe(true);
    runner.start(challenge('fortress'));
    expect(runner.isAllowed('obstacle')).toBe(true);
    expect(runner.isAllowed('boid')).toBe(false);
    expect(runner.isAllowed('eraser')).toBe(false);
  });

  it('should count the uses of a tool with a budget', () => {
    runner.start(challenge('coexistence'));
    expect(runner.budgetText).toBe('3 predators left');
    expect(runner.use('predator')).toBe(true);
    expect(runner.use('predator')).toBe(true);
    expect(runner.use('predator')).toBe(true);
    expect(runner.use('predator')).toBe(false);
    expect(runner.isAllowed('predator')).toBe(false);
    expect(runner.use('eraser')).toBe(true);
    runner.retry();
    expect(runner.isAllowed('predator')).toBe(true);
  });

  it('should be lost, and pause the simulation, when a species is extinct', () => {
    runner.start(challenge('coexistence'));
    for (const predator of sim.predators) {
      predator.isDead = true;
    }
    runner.update();
    expect(runner.state).toBe('lost');
    expect(sim.pauseSimulation).toBe(true);
  });

  it('should be won after holding on, and remember it', () => {
    runner.start(challenge('lone-hunter'));
    sim.elapsedSteps = 240 * sim.stepsPerSecond;
    runner.update();
    expect(runner.state).toBe('won');
    expect(runner.results['lone-hunter']).toBe(240);
    expect(JSON.parse(localStorage.getItem(storageKey)!)['lone-hunter']).toBe(240);
    expect(new ChallengeRunner(sim, () => {}).results['lone-hunter']).toBe(240);
  });

  it('should send a Super Predator every 15 seconds in the Fortress', () => {
    runner.start(challenge('fortress'));
    const supers = () => sim.predators.filter(predator => predator.isSuper).length;
    sim.elapsedSteps = 4 * sim.stepsPerSecond;
    runner.update();
    expect(supers()).toBe(0);
    sim.elapsedSteps = 5 * sim.stepsPerSecond;
    runner.update();
    expect(supers()).toBe(1);
    sim.elapsedSteps = 36 * sim.stepsPerSecond;
    runner.update();
    expect(supers()).toBe(3);
  });

  it('should start again from scratch on retry', () => {
    runner.start(challenge('coexistence'));
    sim.elapsedSteps = 1000;
    for (const predator of sim.predators) {
      predator.isDead = true;
    }
    runner.update();
    runner.retry();
    expect(runner.state).toBe('running');
    expect(sim.elapsedSteps).toBe(0);
    expect(sim.pauseSimulation).toBe(false);
    expect(sim.predators.length).toBe(6);
  });

  it('should win Three Winters when the fourth year begins with enough boids, and lose it with too few', () => {
    runner.start(challenge('three-winters'));
    expect(sim.seasonsEnabled).toBe(true);
    sim.elapsedSteps = Math.round((3.01 - sim.yearStart) * sim.yearDuration * 60 * sim.stepsPerSecond);
    runner.update();
    expect(runner.state).toBe('won');

    runner.retry();
    sim.boids.slice(19).forEach(boid => boid.isDead = true);
    runner.update();
    expect(runner.state).toBe('lost');
  });

  it('should leave the seasons out of the challenges that were balanced without them', () => {
    for (const other of CHALLENGES.filter(c => c.id !== 'three-winters')) {
      expect(other.settings.seasonsEnabled).toBe(false);
    }
  });

  it('should keep the rules every challenge was balanced with, whatever the defaults of the simulation', () => {
    for (const each of CHALLENGES) {
      expect(each.settings.plantsEnabled).toBe(false);
      expect(each.settings.starvationThreshold).toBe(1000);
      expect(each.settings.preyPerPredator).toBe(0);
      expect(each.settings.boidReproductionChances).toBe(30);
    }
  });
});

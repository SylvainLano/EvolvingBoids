// Challenges.ts
import type { Simulation } from './Simulation';
import type { Tool } from './Tool';

export type ChallengeState = 'running' | 'won' | 'lost';

// Simulation settings a challenge starts with, restored when it ends
const SETTINGS = [
  'simulationMode', 'numberOfBoids', 'numberOfPredators', 'predatorReproductionChances', 'predatorStarvationModificator',
  'fertileAreas', 'foodEnabled', 'seasonsEnabled', 'yearDuration', 'winterFood', 'pauseSimulation',
  'plantsEnabled', 'summerAreas', 'starvationThreshold', 'preyPerPredator', 'boidReproductionChances', 'predatorSight', 'foodRegrowthRate',
  'boidFieldOfView', 'predatorFieldOfView', 'deusExMachina', 'agilityGene',
] as const;
type ChallengeSettings = Partial<Pick<Simulation, typeof SETTINGS[number]>>;

export interface Challenge {
  id: string;
  title: string;
  goal: string;                         // what to do, in one line
  hint: string;                         // how it could be done
  settings: ChallengeSettings;
  tools: Tool[];                        // the mouse tools allowed during the challenge
  budget?: Partial<Record<Tool, number>>;   // how many times some of these tools can be used
  // Events of the challenge, with a memory kept from one call to the next
  update?: (sim: Simulation, seconds: number, memory: Record<string, number>) => void;
  evaluate: (sim: Simulation, seconds: number) => ChallengeState;
  progress: (sim: Simulation, seconds: number) => { text: string, ratio: number };
}

export function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// The rules of the simulation the challenges were balanced with: they stay the same when the simulation gets new features
const BALANCED_RULES = {
  plantsEnabled: false, summerAreas: 0, starvationThreshold: 1000, preyPerPredator: 0, boidReproductionChances: 30,
  predatorSight: 0, foodRegrowthRate: 0.0005, boidFieldOfView: 360, predatorFieldOfView: 360, deusExMachina: false,
  agilityGene: false,
} as const;

const livingBoids = (sim: Simulation) => sim.boids.filter(boid => !boid.isDead).length;
const livingPredators = (sim: Simulation) => sim.predators.filter(predator => !predator.isDead && !predator.isSuper).length;
// Average speed of the boids compared to the default, in percent, from the last sample of the statistics
const boidSpeed = (sim: Simulation) => sim.stats.samples.length > 0 ? sim.stats.samples[sim.stats.samples.length - 1].boidSpeed : 0;const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)} %`;

// Survive until the end of the duration, unless the condition fails before
function holdOn(duration: number, failed: (sim: Simulation) => boolean) {
  return (sim: Simulation, seconds: number): ChallengeState => failed(sim) ? 'lost' : seconds >= duration ? 'won' : 'running';
}

// Reach a value before the end of the duration
function reach(duration: number, reached: (sim: Simulation) => boolean) {
  return (sim: Simulation, seconds: number): ChallengeState => reached(sim) ? 'won' : seconds >= duration ? 'lost' : 'running';
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'coexistence',
    title: 'Coexistence',
    goal: 'Keep both species alive for 10 minutes, without any reinforcement.',
    hint: 'The predators boom, eat the flocks, then starve: cull them with the eraser, shelter the boids, and use your 3 predators wisely.',
    settings: {
      ...BALANCED_RULES,
      simulationMode: 'Continued', numberOfBoids: 120, numberOfPredators: 6, predatorReproductionChances: 20, predatorStarvationModificator: 5,
      fertileAreas: 3, foodEnabled: true, seasonsEnabled: false,
    },
    tools: ['predator', 'obstacle', 'current', 'eraser', 'food'],
    budget: { predator: 3 },
    evaluate: holdOn(600, sim => livingBoids(sim) === 0 || livingPredators(sim) === 0),
    progress: (sim, seconds) => ({
      text: `${clock(seconds)} / 10:00 - ${livingBoids(sim)} boids, ${livingPredators(sim)} predators`,
      ratio: seconds / 600,
    }),
  },
  {
    id: 'fortress',
    title: 'Fortress',
    goal: 'A Super Predator arrives every 15 seconds: keep at least 40 boids alive for 3 minutes.',
    hint: 'Super Predators can\'t cross the walls either: build a fortress, and lure them away with the currents.',
    settings: { ...BALANCED_RULES, simulationMode: 'Continued', numberOfBoids: 100, numberOfPredators: 0, fertileAreas: 3, foodEnabled: true, seasonsEnabled: false },
    tools: ['obstacle', 'current', 'food'],
    // A Super Predator enters from a random border at 5 seconds, then every 15 seconds
    update: (sim, seconds, memory) => {
      const due = seconds < 5 ? 0 : Math.floor((seconds - 5) / 15) + 1;
      while ((memory['arrived'] ?? 0) < due) {
        memory['arrived'] = (memory['arrived'] ?? 0) + 1;
        const position = Math.random() < 0.5
          ? { x: Math.random() < 0.5 ? 10 : sim.width - 10, y: Math.random() * sim.height }
          : { x: Math.random() * sim.width, y: Math.random() < 0.5 ? 10 : sim.height - 10 };
        sim.addSuperPredator(position);
      }
    },
    evaluate: holdOn(180, sim => livingBoids(sim) < 40),
    progress: (sim, seconds) => ({
      text: `${clock(seconds)} / 3:00 - ${livingBoids(sim)} boids (40 needed)`,
      ratio: seconds / 180,
    }),
  },
  {
    id: 'lone-hunter',
    title: 'Lone Hunter',
    goal: 'Keep a single predator, that can\'t reproduce, alive for 4 minutes.',
    hint: 'It starves if it doesn\'t eat: bring the flocks to it with the currents, pen them with walls, and drop your 10 boids when it is hungry.',
    settings: {
      ...BALANCED_RULES,
      simulationMode: 'Continued', numberOfBoids: 100, numberOfPredators: 1, predatorReproductionChances: 0, predatorStarvationModificator: 6,
      fertileAreas: 2, foodEnabled: true, seasonsEnabled: false,
    },
    tools: ['boid', 'obstacle', 'current', 'eraser', 'food'],
    budget: { boid: 10 },
    evaluate: holdOn(240, sim => livingPredators(sim) === 0),
    progress: (sim, seconds) => {
      const hunter = sim.predators.find(predator => !predator.isDead && !predator.isSuper);
      const hunger = hunter === undefined ? 'the hunter is dead'
        : hunter.reproductionCooldown > 0 ? 'the hunter is digesting'
        : `hunger ${Math.round(100 * hunter.predationCounter / sim.starvationLimit(hunter))} %`;
      return { text: `${clock(seconds)} / 4:00 - ${hunger}`, ratio: seconds / 240 };
    },
  },
  {
    id: 'arms-race',
    title: 'Arms Race',
    goal: 'Bring the average speed of the boids to +10 % within 20 minutes.',
    hint: 'Only the fast ones escape a strong predation: keep many predators hunting, and speed up the time.',
    settings: { ...BALANCED_RULES, simulationMode: 'Infinite', numberOfBoids: 150, numberOfPredators: 3, predatorReproductionChances: 10, fertileAreas: 3, foodEnabled: true, seasonsEnabled: false },
    tools: ['predator', 'superPredator', 'obstacle', 'current', 'food'],
    evaluate: reach(1200, sim => boidSpeed(sim) >= 10),
    progress: (sim, seconds) => ({
      text: `${clock(seconds)} / 20:00 - speed ${signed(boidSpeed(sim))} (+10 % needed)`,
      ratio: Math.max(0, Math.min(1, boidSpeed(sim) / 10)),
    }),
  },
  {
    id: 'slow-and-steady',
    title: 'Slow and Steady',
    goal: 'Bring the average speed of the boids to -6 % within 20 minutes.',
    hint: 'Natural selection alone is slow here: be a breeder, the size shows the speed, and the eraser removes the smallest ones, the fastest.',
    settings: { ...BALANCED_RULES, simulationMode: 'Continued', numberOfBoids: 150, numberOfPredators: 3, predatorReproductionChances: 10, fertileAreas: 3, foodEnabled: true, seasonsEnabled: false },
    tools: ['eraser', 'obstacle', 'current', 'food'],
    evaluate: (sim, seconds) => livingBoids(sim) === 0 ? 'lost' : reach(1200, s => boidSpeed(s) <= -6)(sim, seconds),
    progress: (sim, seconds) => ({
      text: `${clock(seconds)} / 20:00 - speed ${signed(boidSpeed(sim))} (-6 % needed)`,
      ratio: Math.max(0, Math.min(1, -boidSpeed(sim) / 6)),
    }),
  },
  {
    id: 'three-winters',
    title: 'Three Winters',
    goal: 'Harsh winters are coming: keep at least 20 boids alive until the end of the third winter, without any reinforcement.',
    hint: 'In winter the plankton nearly vanishes: sow food where the flocks are, and keep the predators away from them with walls.',
    settings: {
      ...BALANCED_RULES,
      simulationMode: 'Continued', numberOfBoids: 120, numberOfPredators: 3, predatorReproductionChances: 10, fertileAreas: 2, foodEnabled: true,
      seasonsEnabled: true, yearDuration: 6, winterFood: 5,
    },
    tools: ['food', 'obstacle', 'current'],
    // The challenge starts at the end of a spring, it is won when the fourth year begins
    evaluate: (sim) => livingBoids(sim) < 20 ? 'lost' : sim.season.year > 3 ? 'won' : 'running',
    progress: (sim) => {
      const season = sim.season;
      const years = season.year - 1 + season.progress;
      return {
        text: `Year ${season.year}, ${season.name.toLowerCase()} - ${livingBoids(sim)} boids (20 needed)`,
        ratio: Math.max(0, Math.min(1, (years - sim.yearStart) / (3 - sim.yearStart))),
      };
    },
  },
];

// Runs the challenge chosen by the user, and remembers the challenges already completed
export class ChallengeRunner {
  readonly challenges = CHALLENGES;
  active: Challenge | null = null;
  state: ChallengeState = 'running';
  progress = { text: '', ratio: 0 };
  results: Record<string, number> = {};     // best completion time in simulated seconds, per challenge
  remaining: Partial<Record<Tool, number>> = {};   // uses left for the tools with a budget
  private saved: ChallengeSettings = {};
  private memory: Record<string, number> = {};
  private static readonly storageKey = 'evolvingboids.challenges';

  constructor(private sim: Simulation, private restartSimulation: () => void) {
    this.results = ChallengeRunner.load();
  }

  // A challenge starts from scratch: its own settings, a new population, and nothing drawn
  start(challenge: Challenge) {
    if (this.active !== null) {
      Object.assign(this.sim, this.saved);
    }
    this.saved = Object.fromEntries(SETTINGS.map(key => [key, this.sim[key]])) as ChallengeSettings;
    Object.assign(this.sim, challenge.settings, { pauseSimulation: false });
    this.sim.clearDrawings();
    this.restartSimulation();
    this.active = challenge;
    this.state = 'running';
    this.memory = {};
    this.remaining = { ...challenge.budget };
    this.progress = challenge.progress(this.sim, 0);
  }

  retry() {
    if (this.active !== null) {
      this.start(this.active);
    }
  }

  // Back to the settings of the user, the population of the challenge goes on
  close() {
    if (this.active === null) {
      return;
    }
    Object.assign(this.sim, this.saved);
    this.sim.pauseSimulation = false;
    this.active = null;
  }

  // Called at each frame: the simulation is paused when the challenge is won or lost
  update() {
    const challenge = this.active;
    if (challenge === null || this.state !== 'running') {
      return;
    }
    const seconds = this.sim.elapsedSteps / this.sim.stepsPerSecond;
    challenge.update?.(this.sim, seconds, this.memory);
    this.state = challenge.evaluate(this.sim, seconds);
    this.progress = challenge.progress(this.sim, seconds);
    if (this.state !== 'running') {
      this.sim.pauseSimulation = true;
    }
    if (this.state === 'won' && !(this.results[challenge.id] <= seconds)) {
      this.results[challenge.id] = seconds;
      ChallengeRunner.save(this.results);
    }
  }

  // A tool is allowed by the challenge, and has some uses left if it has a budget
  isAllowed(tool: Tool): boolean {
    return this.active === null || (this.active.tools.includes(tool) && (this.remaining[tool] ?? 1) > 0);
  }

  // Count a use of a tool, returns false when its budget is spent
  use(tool: Tool): boolean {
    if (!this.isAllowed(tool)) {
      return false;
    }
    if (this.active !== null && this.remaining[tool] !== undefined) {
      this.remaining[tool]!--;
    }
    return true;
  }

  // The budgets left, to display them
  get budgetText(): string {
    return Object.entries(this.remaining).map(([tool, count]) => `${count} ${tool}${count === 1 ? '' : 's'} left`).join(', ');
  }

  // The results are kept in the browser, which may refuse it (private browsing...)
  private static load(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(ChallengeRunner.storageKey) ?? '{}');
    } catch {
      return {};
    }
  }

  private static save(results: Record<string, number>) {
    try {
      localStorage.setItem(ChallengeRunner.storageKey, JSON.stringify(results));
    } catch {
      // Not saved, the results are only kept until the page is closed
    }
  }
}

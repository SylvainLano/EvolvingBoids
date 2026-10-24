// Explainer.ts
import type { Boid, Point } from './Boid';
import type { Simulation, SimulationEvent } from './Simulation';
import { SegmentField } from './SegmentField';

// A place on the screen an explanation talks about: some plankton, a wall, a whole flock
export interface ExplanationArea {
  center: Point;
  radius: number;
}

// A bubble explains a boid (an event happened to it), an area of the screen, or the charts
export type ExplanationAnchor = Boid | ExplanationArea | 'charts';

export interface Explanation {
  id: string;
  text: string;
  anchor: ExplanationAnchor;
}

export function isArea(anchor: ExplanationAnchor): anchor is ExplanationArea {
  return anchor !== 'charts' && 'center' in anchor;
}

// The "Explain me" mode: short bubbles about what happens on the screen, when it happens
// Each explanation is shown once, then comes back from time to time, one bubble at a time
export class Explainer {
  enabled = false;
  current: (Explanation & { start: number, duration: number }) | null = null;

  readonly gap = 6000;                // in ms between two bubbles, while there are new things to explain
  readonly repeatGap = 45000;         // in ms after a bubble already seen: the explanations come back now and then
  readonly skipGap = 500;             // in ms before the next bubble, when the user asks for it
  readonly repeatDelay = 180000;      // in ms before the same explanation can come back
  readonly observeInterval = 1000;    // in ms between two looks at the simulation, for the explanations of a situation
  private shownAt: Record<string, number> = {};
  private idleSince = -Infinity;
  private nextGap = this.gap;
  private lastObservation = -Infinity;

  // The time to read a text calmly, in real time so it doesn't depend on the speed of the simulation
  static readingTime(text: string): number {
    return Math.min(18000, Math.max(9000, 5000 + text.length * 70));
  }

  // The first bubble explains the situation on the screen, starting with how a flock works
  setEnabled(enabled: boolean, now: number, sim?: Simulation, chartsVisible = false) {
    this.enabled = enabled;
    this.current = null;
    this.idleSince = now - this.gap;
    this.nextGap = this.gap;
    this.lastObservation = -Infinity;
    if (enabled && sim !== undefined) {
      this.update(sim, now, chartsVisible);
    }
  }

  // The user read the bubble: the next one comes right away
  next(now: number) {
    if (this.current === null) {
      return;
    }
    this.current = null;
    this.idleSince = now;
    this.nextGap = this.skipGap;
    this.lastObservation = -Infinity;
  }

  // An event of the simulation is explained if no other bubble is shown
  notify(event: SimulationEvent, now: number) {
    if (this.isIdle(now)) {
      this.show(this.explainEvent(event), now);
    }
  }

  // Called at each frame: the bubble ends, or a situation of the simulation is explained
  update(sim: Simulation, now: number, chartsVisible: boolean) {
    if (!this.enabled) {
      this.current = null;
      return;
    }
    if (this.current !== null && now - this.current.start >= this.current.duration) {
      this.current = null;
      this.idleSince = now;
    }
    if (this.isIdle(now) && now - this.lastObservation >= this.observeInterval) {
      this.lastObservation = now;
      const candidates = this.observe(sim, chartsVisible);
      // The explanations never shown come first
      const next = candidates.find(c => this.shownAt[c.id] === undefined) ?? candidates.find(c => this.canShow(c.id, now));
      this.show(next ?? null, now);
    }
  }

  private isIdle(now: number): boolean {
    return this.enabled && this.current === null && now - this.idleSince >= this.nextGap;
  }

  private canShow(id: string, now: number): boolean {
    return this.shownAt[id] === undefined || now - this.shownAt[id] >= this.repeatDelay;
  }

  private show(explanation: Explanation | null, now: number) {
    if (explanation === null || !this.canShow(explanation.id, now)) {
      return;
    }
    this.nextGap = this.shownAt[explanation.id] === undefined ? this.gap : this.repeatGap;
    this.current = { ...explanation, start: now, duration: Explainer.readingTime(explanation.text) };
    this.shownAt[explanation.id] = now;
  }

  private explainEvent(event: SimulationEvent): Explanation | null {
    const boid = event.boid;
    switch (event.type) {
      case 'birth':
        if (boid.isPredator) {
          return null;
        }
        if (boid.generation > 0 && boid.generation % 10 === 0) {
          return { id: 'generation', anchor: boid, text: `Generation ${boid.generation}! Since the start, ${boid.generation} generations of boids were born, each one slightly different from its parents.` };
        }
        return { id: 'birth', anchor: boid, text: 'A birth: two rested and well-fed boids, heading the same way, had a child. It takes each of its genes from one of its parents.' };
      case 'mutant':
        return { id: 'mutant', anchor: boid, text: `A mutant${boid.isPredator ? ' predator' : ''}! One of its genes changed: it ${this.mutation(boid, event.other)} than its parents. It gets a new shade of color too, that its descendants will keep: a new lineage starts.` };
      case 'caught':
        if (boid.isSuper) {
          return null;
        }
        return { id: 'caught', anchor: boid, text: 'Caught! The predator digests now: it slows down and turns pale. A predator can only have a child after a meal.' };
      case 'gaveUp':
        return { id: 'gaveUp', anchor: boid, text: 'This predator gave up: its prey turns more sharply than it can, and they were going round in circles. It looks for an easier one.' };
      case 'oldAge':
        return { id: 'oldAge', anchor: boid, text: 'This boid died of old age. Fast or fertile boids live shorter lives: every gene has a cost.' };
      case 'starved':
        return { id: 'starved', anchor: boid, text: 'This boid starved: it spent all its energy. Swimming fast costs much more energy than swimming slowly, and good eyes cost some too.' };
      case 'predatorStarved':
        return { id: 'predatorStarved', anchor: boid, text: 'This predator starved: it didn\'t catch anything in time. The faster a predator swims, the sooner it gets hungry.' };
      case 'reinforcement':
        return { id: 'reinforcement', anchor: boid, text: `Only a few ${boid.isPredator ? 'predators' : 'boids'} were left: newcomers arrive from the borders, carrying the genes of their population.` };
      case 'superPredator':
        return { id: 'superPredator', anchor: boid, text: 'A Super Predator: it hunts boids and predators alike for 45 seconds, and the predators flee it too.' };
      default:
        return null;
    }
  }

  // The gene that changed the most from the parent, in words
  private mutation(child: Boid, parent: Boid | undefined): string {
    if (parent === undefined) {
      return 'is different';
    }
    const changes = [
      { change: child.genome.maxVelocity / parent.genome.maxVelocity - 1, words: ['is faster', 'is slower'] },
      { change: parent.genome.reproductionRate / child.genome.reproductionRate - 1, words: ['is more fertile', 'is less fertile'] },
      { change: child.genome.vision / parent.genome.vision - 1, words: ['sees the predators from farther away', 'sees the predators from closer'] },
    ];
    const largest = changes.reduce((best, gene) => Math.abs(gene.change) > Math.abs(best.change) ? gene : best);
    return largest.change >= 0 ? largest.words[0] : largest.words[1];
  }

  // The richest plankton on the screen, far enough from the borders for its circle to be seen
  private richestPlankton(sim: Simulation): Point | null {
    const food = sim.food;
    const margin = 90;
    let richest = -1;
    for (let i = 0; i < food.food.length; i++) {
      const x = (i % food.cols + 0.5) * food.cellSize;
      const y = (Math.floor(i / food.cols) + 0.5) * food.cellSize;
      const inside = x > margin && x < sim.width - margin && y > margin && y < sim.height - margin;
      if (inside && (richest === -1 || food.food[i] > food.food[richest])) {
        richest = i;
      }
    }
    return richest === -1 || food.food[richest] <= 0.5 ? null
      : { x: (richest % food.cols + 0.5) * food.cellSize, y: (Math.floor(richest / food.cols) + 0.5) * food.cellSize };
  }

  // The situations worth explaining right now, the most essential first
  private observe(sim: Simulation, chartsVisible: boolean): Explanation[] {
    const boids = sim.boids.filter(boid => !boid.isDead);
    const candidates: Explanation[] = [];

    // The first days of the winter and of the spring, around the plankton that changes
    const season = sim.season;
    const seasonStarted = (season.progress * 4) % 1 < 0.25;
    if (sim.seasonsEnabled && sim.foodEnabled && seasonStarted && (season.name === 'Winter' || season.name === 'Spring')) {
      const center = this.richestPlankton(sim) ?? { x: sim.width / 2, y: sim.height / 2 };
      candidates.push(season.name === 'Winter'
        ? { id: 'winter', anchor: { center, radius: 70 }, text: 'Winter: the plankton grows back slowly and the fertile areas shrink. The enduring boids survive best: the big and slow ones, with short sight.' }
        : { id: 'spring', anchor: { center, radius: 70 }, text: 'Spring: the plankton blooms again and the flocks grow back. Food is plenty, so speed and good eyes are worth what they cost.' });
    }

    // A flock: the boids around one of them
    for (const boid of boids.slice(0, 30)) {
      const flock = boids.filter(other => sim.calculateDistanceSquared(boid.position, other.position) < 50 ** 2);
      if (flock.length >= 5) {
        const center = {
          x: flock.reduce((sum, other) => sum + other.position.x, 0) / flock.length,
          y: flock.reduce((sum, other) => sum + other.position.y, 0) / flock.length,
        };
        candidates.push({ id: 'flocking', anchor: { center, radius: 60 }, text: 'Each boid follows three simple rules: stay close to its neighbors, go the same way, and keep some room. The flocks emerge from these rules alone.' });
        break;
      }
    }

    // A boid chased by a predator close to it
    const chased = boids.find(boid => boid.preyLink !== null && sim.calculateDistanceSquared(boid.position, boid.preyLink.position) < 80 ** 2);
    if (chased) {
      candidates.push({ id: 'flee', anchor: chased, text: 'This boid is chased by a predator: it flees, its neighbors flee too, and the whole flock swerves.' });
    }

    // The richest plankton on the screen
    const plankton = sim.foodEnabled ? this.richestPlankton(sim) : null;
    if (plankton !== null) {
      candidates.push({ id: 'grazing', anchor: { center: plankton, radius: 70 }, text: 'This glowing mist is plankton: the boids eat it to get the energy to nest. The fertile areas slowly drift, and the flocks follow them.' });
    }

    // A boid of a lineage whose color drifted away from the first boids
    const colorful = boids.find(boid => Math.abs(boid.genome.lineage) >= 0.4);
    if (colorful) {
      candidates.push({ id: 'colors', anchor: colorful, text: 'The colors show the families: a child takes the color of a parent, and only a mutant gets a new shade. A color that spreads is a lineage that thrives.' });
    }

    // A boid much bigger or smaller than the others
    const sized = boids.find(boid => Math.abs(boid.size - 1) >= 0.15);
    if (sized) {
      candidates.push({ id: 'size', anchor: sized, text: 'The size shows the speed: big boids are slow but enduring, their energy lasts longer. Small ones are fast and escape the predators, but they tire sooner.' });
    }

    // A boid seeing far
    const watchful = boids.find(boid => boid.genome.vision >= 1.15);
    if (watchful) {
      candidates.push({ id: 'vision', anchor: watchful, text: 'This boid sees the predators from far away and flees sooner, but good eyes cost energy. Hold Shift over a boid to see how far it sees.' });
    }

    // The part of a wall close to a boid
    if (!sim.obstacles.isEmpty) {
      for (const boid of boids) {
        const segment = sim.obstacles.near(boid.position).find(s =>
          SegmentField.distanceSquared(boid.position, SegmentField.closestPoint(boid.position, s)) < 40 ** 2);
        if (segment) {
          candidates.push({ id: 'wall', anchor: { center: SegmentField.closestPoint(boid.position, segment), radius: 40 }, text: 'Walls stop the boids, and the sight of the predators too: they don\'t chase a boid hidden behind a wall.' });
          break;
        }
      }
    }

    // The charts, once they have a few minutes of history
    if (chartsVisible && sim.stats.samples.length >= 120) {
      candidates.push({ id: 'charts', anchor: 'charts', text: 'The charts follow the populations and the average genes, with the winters shaded: when the Speed curve rises, the fast boids are winning, usually because the predators eat the slow ones.' });
    }

    return candidates;
  }
}

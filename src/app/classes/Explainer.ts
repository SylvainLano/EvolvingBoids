// Explainer.ts
import type { Boid, Point } from './Boid';
import type { Simulation, SimulationEvent } from './Simulation';
import { SegmentField } from './SegmentField';

// A place on the screen an explanation talks about: some plankton, a wall, an alga
export interface ExplanationArea {
  center: Point;
  radius: number;
}

// A flock an explanation talks about: it is followed as it swims
export interface ExplanationGroup {
  group: Boid[];
}

// A bubble explains a boid (an event happened to it), an area of the screen, a flock, the charts, or the season in the counters
export type ExplanationAnchor = Boid | ExplanationArea | ExplanationGroup | 'charts' | 'season';

export interface Explanation {
  id: string;
  text: string;
  anchor: ExplanationAnchor;
}

export function isArea(anchor: ExplanationAnchor): anchor is ExplanationArea {
  return typeof anchor !== 'string' && 'center' in anchor;
}

export function isGroup(anchor: ExplanationAnchor): anchor is ExplanationGroup {
  return typeof anchor !== 'string' && 'group' in anchor;
}

// The explanations of a death: their boid fades away, and the bubble stays to be read
const DEATHS = ['oldAge', 'starved', 'predatorStarved'];

// What a bubble circles on the screen right now: its boid while it can be seen, its area, or its flock where it is now
// Nothing for the charts and the season, or when the subject is gone
export function subject(anchor: ExplanationAnchor): Boid | ExplanationArea | null {
  if (typeof anchor === 'string') {
    return null;
  }
  if (isArea(anchor)) {
    return anchor;
  }
  if (isGroup(anchor)) {
    const living = anchor.group.filter(boid => !boid.isDead);
    if (living.length < 2) {
      return null;
    }
    const center = {
      x: living.reduce((sum, boid) => sum + boid.position.x, 0) / living.length,
      y: living.reduce((sum, boid) => sum + boid.position.y, 0) / living.length,
    };
    // Around most of the flock, the boids gone astray aside
    const distances = living.map(boid => Math.hypot(boid.position.x - center.x, boid.position.y - center.y)).sort((a, b) => a - b);
    return { center, radius: Math.max(40, Math.min(100, distances[Math.floor(distances.length * 0.8)] + 15)) };
  }
  return anchor.alpha > 0.05 ? anchor : null;
}

// The "Explain me" mode: short bubbles about what happens on the screen, when it happens
// Each explanation is shown once, then comes back from time to time, one bubble at a time
export class Explainer {
  enabled = false;
  current: (Explanation & { start: number, duration: number }) | null = null;

  readonly gap = 4000;                // in ms between two bubbles, while there are new things to explain
  readonly repeatGap = 12000;         // in ms after a bubble already seen: the explanations come back now and then
  readonly skipGap = 500;             // in ms before the next bubble, when the user asks for it
  readonly repeatDelay = 150000;      // in ms before the same explanation can come back
  readonly observeInterval = 1000;    // in ms between two looks at the simulation, for the explanations of a situation
  readonly recentEvent = 4000;        // in ms during which an event that happened during another bubble can still be explained
  readonly lostSubject = 1500;        // in ms before the end of a bubble whose subject is gone
  covered: (point: Point) => boolean = () => false;   // the places hidden by the interface (charts, panel, tool bar), given by the display
  private shownAt: Record<string, number> = {};
  private idleSince = -Infinity;
  private nextGap = this.gap;
  private lastObservation = -Infinity;
  private recent: { explanation: Explanation, time: number }[] = [];
  private seasonDue = false;

  // The time to read a text calmly, in real time so it doesn't depend on the speed of the simulation
  static readingTime(text: string): number {
    return Math.min(18000, Math.max(9000, 5000 + text.length * 70));
  }

  // The first bubble explains the situation on the screen, starting with how a flock works
  setEnabled(enabled: boolean, now: number, sim?: Simulation, chartsVisible = false, seasonVisible = false) {
    this.enabled = enabled;
    this.current = null;
    this.idleSince = now - this.gap;
    this.nextGap = this.gap;
    this.lastObservation = -Infinity;
    this.recent = [];
    if (enabled && sim !== undefined) {
      this.update(sim, now, chartsVisible, seasonVisible);
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

  // An event of the simulation is explained if no other bubble is shown, otherwise it is kept for a little while
  // The capture of the boid a bubble is about is told right away: the story goes on
  notify(event: SimulationEvent, now: number) {
    if (!this.enabled) {
      return;
    }
    const explanation = this.explainEvent(event);
    if (explanation === null) {
      return;
    }
    if (event.type === 'caught' && this.current !== null && this.current.anchor === event.other) {
      this.show(explanation, now, true);
    } else if (this.isIdle(now) && !this.seasonDue) {
      this.show(explanation, now);
    } else {
      this.recent = [...this.recent.filter(event => event.explanation.id !== explanation.id), { explanation, time: now }];
    }
  }

  // Called at each frame: the bubble ends, soon after its subject is gone, or a situation of the simulation is explained
  update(sim: Simulation, now: number, chartsVisible: boolean, seasonVisible = false) {
    if (!this.enabled) {
      this.current = null;
      return;
    }
    const current = this.current;
    if (current !== null && subject(current.anchor) === null && typeof current.anchor !== 'string' && !DEATHS.includes(current.id)) {
      current.duration = Math.min(current.duration, Math.max(now - current.start, this.lostSubject) + this.lostSubject);
    }
    if (current !== null && now - current.start >= current.duration) {
      this.current = null;
      this.idleSince = now;
    }
    // The arrival of a season goes before the events, which wait for their turn meanwhile
    const arrival = this.seasonArrival(sim);
    this.seasonDue = arrival !== null && this.canShow(arrival, now);
    if (this.isIdle(now) && now - this.lastObservation >= this.observeInterval) {
      this.lastObservation = now;
      // The arrival of a season first, then the recent events, then the other situations, the most essential first
      this.recent = this.recent.filter(event => now - event.time < this.recentEvent && subject(event.explanation.anchor) !== null);
      const situations = this.observe(sim, chartsVisible, seasonVisible);
      const seasonal = (candidate: Explanation) => candidate.id === 'winter' || candidate.id === 'spring';
      const candidates = [...situations.filter(seasonal), ...this.recent.map(event => event.explanation), ...situations.filter(c => !seasonal(c))]
        .filter(candidate => this.canShow(candidate.id, now) && this.visible(candidate));
      // The explanations never shown come first, then the one shown the longest ago
      const next = candidates.find(c => this.shownAt[c.id] === undefined)
        ?? candidates.reduce<Explanation | null>((oldest, c) => oldest === null || this.shownAt[c.id] < this.shownAt[oldest.id] ? c : oldest, null);
      this.show(next, now);
    }
  }

  private isIdle(now: number): boolean {
    return this.enabled && this.current === null && now - this.idleSince >= this.nextGap;
  }

  private canShow(id: string, now: number): boolean {
    return this.shownAt[id] === undefined || now - this.shownAt[id] >= this.repeatDelay;
  }

  // The subject of an explanation is on the screen, not hidden by the interface, and a dead boid is still well seen
  private visible(explanation: Explanation): boolean {
    if (typeof explanation.anchor === 'string') {
      return true;
    }
    const circled = subject(explanation.anchor);
    return circled !== null && !this.covered('center' in circled ? circled.center : circled.position)
      && !(DEATHS.includes(explanation.id) && 'alpha' in circled && circled.alpha < 0.5);
  }

  // A bubble only appears when its subject can be seen, except to tell what happened to the subject of the current one
  private show(explanation: Explanation | null, now: number, followUp = false) {
    if (explanation === null || (!followUp && !this.canShow(explanation.id, now))) {
      return;
    }
    if (followUp ? typeof explanation.anchor !== 'string' && subject(explanation.anchor) === null : !this.visible(explanation)) {
      return;
    }
    this.nextGap = this.shownAt[explanation.id] === undefined ? this.gap : this.repeatGap;
    this.current = { ...explanation, start: now, duration: Explainer.readingTime(explanation.text) };
    this.shownAt[explanation.id] = now;
    this.recent = this.recent.filter(event => event.explanation.id !== explanation.id);
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
        return { id: 'gaveUp', anchor: boid, text: 'This predator gave up: its prey turns more sharply than it can, and they were going round in circles. Agile boids escape this way, agile predators keep up. It looks for an easier one.' };
      case 'oldAge':
        return { id: 'oldAge', anchor: boid, text: 'This boid died of old age. Fast or fertile boids live shorter lives: every gene has a cost.' };
      case 'starved':
        return { id: 'starved', anchor: boid, text: 'This boid starved: it spent all its energy. Swimming fast costs much more energy than swimming slowly, and good eyes cost some too.' };
      case 'predatorStarved':
        return { id: 'predatorStarved', anchor: boid, text: 'This predator starved: it didn\'t catch anything in time. The faster a predator swims, the sooner it gets hungry, and good eyes make it hungrier. A big one lasts longer.' };
      case 'reinforcement':
        return { id: 'reinforcement', anchor: boid, text: `Only a few ${boid.isPredator ? 'predators' : 'boids'} were left: newcomers arrive from the borders, carrying the genes of their population.` };
      case 'superPredator':
        return { id: 'superPredator', anchor: boid, text: 'A Super Predator: it hunts boids and predators alike for 45 seconds, and the predators flee it too.' };
      case 'deusExMachina':
        return { id: 'deusExMachina', anchor: boid, text: 'Deus Ex Machina: the boids were crowding the screen, so a Super Predator came to thin them out. It hunts for 45 seconds, then fades away.' };
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
      {
        change: child.genome.vision / parent.genome.vision - 1,
        words: child.isPredator ? ['sees the boids from farther away', 'sees the boids from closer'] : ['sees the predators from farther away', 'sees the predators from closer'],
      },
      { change: child.genome.focus / parent.genome.focus - 1, words: ['looks narrower but farther', 'looks wider but closer'] },
      { change: child.genome.agility / parent.genome.agility - 1, words: ['turns more sharply', 'turns less sharply'] },
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

  // The first days of the winter or of the spring, when the plankton changes
  private seasonArrival(sim: Simulation): 'winter' | 'spring' | null {
    const season = sim.season;
    if (!sim.seasonsEnabled || !sim.foodEnabled || (season.progress * 4) % 1 >= 0.25) {
      return null;
    }
    return season.name === 'Winter' ? 'winter' : season.name === 'Spring' ? 'spring' : null;
  }

  // The largest flock among a few: the boids around one of them, at least 5, not hidden by the interface
  private largestFlock(sim: Simulation, boids: Boid[]): Boid[] | null {
    let largest: Boid[] | null = null;
    for (const boid of boids.filter(boid => !this.covered(boid.position)).slice(0, 30)) {
      const flock = boids.filter(other => sim.calculateDistanceSquared(boid.position, other.position) < 50 ** 2);
      if (flock.length >= 5 && (largest === null || flock.length > largest.length)) {
        largest = flock;
      }
    }
    return largest;
  }

  // The situations worth explaining right now, the most essential first
  private observe(sim: Simulation, chartsVisible: boolean, seasonVisible: boolean): Explanation[] {
    const boids = sim.boids.filter(boid => !boid.isDead);
    const predators = sim.predators.filter(predator => !predator.isDead && !predator.isSuper);
    const flock = this.largestFlock(sim, boids);
    const seen = (boid: Boid) => !this.covered(boid.position);
    const candidates: Explanation[] = [];

    // The first days of the winter and of the spring: next to the season in the counters, or around the plankton or a flock
    const arrival = this.seasonArrival(sim);
    if (arrival !== null) {
      const plankton = this.richestPlankton(sim);
      const anchor: ExplanationAnchor | null = seasonVisible ? 'season'
        : plankton !== null ? { center: plankton, radius: 70 }
        : flock !== null ? { group: flock } : null;
      if (anchor !== null) {
        candidates.push(arrival === 'winter'
          ? { id: 'winter', anchor, text: 'Winter: the plankton grows back slowly, the fertile areas shrink and the algae die. The enduring boids survive best: the big and slow ones, with short sight.' }
          : { id: 'spring', anchor, text: 'Spring: the plankton blooms again, new algae sprout, and the flocks grow back. Food is plenty, so speed and good eyes are worth what they cost.' });
      }
    }

    // A flock, followed as it swims
    if (flock !== null) {
      candidates.push({ id: 'flocking', anchor: { group: flock }, text: 'Each boid follows three simple rules: stay close to its neighbors, go the same way, and keep some room. The flocks emerge from these rules alone.' });
    }

    // A boid chased by a predator close to it
    const chased = boids.find(boid => seen(boid) && boid.preyLink !== null && sim.calculateDistanceSquared(boid.position, boid.preyLink.position) < 80 ** 2);
    if (chased) {
      candidates.push({ id: 'flee', anchor: chased, text: 'This boid is chased by a predator: it flees, its neighbors flee too, and the whole flock swerves.' });
    }

    // A boid chased by a predator it can't see, in its blind spot behind it
    const surprised = boids.find(boid => seen(boid) && boid.preyLink !== null && !sim.inFieldOfView(boid, boid.preyLink.position)
      && sim.calculateDistanceSquared(boid.position, boid.preyLink.position) < sim.sightRadius(boid) ** 2);
    if (surprised) {
      candidates.push({ id: 'blindSpot', anchor: surprised, text: 'This boid doesn\'t see the predator coming from behind: like fish, boids have a blind spot at the back. Their field of view is wide, but not all around.' });
    }

    // The richest plankton on the screen
    const plankton = sim.foodEnabled ? this.richestPlankton(sim) : null;
    if (plankton !== null) {
      candidates.push({ id: 'grazing', anchor: { center: plankton, radius: 70 }, text: 'This glowing mist is plankton: the boids eat it to get the energy to nest. The fertile areas slowly drift, and the flocks follow them.' });
    }

    // A grown alga, far enough from the borders for its circle to be seen
    const alga = sim.foodEnabled && sim.plantsEnabled
      ? sim.plants.plants.find(plant => !this.covered(plant) && plant.biomass > 1 && plant.x > 90 && plant.x < sim.width - 90 && plant.y > 90 && plant.y < sim.height - 90)
      : undefined;
    if (alga) {
      candidates.push({ id: 'plants', anchor: { center: { x: alga.x, y: alga.y - 8 }, radius: sim.plants.radius(alga) + 15 }, text: 'These algae grow in place, and the flocks graze them: their roots stay, so they grow back. They sow their seeds in summer, and few of them survive the winter.' });
    }

    // A predator that sees no prey: it prowls
    const prowler = sim.predatorSight > 0 ? predators.find(predator => seen(predator) && predator.aim === null && predator.reproductionCooldown === 0) : undefined;
    if (prowler) {
      candidates.push({ id: 'prowl', anchor: prowler, text: 'This predator sees no prey: it prowls slowly to save its strength, back where it saw the last one, then at random. Hold Shift over it to see how far it sees.' });
    }

    // A predator with keen or poor eyes
    const sharpEyed = sim.predatorSight > 0 ? predators.find(predator => seen(predator) && Math.abs(predator.genome.vision - 1) >= 0.1) : undefined;
    if (sharpEyed) {
      candidates.push({ id: 'predatorVision', anchor: sharpEyed, text: sharpEyed.genome.vision > 1
        ? 'This predator has keen eyes: it spots the flocks from farther away, but good eyes make it hungry sooner. Against it, the boids that see far flee sooner: an arms race.'
        : 'This predator is short-sighted: it finds fewer flocks, but it gets hungry later. Whether good eyes are worth what they cost depends on how many boids there are to find.' });
    }

    // A boid of a lineage whose color drifted away from the first boids
    const colorful = boids.find(boid => seen(boid) && Math.abs(boid.genome.lineage) >= 0.4);
    if (colorful) {
      candidates.push({ id: 'colors', anchor: colorful, text: 'The colors show the families: a child takes the color of a parent, and only a mutant gets a new shade. A color that spreads is a lineage that thrives.' });
    }

    // A boid much bigger or smaller than the others
    const sized = boids.find(boid => seen(boid) && Math.abs(boid.size - 1) >= 0.15);
    if (sized) {
      candidates.push({ id: 'size', anchor: sized, text: 'The size shows the speed: big boids are slow but enduring, their energy lasts longer. Small ones are fast and escape the predators, but they tire sooner.' });
    }

    // A boid seeing far
    const watchful = boids.find(boid => seen(boid) && boid.genome.vision >= 1.15);
    if (watchful) {
      candidates.push({ id: 'vision', anchor: watchful, text: 'This boid sees the predators from far away and flees sooner, but good eyes cost energy. Hold Shift over a boid to see how far it sees.' });
    }

    // A boid looking narrow and far, or wide and close
    const focused = sim.boidFieldOfView < 360 ? boids.find(boid => seen(boid) && Math.abs(boid.genome.focus - 1) >= 0.15) : undefined;
    if (focused) {
      candidates.push({ id: 'focus', anchor: focused, text: focused.genome.focus > 1
        ? 'This boid looks narrow but far: it sees the predators coming from farther ahead, but its blind spot is larger. Hold Shift over it to see its field of view.'
        : 'This boid looks wide but close: it sees the predators coming from aside and almost from behind, but later. Hold Shift over it to see its field of view.' });
    }

    // A boid much more or less agile than the others
    const nimble = sim.agilityGene ? boids.find(boid => seen(boid) && Math.abs(boid.genome.agility - 1) >= 0.1) : undefined;
    if (nimble) {
      candidates.push({ id: 'agility', anchor: nimble, text: nimble.genome.agility > 1
        ? 'This boid is agile: it turns sharply and shakes off the predators, but it lives shorter. Against it, the agile predators keep up: an arms race.'
        : 'This boid turns slowly: it is easier to catch, but it lives longer. Where the predators are few, agility isn\'t worth what it costs.' });
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

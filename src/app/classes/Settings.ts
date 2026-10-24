// Settings.ts
import type { Point } from './Boid';
import { SegmentField } from './SegmentField';

export type SettingValue = number | boolean | string;
export type SettingValues = Record<string, SettingValue>;

// A setting of the options panels: whether it belongs to the display or to the simulation, and the values it accepts,
// the same as in the options: a range for a number, a list for a choice, and any boolean otherwise
export interface Setting {
  key: string;
  owner: 'view' | 'sim';
  range?: [number, number];
  choices?: readonly string[];
}

export const SETTINGS: readonly Setting[] = [
  // Display
  { key: 'renderer', owner: 'view', choices: ['canvas', 'dom'] },
  { key: 'boidShape', owner: 'view', choices: ['arrow', 'fish', 'bird', 'letters'] },
  { key: 'darkMode', owner: 'view' },
  { key: 'glow', owner: 'view' },
  { key: 'drawQuadtree', owner: 'view' },
  { key: 'displayQuadtreeCount', owner: 'view' },
  { key: 'displayBoidCount', owner: 'view' },
  { key: 'displayCharts', owner: 'view' },
  { key: 'displayFPSCount', owner: 'view' },
  { key: 'trailLength', owner: 'sim', range: [0, 20] },
  // Simulation
  { key: 'simulationMode', owner: 'sim', choices: ['DeathMatch', 'Retry', 'Continued', 'Infinite'] },
  { key: 'lowFPSAction', owner: 'sim', choices: ['PopulationControl', 'BudgetCuts', 'SuperPredator', 'Nothing'] },
  { key: 'deusExMachina', owner: 'sim' },
  // Boids
  { key: 'alignmentRadius', owner: 'sim', range: [10, 200] },
  { key: 'cohesionRadius', owner: 'sim', range: [10, 200] },
  { key: 'boidsSeparationRadius', owner: 'sim', range: [10, 200] },
  { key: 'boidReproductionModificator', owner: 'sim', range: [-10, 10] },
  { key: 'boidReproductionChances', owner: 'sim', range: [0, 100] },
  { key: 'boidLifespan', owner: 'sim', range: [0, 600] },
  { key: 'geneCostFactor', owner: 'sim', range: [0, 3] },
  { key: 'foodEnabled', owner: 'sim' },
  { key: 'plantsEnabled', owner: 'sim' },
  { key: 'fertileAreas', owner: 'sim', range: [1, 6] },
  { key: 'seasonsEnabled', owner: 'sim' },
  { key: 'yearDuration', owner: 'sim', range: [4, 20] },
  { key: 'winterFood', owner: 'sim', range: [0, 100] },
  { key: 'fleeReset', owner: 'sim' },
  { key: 'boidEvolutionChances', owner: 'sim', range: [0, 100] },
  { key: 'boidEvolutionCap', owner: 'sim', range: [5, 95] },
  { key: 'fleeRadius', owner: 'sim', range: [20, 300] },
  { key: 'boidFieldOfView', owner: 'sim', range: [90, 360] },
  { key: 'fleeFactor', owner: 'sim', range: [-5, 10] },
  // Predators
  { key: 'predatorsCooperativeness', owner: 'sim' },
  { key: 'predatorVersatility', owner: 'sim' },
  { key: 'predatorReproductionModificator', owner: 'sim', range: [-10, 10] },
  { key: 'predatorReproductionChances', owner: 'sim', range: [0, 100] },
  { key: 'predatorEvolutionChances', owner: 'sim', range: [0, 100] },
  { key: 'predatorEvolutionCap', owner: 'sim', range: [5, 95] },
  { key: 'predatorsSeparationRadius', owner: 'sim', range: [10, 200] },
  { key: 'predatorStarvationModificator', owner: 'sim', range: [-10, 10] },
  { key: 'predatorSight', owner: 'sim', range: [0, 1000] },
  { key: 'predatorFieldOfView', owner: 'sim', range: [90, 360] },
];

// A value read from a link or from the browser, null when it isn't valid for this setting: a number out of
// the range of its option is brought back into it, as a link may come from anybody
function parse(setting: Setting, raw: unknown): SettingValue | null {
  if (setting.range) {
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    return Number.isFinite(value) ? Math.min(setting.range[1], Math.max(setting.range[0], value)) : null;
  }
  if (setting.choices) {
    return typeof raw === 'string' && setting.choices.includes(raw) ? raw : null;
  }
  return raw === true || raw === 'true' ? true : raw === false || raw === 'false' ? false : null;
}

// The valid settings found in a link or in the browser, the others are ignored
export function readSettings(source: URLSearchParams | Record<string, unknown>): SettingValues {
  const values: SettingValues = {};
  for (const setting of SETTINGS) {
    const raw = source instanceof URLSearchParams ? source.get(setting.key) : source[setting.key];
    const value = raw === null || raw === undefined ? null : parse(setting, raw);
    if (value !== null) {
      values[setting.key] = value;
    }
  }
  return values;
}

// Where a setting is and the values it accepts, for the options that show it
export function findSetting(key: string): Setting | undefined {
  return SETTINGS.find(setting => setting.key === key);
}

// The parameters of an address that belong to a shared link
export const linkKeys = [...SETTINGS.map(setting => setting.key), 'walls', 'currents', 'challenge'];

// The settings of the user, on the display and on the simulation: remembered in the browser, and shared by a link
export class UserSettings {
  readonly defaults: SettingValues;
  private saved = '{}';
  static readonly storageKey = 'evolvingboids.settings';

  // Created before any change, it takes the current settings as the defaults
  constructor(private owners: { view: object, sim: object }) {
    this.defaults = this.current();
  }

  current(): SettingValues {
    return Object.fromEntries(SETTINGS.map(setting => [setting.key, this.owner(setting)[setting.key]]));
  }

  // Only the settings that differ from the defaults are remembered and shared, the others follow the defaults of the next versions
  changes(): SettingValues {
    const current = this.current();
    return Object.fromEntries(Object.entries(current).filter(([key, value]) => value !== this.defaults[key]));
  }

  apply(values: SettingValues) {
    for (const setting of SETTINGS) {
      if (values[setting.key] !== undefined) {
        this.owner(setting)[setting.key] = values[setting.key];
      }
    }
  }

  reset() {
    this.apply(this.defaults);
  }

  // The settings changed on a previous visit, the browser may refuse to give them (private browsing...)
  load() {
    try {
      this.apply(readSettings(JSON.parse(localStorage.getItem(UserSettings.storageKey) ?? '{}')));
    } catch {
      // Nothing remembered, the defaults stay
    }
    this.saved = JSON.stringify(this.changes());
  }

  // Remembered as soon as they change
  save() {
    const changes = JSON.stringify(this.changes());
    if ( changes === this.saved ) {
      return;
    }
    this.saved = changes;
    try {
      localStorage.setItem(UserSettings.storageKey, changes);
    } catch {
      // Not remembered, the settings are only kept until the page is closed
    }
  }

  private owner(setting: Setting): Record<string, SettingValue> {
    return (setting.owner === 'view' ? this.owners.view : this.owners.sim) as Record<string, SettingValue>;
  }
}

// What a link shares: some settings, the walls and the currents, or a challenge
export interface SharedLink {
  settings: SettingValues;
  walls: Point[][];             // in fractions of the screen size, as the screen of the receiver has its own size
  currents: Point[][];
  challenge: string | null;
}

// The query of a link, with the settings changed and the drawings, or only a challenge, which comes with its own settings
export function linkQuery(link: SharedLink): string {
  const params = new URLSearchParams();
  if ( link.challenge !== null ) {
    params.set('challenge', link.challenge);
    return params.toString();
  }
  for (const [key, value] of Object.entries(link.settings)) {
    params.set(key, String(value));
  }
  if ( link.walls.length > 0 ) {
    params.set('walls', encodeLines(link.walls));
  }
  if ( link.currents.length > 0 ) {
    params.set('currents', encodeLines(link.currents));
  }
  return params.toString();
}

// The link opened by the page, null when its address shares nothing (like index.html?demo)
export function parseLink(search: string): SharedLink | null {
  const params = new URLSearchParams(search);
  const link: SharedLink = {
    settings: readSettings(params),
    walls: decodeLines(params.get('walls') ?? ''),
    currents: decodeLines(params.get('currents') ?? ''),
    challenge: params.get('challenge'),
  };
  const shares = Object.keys(link.settings).length > 0 || link.walls.length > 0 || link.currents.length > 0 || link.challenge !== null;
  return shares ? link : null;
}

// The lines of a link: two characters per coordinate, 4096 positions across the screen, and a dot between two lines
const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LEVELS = DIGITS.length ** 2;
const maxLinkPoints = 5000;     // a link may come from anybody: its lines are limited

export function encodeLines(lines: Point[][]): string {
  const digits = (ratio: number) => {
    const level = Math.round(Math.min(1, Math.max(0, ratio)) * (LEVELS - 1));
    return DIGITS[Math.floor(level / DIGITS.length)] + DIGITS[level % DIGITS.length];
  };
  return lines.map(line => line.map(point => digits(point.x) + digits(point.y)).join('')).join('.');
}

export function decodeLines(text: string): Point[][] {
  const coordinate = (part: string, index: number) => {
    const high = DIGITS.indexOf(part[index]);
    const low = DIGITS.indexOf(part[index + 1]);
    return high < 0 || low < 0 ? NaN : (high * DIGITS.length + low) / (LEVELS - 1);
  };
  const lines: Point[][] = [];
  let points = 0;
  for (const part of text.split('.')) {
    const line: Point[] = [];
    for (let i = 0; i + 4 <= part.length && points < maxLinkPoints; i += 4, points++) {
      const point = { x: coordinate(part, i), y: coordinate(part, i + 2) };
      if ( Number.isFinite(point.x) && Number.isFinite(point.y) ) {
        line.push(point);
      }
    }
    if ( line.length >= 2 ) {
      lines.push(line);
    }
  }
  return lines;
}

// The lines drawn on the screen, in fractions of its size, with fewer points for a shorter link
export function shareLines(lines: Point[][], width: number, height: number, tolerance = 1.5): Point[][] {
  return lines.map(line => simplify(line, tolerance).map(point => ({ x: point.x / width, y: point.y / height })));
}

// The lines of a link, on a screen of this size
export function placeLines(lines: Point[][], width: number, height: number): Point[][] {
  return lines.map(line => line.map(point => ({ x: point.x * width, y: point.y * height })));
}

// The points that move the line by less than the tolerance are dropped (Ramer-Douglas-Peucker): a straight wall keeps its two ends
export function simplify(line: Point[], tolerance: number): Point[] {
  if ( line.length <= 2 ) {
    return line;
  }
  const chord = { a: line[0], b: line[line.length - 1] };
  let farthest = 0;
  let index = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const distance = SegmentField.distanceSquared(line[i], SegmentField.closestPoint(line[i], chord));
    if ( distance > farthest ) {
      farthest = distance;
      index = i;
    }
  }
  if ( farthest <= tolerance ** 2 ) {
    return [chord.a, chord.b];
  }
  return [...simplify(line.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(line.slice(index), tolerance)];
}

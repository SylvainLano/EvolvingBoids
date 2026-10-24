import { Simulation } from './Simulation';
import { UserSettings, decodeLines, encodeLines, linkQuery, parseLink, placeLines, readSettings, shareLines, simplify } from './Settings';
import type { Point } from './Boid';

// The display settings of the main component, without the component
function view() {
  return {
    renderer: 'canvas', darkMode: true, glow: true, drawQuadtree: false,
    displayQuadtreeCount: true, displayBoidCount: true, displayCharts: true, displayFPSCount: false,
  };
}

describe('Settings', () => {
  beforeEach(() => localStorage.removeItem(UserSettings.storageKey));
  afterEach(() => localStorage.removeItem(UserSettings.storageKey));

  it('should only keep the settings that differ from the defaults', () => {
    const display = view();
    const sim = new Simulation();
    const settings = new UserSettings({ view: display, sim });
    expect(settings.changes()).toEqual({});
    display.darkMode = false;
    sim.alignmentRadius = 50;
    expect(settings.changes()).toEqual({ darkMode: false, alignmentRadius: 50 });
    settings.reset();
    expect(display.darkMode).toBe(true);
    expect(sim.alignmentRadius).toBe(30);
  });

  it('should read the valid settings only, with the numbers brought back into the ranges of the options', () => {
    const values = readSettings(new URLSearchParams('alignmentRadius=1000&fleeFactor=-3&darkMode=maybe&renderer=webgl&foodEnabled=false&unknown=1&boidLifespan='));
    expect(values).toEqual({ alignmentRadius: 200, fleeFactor: -3, foodEnabled: false });
  });

  it('should share the seasons too', () => {
    expect(readSettings(new URLSearchParams('seasonsEnabled=false&yearDuration=60&winterFood=50')))
      .toEqual({ seasonsEnabled: false, yearDuration: 20, winterFood: 50 });
  });

  it('should remember the changed settings in the browser, and bring them back on the next visit', () => {
    const sim = new Simulation();
    const settings = new UserSettings({ view: view(), sim });
    sim.boidLifespan = 300;
    settings.save();

    const nextSim = new Simulation();
    const nextView = view();
    new UserSettings({ view: nextView, sim: nextSim }).load();
    expect(nextSim.boidLifespan).toBe(300);
    expect(nextView.darkMode).toBe(true);
  });

  it('should keep the ends of a straight line and the corners of a bent one', () => {
    const straight = Array.from({ length: 50 }, (_, i) => ({ x: 100 + i * 10, y: 300 + (i % 2) * 0.5 }));
    expect(simplify(straight, 1.5).length).toBe(2);
    const bent = [...straight, ...Array.from({ length: 20 }, (_, i) => ({ x: 590, y: 310 + i * 10 }))];
    expect(simplify(bent, 1.5).length).toBe(3);
  });

  it('should share the walls in a few characters, at the scale of any screen', () => {
    const wall: Point[] = Array.from({ length: 40 }, (_, i) => ({ x: 100 + i * 10, y: 200 }));
    const encoded = encodeLines(shareLines([wall], 800, 600));
    expect(encoded.length).toBe(8);
    const [placed] = placeLines(decodeLines(encoded), 1600, 1200);
    expect(placed[0].x).toBeCloseTo(200, 0);
    expect(placed[1].x).toBeCloseTo(980, 0);
    expect(placed[1].y).toBeCloseTo(400, 0);
  });

  it('should open the link it shared', () => {
    const wall = [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }];
    const query = linkQuery({ settings: { darkMode: false, boidLifespan: 300 }, walls: [wall], currents: [], challenge: null });
    const link = parseLink('?' + query)!;
    expect(link.settings).toEqual({ darkMode: false, boidLifespan: 300 });
    expect(link.walls.length).toBe(1);
    expect(link.walls[0][1].x).toBeCloseTo(0.5, 3);
    expect(link.currents).toEqual([]);
  });

  it('should share a challenge alone, and nothing for an address like index.html?demo', () => {
    const query = linkQuery({ settings: { darkMode: false }, walls: [], currents: [], challenge: 'fortress' });
    expect(query).toBe('challenge=fortress');
    expect(parseLink('?' + query)!.challenge).toBe('fortress');
    expect(parseLink('?demo')).toBeNull();
    expect(parseLink('')).toBeNull();
  });

  it('should ignore broken lines in a link', () => {
    expect(decodeLines('AB*DEFGH.ABC')).toEqual([]);
  });
});

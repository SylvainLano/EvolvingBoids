import { boidColor } from './BoidColor';

const hue = (color: string) => Number(color.match(/hsla\((\d+)/)![1]);

describe('BoidColor', () => {
  it('should color the lineages of the boids from deep violet to blue, then to green and nearly yellow', () => {
    expect(hue(boidColor(false, false, -1, 1, true))).toBe(276);
    expect(hue(boidColor(false, false, 0, 1, true))).toBe(235);
    expect(hue(boidColor(false, false, 0.7, 1, true))).toBe(130);
    expect(hue(boidColor(false, false, 1, 1, true))).toBe(72);
  });

  it('should color the lineages of the predators from mauve to red, then to orange', () => {
    expect(hue(boidColor(true, false, -1, 1, true))).toBe(302);
    expect(hue(boidColor(true, false, 0, 1, true))).toBe(358);
    expect(hue(boidColor(true, false, 1, 1, true))).toBe(22);
  });

  it('should keep a golden Super Predator and a grey dead boid, whatever their lineage', () => {
    expect(boidColor(true, false, 1, 1, true, 1, true)).toBe('hsla(45, 100%, 62%, 1)');
    expect(boidColor(false, true, -1, 0.5, true)).toBe('rgba(255, 255, 255, 0.5)');
  });
});

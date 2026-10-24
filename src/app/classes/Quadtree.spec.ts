import { Quadtree } from './Quadtree';
import type { Boid } from './Boid';

// Only what the Quadtree uses
function entity(x: number, y: number, isPredator = false): Boid {
  return { position: { x, y }, isPredator, isDead: false } as Boid;
}

function count(quadtree: Quadtree): number {
  return quadtree.retrieveFinalQuadtrees().reduce((sum, leaf) => sum + leaf.entities.length, 0);
}

describe('Quadtree', () => {
  it('should hold many entities at the very same position without splitting endlessly', () => {
    const quadtree = new Quadtree(0, 0, 600, 500, 24);
    expect(() => {
      for (let i = 0; i < 100; i++) {
        quadtree.insert(entity(599, 499));
      }
    }).not.toThrow();
    expect(count(quadtree)).toBe(100);
    expect(Math.max(...quadtree.retrieveFinalQuadtrees().map(leaf => leaf.depth))).toBeLessThanOrEqual(Quadtree.maxDepth);
  });

  it('should keep every entity when they move around', () => {
    const quadtree = new Quadtree(0, 0, 400, 400, 4);
    const entities = Array.from({ length: 50 }, () => entity(Math.random() * 400, Math.random() * 400));
    entities.forEach(e => quadtree.insert(e));
    for (let step = 0; step < 100; step++) {
      for (const e of entities) {
        e.quadtree.move(e, { x: Math.min(399, Math.max(0, e.position.x + (Math.random() - 0.5) * 20)), y: Math.min(399, Math.max(0, e.position.y + (Math.random() - 0.5) * 20)) });
      }
    }
    expect(count(quadtree)).toBe(50);
  });

  it('should remove an entity', () => {
    const quadtree = new Quadtree(0, 0, 400, 400, 4);
    const entities = Array.from({ length: 10 }, (_, i) => entity(i * 30 + 5, i * 30 + 5));
    entities.forEach(e => quadtree.insert(e));
    entities[3].quadtree.remove(entities[3]);
    expect(count(quadtree)).toBe(9);
  });

  it('should ignore the dying entities in range queries', () => {
    const quadtree = new Quadtree(0, 0, 400, 400, 24);
    const searcher = entity(100, 100);
    const alive = entity(110, 100);
    const dying = entity(105, 100);
    dying.isDead = true;
    [searcher, alive, dying].forEach(e => quadtree.insert(e));
    const found = quadtree.rangeQuery(searcher, 50, 10);
    expect(found).toContain(alive);
    expect(found).not.toContain(dying);
  });

  it('should find predators separately from regular boids', () => {
    const quadtree = new Quadtree(0, 0, 400, 400, 24);
    const searcher = entity(100, 100);
    const predator = entity(110, 100, true);
    [searcher, predator, entity(120, 100)].forEach(e => quadtree.insert(e));
    expect(quadtree.rangeQuery(searcher, 50, 10, true)).toEqual([predator]);
  });
});

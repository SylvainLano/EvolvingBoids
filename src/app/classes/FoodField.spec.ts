import { FoodField } from './FoodField';

describe('FoodField', () => {
  function fullestCell(field: FoodField): { x: number, y: number, index: number } {
    let index = 0;
    for (let i = 1; i < field.capacity.length; i++) {
      if (field.capacity[i] > field.capacity[index]) {
        index = i;
      }
    }
    return { x: (index % field.cols + 0.5) * field.cellSize, y: (Math.floor(index / field.cols) + 0.5) * field.cellSize, index };
  }

  it('should start full', () => {
    const field = new FoodField(800, 600, 3);
    expect(field.fillRatio()).toBeCloseTo(1);
    expect(field.patchCount).toBe(3);
  });

  it('should be eaten, then grow back toward its capacity', () => {
    const field = new FoodField(800, 600, 3);
    const cell = fullestCell(field);
    const eaten = field.eat(cell, 10);
    expect(eaten).toBeGreaterThan(0);
    expect(field.food[cell.index]).toBe(0);
    field.update(600);
    expect(field.food[cell.index]).toBeGreaterThan(0);
    expect(field.food[cell.index]).toBeLessThanOrEqual(Math.max(field.capacity[cell.index], 0));
  });

  it('should never be eaten beyond what there is', () => {
    const field = new FoodField(800, 600, 3);
    const cell = fullestCell(field);
    const total = field.eat(cell, 1000) + field.eat(cell, 1000);
    expect(total).toBeLessThanOrEqual(1);
  });

  it('should fade back to its capacity when sown out of the fertile areas', () => {
    const field = new FoodField(800, 600, 3);
    let index = 0;
    for (let i = 1; i < field.capacity.length; i++) {
      if (field.capacity[i] < field.capacity[index]) {
        index = i;
      }
    }
    const point = { x: (index % field.cols + 0.5) * field.cellSize, y: (Math.floor(index / field.cols) + 0.5) * field.cellSize };
    field.sow(point, 40, 1);
    const sown = field.food[index];
    expect(sown).toBeGreaterThan(field.capacity[index]);
    field.update(100);
    expect(field.food[index]).toBeLessThan(sown);
  });

  it('should point toward the food', () => {
    const field = new FoodField(800, 600, 1);
    const cell = fullestCell(field);
    // Looked at from the side with the more room
    const offset = cell.x > 400 ? -80 : 80;
    const gradient = field.gradient({ x: cell.x + offset, y: cell.y });
    expect(Math.sign(gradient.x)).toBe(-Math.sign(offset));
  });

  it('should change its number of fertile areas', () => {
    const field = new FoodField(800, 600, 3);
    field.setPatchCount(5);
    expect(field.patchCount).toBe(5);
    field.setPatchCount(1);
    expect(field.patchCount).toBe(1);
  });

  it('should follow a resize of the window', () => {
    const field = new FoodField(800, 600, 3);
    field.resize(1600, 1200);
    expect(field.cols).toBe(80);
    expect(field.rows).toBe(60);
    expect(field.fillRatio()).toBeGreaterThan(0);
  });
});

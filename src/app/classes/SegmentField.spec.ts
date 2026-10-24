import { SegmentField } from './SegmentField';

describe('SegmentField', () => {
  const wall = { a: { x: 100, y: 0 }, b: { x: 100, y: 200 } };

  it('should detect a move crossing a segment', () => {
    expect(SegmentField.crosses({ x: 95, y: 50 }, { x: 105, y: 50 }, wall)).toBeTrue();
    expect(SegmentField.crosses({ x: 80, y: 50 }, { x: 95, y: 50 }, wall)).toBeFalse();
    // Beyond the end of the segment
    expect(SegmentField.crosses({ x: 95, y: 250 }, { x: 105, y: 250 }, wall)).toBeFalse();
    // Exactly through its end, where the next segment of a line would join
    expect(SegmentField.crosses({ x: 95, y: 200 }, { x: 105, y: 200 }, wall)).toBeTrue();
  });

  it('should block a line of sight crossing a line at one of its joints', () => {
    const field = new SegmentField(30);
    field.add([{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 200 }]);
    expect(field.blocks({ x: 50, y: 100 }, { x: 150, y: 100 })).toBeTrue();
    expect(field.blocks({ x: 50, y: 300 }, { x: 150, y: 300 })).toBeFalse();
  });

  it('should find the closest point of a segment', () => {
    expect(SegmentField.closestPoint({ x: 50, y: 80 }, wall)).toEqual({ x: 100, y: 80 });
    expect(SegmentField.closestPoint({ x: 50, y: 300 }, wall)).toEqual({ x: 100, y: 200 });
  });

  it('should only give the segments near a point', () => {
    const field = new SegmentField(30);
    field.add([{ x: 100, y: 0 }, { x: 100, y: 200 }]);
    expect(field.near({ x: 110, y: 100 }).length).toBe(1);
    expect(field.near({ x: 400, y: 100 }).length).toBe(0);
  });

  it('should cut a line in two when its middle is erased', () => {
    const field = new SegmentField(30);
    field.add(Array.from({ length: 11 }, (_, i) => ({ x: i * 20, y: 100 })));
    expect(field.erase({ x: 100, y: 100 }, 15)).toBeTrue();
    expect(field.polylines.length).toBe(2);
    expect(field.erase({ x: 100, y: 400 }, 15)).toBeFalse();
  });

  it('should ignore a line of a single point', () => {
    const field = new SegmentField(30);
    field.add([{ x: 10, y: 10 }]);
    expect(field.isEmpty).toBeTrue();
  });

  it('should follow a resize of the window', () => {
    const field = new SegmentField(30);
    field.add([{ x: 100, y: 100 }, { x: 200, y: 100 }]);
    field.transform(point => ({ x: point.x * 2, y: point.y * 2 }));
    expect(field.polylines[0]).toEqual([{ x: 200, y: 200 }, { x: 400, y: 200 }]);
    expect(field.near({ x: 300, y: 210 }).length).toBe(1);
  });
});

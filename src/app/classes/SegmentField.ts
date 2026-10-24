// SegmentField.ts
import type { Point } from './Boid';

export interface Segment {
  a: Point;
  b: Point;
}

// Lines drawn with the mouse (obstacles, currents), kept as polylines in the drawing direction
// Their segments are indexed by a grid, so a boid only checks the segments around it
export class SegmentField {
  polylines: Point[][] = [];
  private segments: Segment[] = [];
  private grid = new Map<number, Segment[]>();
  private static readonly noSegment: Segment[] = [];

  // reach: the farthest distance at which a segment acts on a boid
  constructor(private reach: number, private cellSize: number = 64) {}

  get isEmpty(): boolean {
    return this.polylines.length === 0;
  }

  add(polyline: Point[]) {
    if (polyline.length < 2) {
      return;
    }
    this.polylines.push(polyline);
    this.rebuild();
  }

  clear() {
    this.polylines = [];
    this.rebuild();
  }

  // Apply a transformation to every point, after a resize of the window
  transform(change: (point: Point) => Point) {
    this.polylines = this.polylines.map(polyline => polyline.map(change));
    this.rebuild();
  }

  // Remove the parts of the lines within the radius, a line cut in the middle becomes two lines
  erase(center: Point, radius: number): boolean {
    let erased = false;
    const remaining: Point[][] = [];
    for (const polyline of this.polylines) {
      let run: Point[] = [polyline[0]];
      for (let i = 1; i < polyline.length; i++) {
        const segment = { a: polyline[i - 1], b: polyline[i] };
        if (SegmentField.distanceSquared(center, SegmentField.closestPoint(center, segment)) <= radius * radius) {
          erased = true;
          if (run.length >= 2) {
            remaining.push(run);
          }
          run = [polyline[i]];
        } else {
          run.push(polyline[i]);
        }
      }
      if (run.length >= 2) {
        remaining.push(run);
      }
    }
    if (erased) {
      this.polylines = remaining;
      this.rebuild();
    }
    return erased;
  }

  // Whether a line from p1 to p2 crosses one of the segments, wherever they are: the line of sight between two points
  blocks(p1: Point, p2: Point): boolean {
    return this.segments.some(segment => SegmentField.crosses(p1, p2, segment));
  }

  // The segments that may act on a point
  near(point: Point): Segment[] {
    return this.grid.get(this.key(Math.floor(point.x / this.cellSize), Math.floor(point.y / this.cellSize))) ?? SegmentField.noSegment;
  }

  private key(cellX: number, cellY: number): number {
    return (cellX + 1000) * 10000 + (cellY + 1000);
  }

  // Each segment is registered in every cell its reach overlaps
  private rebuild() {
    this.grid.clear();
    this.segments = [];
    for (const polyline of this.polylines) {
      for (let i = 1; i < polyline.length; i++) {
        const segment = { a: polyline[i - 1], b: polyline[i] };
        this.segments.push(segment);
        const minX = Math.floor((Math.min(segment.a.x, segment.b.x) - this.reach) / this.cellSize);
        const maxX = Math.floor((Math.max(segment.a.x, segment.b.x) + this.reach) / this.cellSize);
        const minY = Math.floor((Math.min(segment.a.y, segment.b.y) - this.reach) / this.cellSize);
        const maxY = Math.floor((Math.max(segment.a.y, segment.b.y) + this.reach) / this.cellSize);
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            const key = this.key(x, y);
            const cell = this.grid.get(key);
            if (cell) {
              cell.push(segment);
            } else {
              this.grid.set(key, [segment]);
            }
          }
        }
      }
    }
  }

  static closestPoint(point: Point, segment: Segment): Point {
    const dx = segment.b.x - segment.a.x;
    const dy = segment.b.y - segment.a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
      return segment.a;
    }
    const t = Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared));
    return { x: segment.a.x + t * dx, y: segment.a.y + t * dy };
  }

  static distanceSquared(p: Point, q: Point): number {
    return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  }

  // Whether the move from p1 to p2 crosses the segment: p1 and p2 strictly on both sides of it (touching it doesn't count),
  // through the segment or exactly through one of its ends (the joint of two segments of a line would be a gap otherwise)
  static crosses(p1: Point, p2: Point, segment: Segment): boolean {
    const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const d1 = cross(segment.a, segment.b, p1);
    const d2 = cross(segment.a, segment.b, p2);
    const d3 = cross(p1, p2, segment.a);
    const d4 = cross(p1, p2, segment.b);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && d3 * d4 <= 0;
  }
}

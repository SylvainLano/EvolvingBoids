interface Vec2 {
  x: number;
  y: number;
}

interface Boid {
  position: { x: number, y: number };
  velocity: { x: number, y: number };
  maxVelocity: number;
  isPredator: boolean;
  isEvolved: boolean;
  alpha: number;
  isDead: boolean;
  reproductionRate: number;
  reproductionCooldown: number;
  predationCounter: number;
  quadtree: Quadtree;
  preyLink : Boid | null;
}

export class Quadtree {
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
  entities: Boid[] = [];
  parent: Quadtree | null = null;
  subdivided: boolean = false;
  nw: Quadtree | null = null;
  ne: Quadtree | null = null;
  sw: Quadtree | null = null;
  se: Quadtree | null = null;
  neighbors: Quadtree[] = [];
  depth: number = 0;

  constructor(x: number, y: number, width: number, height: number, capacity: number, depth: number = 0, parent: Quadtree | null = null) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.capacity = capacity;
    this.parent = parent;
    this.depth = depth;
  }

  insert(entity: Boid) {
    if ( !this.isInsideBounds( { x: entity.position.x, y: entity.position.y} ) && this.parent !== null ){
      this.parent!.insert(entity);
    } else if ( !this.subdivided && this.entities.length < this.capacity ) {
      entity.quadtree = this;
      this.entities.push(entity);
    } else {

      if (!this.subdivided) {
        this.subdivide();
      }

      // Insert the entity into the appropriate quadrant
      if (entity.position.x >= this.x && entity.position.x < this.x + this.width / 2) {
        if (entity.position.y >= this.y && entity.position.y < this.y + this.height / 2) {
          this.nw!.insert(entity);
        } else if (entity.position.y >= this.y + this.height / 2 && entity.position.y < this.y + this.height) {
          this.sw!.insert(entity);
        }
      } else if (entity.position.x >= this.x + this.width / 2 && entity.position.x < this.x + this.width) {
        if (entity.position.y >= this.y && entity.position.y < this.y + this.height / 2) {
          this.ne!.insert(entity);
        } else if (entity.position.y >= this.y + this.height / 2 && entity.position.y < this.y + this.height) {
          this.se!.insert(entity);
        }
      }
    }
  }

  move( entity: Boid, newPosition: Vec2 ): boolean {
    // Check if the new position is within the bounds of the Quadtree
    if ( this.isInsideBounds(newPosition) || this.parent === null ) {
      // Update the position of the entity
      entity.position = newPosition;
      return false;
    }
    // Remove the entity from its current position in the Quadtree
    this.remove(entity);

    // Update the position of the entity
    entity.position = newPosition;

    // Reinsert the entity at the new position in the Quadtree
    this.parent!.insert(entity);

    return true;
  }

  remove(entity: Boid) {
    // Remove the entity from the current quadrant
    const index = this.entities.indexOf(entity);

    if (index !== -1) {
      this.entities.splice(index, 1);
    }

    this.checkSustainability();
  }

  private checkSustainability() {
    if ( this.entities.length < this.capacity / 4 && this.parent?.subdivided ) {
      if ( this.parent!.countEntities() < this.parent!.capacity ) {
        this.parent!.breakChildren();
      }
    }
  }

  private breakChildren() {
    if ( this.subdivided ) {
      // Recursively break children first
      this.nw!.breakChildren();
      this.ne!.breakChildren();
      this.sw!.breakChildren();
      this.se!.breakChildren();

      this.entities = this.entities.concat( this.nw!.entities, this.ne!.entities, this.sw!.entities, this.se!.entities);

      // Combine neighbors
      this.neighbors = this.neighbors.concat(
        this.nw!.neighbors || [],
        this.ne!.neighbors || [],
        this.sw!.neighbors || [],
        this.se!.neighbors || []
      );
      
      this.nw!.purge();
      this.ne!.purge();
      this.sw!.purge();
      this.se!.purge();

      // Filter out duplicates
      this.neighbors = this.neighbors.filter((neighbor, index, self) => {
        return index === self.findIndex((n) => (
          n.x === neighbor.x && n.y === neighbor.y
        ));
      });

      for (const neighbor of this.neighbors ) {
        // Remove references to nw, ne, sw, and se from neighbor's neighbors array
        neighbor.neighbors = neighbor.neighbors.filter(
          (n) => n !== this.nw && n !== this.ne && n !== this.sw && n !== this.se && n !== this
        );        
        neighbor.neighbors.push( this );
      }

      for (const entity of this.entities ) {
        entity.quadtree =  this;
      }

      this.subdivided = false;
      this.checkSustainability();
    }
  }

  private purge() {
    this.entities = [];
    this.neighbors = [];
    this.subdivided = false;
  }

  private isInsideBounds(position: Vec2): boolean {
    return (
      position.x >= this.x &&
      position.x < this.x + this.width &&
      position.y >= this.y &&
      position.y < this.y + this.height
    );
  }

  subdivide() {
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;

    !this.nw ? this.nw = new Quadtree(this.x, this.y, halfWidth, halfHeight, this.capacity, this.depth + 1, this) : this.nw.purge();
    !this.ne ? this.ne = new Quadtree(this.x + halfWidth, this.y, halfWidth, halfHeight, this.capacity, this.depth + 1, this) : this.ne.purge();
    !this.sw ? this.sw = new Quadtree(this.x, this.y + halfHeight, halfWidth, halfHeight, this.capacity, this.depth + 1, this) : this.sw.purge();
    !this.se ? this.se = new Quadtree(this.x + halfWidth, this.y + halfHeight, halfWidth, halfHeight, this.capacity, this.depth + 1, this) : this.se.purge();

    this.subdivided = true;
    
    // Set neighbors for each child
    this.nw.neighbors.push(this.ne, this.sw, this.se);
    this.ne.neighbors.push(this.nw, this.sw, this.se);
    this.sw.neighbors.push(this.nw, this.ne, this.se);
    this.se.neighbors.push(this.nw, this.ne, this.sw);

    // Determine neighbors dynamically based on overlapping borders
    for (const neighbor of this.neighbors) {
      neighbor.neighbors = neighbor.neighbors.filter(n => n !== this);
      if (this.nw.calculateOverlappingBorders(neighbor)) {
        this.nw.neighbors.push(neighbor);
        neighbor.neighbors.push(this.nw);
      } else if (this.ne.calculateOverlappingBorders(neighbor)) {
        this.ne.neighbors.push(neighbor);
        neighbor.neighbors.push(this.ne);
      } else if (this.sw.calculateOverlappingBorders(neighbor)) {
        this.sw.neighbors.push(neighbor);
        neighbor.neighbors.push(this.sw);
      } else if (this.se.calculateOverlappingBorders(neighbor)) {
        this.se.neighbors.push(neighbor);
        neighbor.neighbors.push(this.se);
      } 
    }

    // Reinsert entities into new quadrants
    for (const entity of this.entities) {
      this.insert(entity);
    }

    this.neighbors = [];
    this.entities = [];
  }

  private calculateOverlappingBorders(neighbor: Quadtree): boolean {
    if ( !(this.y + this.height < neighbor.y || neighbor.y + neighbor.height < this.y )
    && ( this.x == neighbor.x + neighbor.width || this.x + this.width == neighbor.x ) ) {
        return true;
    } 

    if ( !(this.x + this.width < neighbor.x || neighbor.x + neighbor.width < this.x )
    && ( this.y == neighbor.y + neighbor.height || this.y + this.height == neighbor.y) ) {
        return true;
    } 
  
    return false;  // No overlapping border
  }

  rangeQuery(boid:Boid, radius: number, cap: number, predators: boolean = false): Boid[] {
    const result: Boid[] = [];
    const queue: Quadtree[] = [boid.quadtree];
    const checked = new Set([boid.quadtree]);

    while (queue.length > 0) {
        const current = queue.shift()!;

        // Check if the circular region (x, y, radius) intersects with the quadtree node
        if (current.intersectsCircle(boid.position.x, boid.position.y, radius)) {
            // Filter entities based on the onlyPredators parameter
            const filteredEntities = predators
                ? current.entities.filter(entity => entity.isPredator)
                : current.entities.filter(entity => !entity.isPredator);

            result.push(...filteredEntities);

            if ( result.length >= cap ) {
              break;
            }

            for ( const neighbor of current.neighbors ) {
              if ( !checked.has(neighbor) ) {
                queue.push( neighbor );
                checked.add( neighbor );
              }
            }
        }
    }

    return result;
  }

  intersectsCircle(x: number, y: number, radius: number): boolean {
    const circleDistanceX = Math.abs(x - (this.x + this.width / 2));
    const circleDistanceY = Math.abs(y - (this.y + this.height / 2));

    if (circleDistanceX > this.width / 2 + radius) return false;
    if (circleDistanceY > this.height / 2 + radius) return false;

    if (circleDistanceX <= this.width / 2) return true;
    if (circleDistanceY <= this.height / 2) return true;

    const cornerDistanceSq =
      Math.pow(circleDistanceX - this.width / 2, 2) +
      Math.pow(circleDistanceY - this.height / 2, 2);

    return cornerDistanceSq <= Math.pow(radius, 2);
  }

  findClosestRegularBoid(predator: Boid, unmarked: boolean): Boid | null {
    const x = predator.position.x;
    const y = predator.position.y;
    let factor = 1;
    let baseRadius = Math.min( predator.quadtree.width, predator.quadtree.height ) / 2;
    let searchRadius = (baseRadius * 2**factor);
  
    let queue: Quadtree[] = this.regionRangeQuery(predator, searchRadius);
    const checked = new Set();
    let closestBoid: Boid | null = null;
    let closestDistance = Number.MAX_VALUE;
    let closestUnmarkedBoid: Boid | null = null;
    let closestUnmarkedDistance = Number.MAX_VALUE;
    
    while (queue.length > 0) {
      const currentRegion = queue.shift()!;
      if ( !checked.has(currentRegion) ) {
        checked.add( currentRegion );

        // Filter out predators
        const regularBoids = currentRegion.entities.filter((boid) => !boid.isPredator);
      
        if (regularBoids.length > 0) {
          // If there are regular boids in the current region, return the closest one
          const thisClosestBoid = this.findClosestBoidInList({ x, y }, regularBoids, unmarked, predator);
          const thisClosestDistance = this.calculateSquaredDistance(predator.position, thisClosestBoid.position);
          
          if ( ( closestUnmarkedBoid === null || thisClosestDistance < closestUnmarkedDistance )
            && ( unmarked === false || thisClosestBoid.preyLink === null || thisClosestBoid.preyLink === predator ) ) {
            closestUnmarkedBoid = thisClosestBoid;
            closestUnmarkedDistance = thisClosestDistance;
          } else if ( ( closestBoid === null || thisClosestDistance < closestDistance ) ) {
            closestBoid = thisClosestBoid;
            closestDistance = thisClosestDistance;
          }
        }
      }
      
      if (queue.length === 0 && factor <= (3+predator.quadtree.depth) ) {
        if ( closestUnmarkedBoid !== null && closestUnmarkedDistance <= searchRadius ) {
          break;
        } else {
          factor++;
          searchRadius = (baseRadius * 2**factor);
          queue = this.regionRangeQuery(predator, searchRadius);
        }
      }
    }

    if ( closestUnmarkedBoid === null && closestBoid !== null ) {
      closestUnmarkedBoid = closestBoid;
    }
    
    return closestUnmarkedBoid;
  }

  regionRangeQuery(boid:Boid, radius: number): Quadtree[] {
    const result: Quadtree[] = [];
    const queue: Quadtree[] = [boid.quadtree];
    const checked = new Set(queue);

    while (queue.length > 0) {
        const current = queue.shift()!;

        // Check if the circular region (x, y, radius) intersects with the quadtree node
        if (current.intersectsCircle(boid.position.x, boid.position.y, radius)) {

            result.push(current);

            for ( const neighbor of current.neighbors ) {
              if ( !checked.has(neighbor) ) {
                queue.push( neighbor );
                checked.add( neighbor );
              }
            }
        }
    }
    return result;
  }
  
  findClosestBoidInList(point: Vec2, boids: Boid[], unmarked: boolean, chasing: Boid | null): Boid {
    let closestBoid: Boid = boids[0];
    let closestDistance = Number.MAX_VALUE;
    let closestUnmarkedBoid: Boid = boids[0];
    let closestUnmarkedDistance = Number.MAX_VALUE;
  
    for (let otherBoid of boids) {
      const distanceSquared = this.calculateSquaredDistance(point, otherBoid.position);
  
      if ( ( closestUnmarkedBoid === null || distanceSquared < closestUnmarkedDistance )
        && ( unmarked === false || otherBoid.preyLink === null || otherBoid.preyLink === chasing ) ) {
        closestUnmarkedBoid = otherBoid;
        closestUnmarkedDistance = distanceSquared;
      } else if ( ( closestBoid === null || distanceSquared < closestDistance ) ) {
        closestBoid = otherBoid;
        closestDistance = distanceSquared;
      }
    }

    if ( closestUnmarkedBoid === null && closestBoid !== null ) {
      closestUnmarkedBoid = closestBoid;
    }
  
    return closestUnmarkedBoid;
  }  

  calculateSquaredDistance(point1: Vec2, point2: Vec2) {
    const diffX = point1.x - point2.x;
    const diffY = point1.y - point2.y;
    return (diffX * diffX + diffY * diffY);
  }  

  countEntities (onlyPredators: boolean = false, onlyNormal: boolean = false): number {
    let result: number = 0;    
    const queue: Quadtree[] = [this];

    while (queue.length > 0) {
        const current = queue.shift()!;

        // Filter entities based on the onlyPredators parameter
        const filteredEntities = onlyPredators
            ? current.entities.filter(entity => entity.isPredator)
            : onlyNormal
            ? current.entities.filter(entity => !entity.isPredator)
            : current.entities;

        result += filteredEntities.length;

        if ( current.subdivided ) {
          queue.push( current.nw!, current.ne!, current.sw!, current.se! );
        }
    }

    return result;
  }

  retrieveFinalQuadtrees (): Quadtree[] {
    let result: Quadtree[] = [];
    const queue: Quadtree[] = [this];

    while ( queue.length > 0 ) {
        const current = queue.shift()!;

        if ( current.subdivided ) {
          queue.push( current.nw!, current.ne!, current.sw!, current.se! );
        } else if ( current.entities.length !== 0 ) {
          result.push( current );
        }
    }

    return result;
  }

}

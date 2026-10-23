import { Component, OnInit, ElementRef, NgZone, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Quadtree } from '../classes/Quadtree';
import { Boid, Genome, Point } from '../classes/Boid';
import { CanvasRenderer } from '../classes/CanvasRenderer';
import { DemoMode } from '../classes/DemoMode';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.sass'],
})

export class MainComponent implements OnInit {
  boids: Boid[] = [];
  numberOfBoids = 150;                // number of boids created when the simulation starts
  boidReproductionRate = 300;         // delay before a boid can reproduce again - can be modified by evolution and by the input boidReproductionModificator
  reproductionThreshold = 1000;       // needed quiet time to nest - can be modified by the input boidReproductionModificator
  reproductionRadius = 20;            // radius to find a partner (needed to reproduce for regular Boids only)
  boidReproductionChances = 10;       // percentage of chances to reproduce - can be modified by the user
  boidEvolutionChances = 5;           // chances for the child to evolve - can be modified by the user
  boidEvolutionStep = 5;              // size of steps of evolution modification in percent
  boidEvolutionCap = 50;              // maximum evolution modification in percent - can be modified by the user
  boidMaxVelocity = 2;                // maximum starting velocity of the boids - can be modified by evolution
  alignmentRadius = 30;               // radius to align with other boids - can be modified by the user
  cohesionRadius = 40;                // radius to join other boids - can be modified by the user
  boidsSeparationRadius = 20;         // radius to move from other boids - can be modified by the user
  borderDistance = 50;                // distance at which a boid start to avoid a border
  boidMaxSteeringForce = 0.1;         // maximum force to change direction
  borderAvoidanceForce = 5;           // factor to avoid screen borders
  fleeRadius = 60;                    // distance at which a boid detects a predator - can be modified by the user
  fleeFactor = 5;                     // importance of the flee regarding other directionnal factors - can be modified by the user
  fleeForceThreshold = 0.2;           // maximum fleeing force to have a quiet time - can be modified by the input boidReproductionModificator
  fleeReset = false;                  // does the fleeing process restarts the quiet time to 0
  lastBoidBirthPosition =  { x: 0, y: 0 };
  
  predators: Boid[] = [];
  numberOfPredators = 3;              // number of predators created when the simulation starts
  predatorReproductionRate = 300;     // delay before a predator can reproduce again - can be modified by evolution and by the input predatorReproductionModificator
  predatorReproductionChances = 10;   // percentage of chances to reproduce - can be modified by the user
  predatorEvolutionChances = 5;       // chances for the child to evolve - can be modified by the user
  predatorEvolutionStep = 5;          // size of steps of evolution modification in percent
  predatorEvolutionCap = 50;          // maximum evolution modification in percent - can be modified by the user
  predatorMaxSteeringForce = 0.12;    // maximum force to change direction
  predatorsSeparationRadius = 50;     // radius to move from other boids - can be modified by the user
  predatorMaxVelocity = 2.5;          // maximum velocity of the chasing predator - can be modified by evolution
  starvationThreshold = 1000;         // delay before a predator starves to death - can be modified by the input predatorStarvationModificator
  captureDistance = 5;                // distance to get to eat a boid
  predatorsCooperativeness = true;    // Do Predator cooperative to chase different preys
  predatorVersatility = true;         // Can predators change prey after choosing one

  mousePosition: Point | null = null;   // null while the mouse is not over the page, so it doesn't scare the boids
  containerWidth = 0;
  containerHeight = 0;
  totalBoids: number = 0;
  totalPredators: number = 0;

  addOnClick: string = 'predator';
  boidOptionsVisible: boolean = false;
  predatorOptionsVisible: boolean = false;
  displayOptionsVisible: boolean = false;
  simulationOptionsVisible: boolean = false;
  errorMessage = "";
  errorFadeOut = 0;
  pauseSimulation = false;
  drawQuadtree = true;
  displayQuadtreeCount = true;
  displayFPSCount = false;
  displayBoidCount = true;
  darkMode = false;
  simulationMode = "Infinite";
  lowFPSAction = "PopulationControl";
  boidReproductionModificator = 0;        // increase or decrease the reproduction rate for Boids
  predatorReproductionModificator = 0;    // increase or decrease the reproduction rate for Predators
  predatorStarvationModificator = 0;      // increase or decrease the starvation resistance for Predators

  fps = 30;
  minFPS = 20;
  private fpsValues: number[] = [];
  private lastFrameTime = performance.now();
  private fpsUpdateInterval: number = 100;

  stepDuration = 1000 / 60;                     // duration of a simulation step in ms - the simulation runs at 60 steps per second
  maxStepsPerFrame = 4;                         // maximum number of steps computed for a single frame
  private stepAccumulator = 0;
  private lastStepTime = performance.now();

  updateFPS(timestamp: number) {
    const elapsed = timestamp - this.lastFrameTime;
    const fps = 1000 / elapsed;
  
    this.fpsValues.push(fps);
  
    // Check if the update interval has passed
    if (elapsed > this.fpsUpdateInterval) {
      // Calculate average FPS
      this.fps = Math.round(this.calculateAverageFPS());
      this.errorFadeOut = Math.max(0, this.errorFadeOut - 1);
      if ( this.fps >= this.minFPS && this.errorFadeOut == 0 ) {
        this.errorMessage = "";
      }
  
      // Reset values for the next interval
      this.fpsValues = [];
      this.lastFrameTime = timestamp;
    }
  }
  
  calculateAverageFPS(): number {
    if (this.fpsValues.length === 0) {
      return 0;
    }
  
    const totalFPS = this.fpsValues.reduce((sum, fps) => sum + fps, 0);
    const averageFPS = totalFPS / this.fpsValues.length;
  
    return averageFPS;
  }

  quadtree!: Quadtree;
  rangeQueryCap = 6;                            // number of neighboring boids each individual relies onto
  traitScale = 0.5;                             // gene deviation from the species default that gives the most extreme color
  finalQuadtreeList: Quadtree[] = [this.quadtree];

  renderer: 'canvas' | 'dom' = 'canvas';        // the DOM renderer is kept to compare performances
  trailLength = 8;                            // number of past positions drawn behind each boid by the canvas renderer
  glow = true;                                  // additive blending and halos with the canvas renderer, in dark mode
  uiRefreshInterval = 200;                      // delay in ms between two refreshes of the counters and messages
  private lastUiRefresh = 0;
  private canvasRenderer!: CanvasRenderer;
  private resizeTimeout?: ReturnType<typeof setTimeout>;
  demo = new DemoMode(this);
  @ViewChild('boidCanvas', { static: true }) boidCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(private el: ElementRef, private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.canvasRenderer = new CanvasRenderer(this.boidCanvas.nativeElement);
    this.initializeSimulation();

    // The animation loop and the mouse listeners run outside of Angular, so they don't trigger a change detection
    // of the whole application at each frame or mouse move: the view is refreshed on demand in render()
    this.ngZone.runOutsideAngular(() => {
      // Listeners are registered once, not at each restart
      document.addEventListener('mousemove', (event) => this.handleMouseMove(event));
      document.addEventListener('click', (event) => this.handleMouseClick(event));
      document.documentElement.addEventListener('mouseleave', () => this.mousePosition = null);
      document.addEventListener('keydown', (event) => this.handleKeyDown(event));
      document.addEventListener('visibilitychange', () => this.demo.onVisibilityChange());
      document.addEventListener('fullscreenchange', () => this.demo.onFullscreenChange());
      window.addEventListener('resize', () => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => this.resizeSimulation(), 200);
      });

      // The demo can be started directly with an url like index.html?demo
      if (new URLSearchParams(window.location.search).has('demo')) {
        this.demo.start(false);
      }

      // Start the animation loop
      this.updateBoids(performance.now());
    });
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'd' || event.key === 'D') {
      this.demo.toggle();
    } else if (event.key === 'Escape') {
      this.demo.stop();
    }
  }

  restartSimulation(): void {
    this.initializeSimulation();
  }

  initializeSimulation() {

    // Get the dimensions of the boid container
    const boidContainer = this.el.nativeElement.querySelector('.main-container');
    this.containerWidth = boidContainer.offsetWidth;
    this.containerHeight = boidContainer.offsetHeight;
    this.quadtree = new Quadtree( 0, 0, this.containerWidth, this.containerHeight, 24 );
    this.finalQuadtreeList = [this.quadtree];
    this.boids = [];
    this.predators = [];

    // Initialize boids with random positions and velocities
    for (let i = 0; i < this.numberOfBoids; i++) {
      this.insertNewBoid (
        { x: Math.random() * this.containerWidth, y: Math.random() * this.containerHeight },
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        false,
        this.createGenome(false),
        Math.random() * this.boidReproductionRate,
        this.quadtree
      );
    }

    // Initialize predators with random positions, velocities, and reproduction rate
    for (let i = 0; i < this.numberOfPredators; i++) {
      this.insertNewBoid (
        { x: Math.random() * this.containerWidth, y: Math.random() * this.containerHeight },
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        true,
        this.createGenome(true),
        Math.random() * this.predatorReproductionRate,
        this.quadtree
      );
    }
  }
  
  // Fit the simulation to a new window size (resize, fullscreen) without restarting it
  resizeSimulation() {
    const container = this.el.nativeElement.querySelector('.main-container');
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    if ( width === 0 || height === 0 || ( width === this.containerWidth && height === this.containerHeight ) ) {
      return;
    }
    // Positions are scaled to the new size, so the boids keep their layout and none is left outside
    const scaleX = width / this.containerWidth;
    const scaleY = height / this.containerHeight;
    const scale = (point: Point): Point => ({
      x: Math.min(width - 1, Math.max(0, point.x * scaleX)),
      y: Math.min(height - 1, Math.max(0, point.y * scaleY)),
    });
    this.containerWidth = width;
    this.containerHeight = height;
    this.quadtree = new Quadtree( 0, 0, width, height, 24 );

    for (const boid of [...this.boids, ...this.predators]) {
      boid.position = scale(boid.position);
      boid.trail = boid.trail.map(scale);
      this.quadtree.insert(boid);
    }
    this.finalQuadtreeList = this.quadtree.retrieveFinalQuadtrees();
  }

  handleFormClick(event: MouseEvent) {
    event.stopPropagation(); // Prevent the event from propagating down
  }
  
  togglePause() {
    this.pauseSimulation = !this.pauseSimulation;
    const pauseText = document.getElementById(`pauseSimulation`);
    if (this.pauseSimulation) {
      pauseText!.textContent = "Resume Simulation";
    } else {
      pauseText!.textContent = "Pause Simulation";
    }
  }
  
  toggleOptions(optionsType: string) {
    (this as any)[`${optionsType.toLowerCase()}OptionsVisible`] = !(this as any)[`${optionsType.toLowerCase()}OptionsVisible`];
  
    const toggleOptionsButton = document.getElementById(`toggle${optionsType}OptionsButton`);
  
    // Toggle the visibility of the hidden options
    if (toggleOptionsButton) {
      if ((this as any)[`${optionsType.toLowerCase()}OptionsVisible`]) {
        toggleOptionsButton.textContent = `Hide ${optionsType} Options`;
      } else {
        toggleOptionsButton.textContent = `Show ${optionsType} Options`;
      }
    }
  }
  

  // Handle mouse movement
  handleMouseMove(event: MouseEvent) {
    // In demo mode, the mouse only reveals how to exit
    if ( this.demo.active ) {
      this.demo.onMouseMove();
      return;
    }
    // Update the mouse position based on the event
    this.mousePosition = { x: event.clientX, y: event.clientY };
  }

  handleMouseClick(event: MouseEvent) {
    if ( this.demo.active ) {
      this.demo.onMouseMove();
      return;
    }
    const isPredator = this.addOnClick == "predator";
    // Create a new boid at the mouse click position
    this.insertNewBoid (
      { x: event.clientX, y: event.clientY },
      { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      isPredator,
      this.createGenome(isPredator),
      0,
      this.quadtree
    );
  }

  // Animation loop: the simulation advances by fixed steps, so its speed doesn't depend on the screen refresh rate
  updateBoids(timestamp: number) {
    this.demo.update(timestamp);

    // Long gaps (hidden tab, very slow frame) are not caught up, to avoid a burst of steps
    this.stepAccumulator += Math.max(0, Math.min(timestamp - this.lastStepTime, this.stepDuration * this.maxStepsPerFrame));
    this.lastStepTime = timestamp;

    while (this.stepAccumulator >= this.stepDuration) {
      this.stepSimulation();
      this.stepAccumulator -= this.stepDuration;
    }

    // Update FPS
    this.updateFPS(timestamp);

    this.render(timestamp);

    // Call requestAnimationFrame to update the next frame
    requestAnimationFrame((nextTimestamp) => this.updateBoids(nextTimestamp));
  }

  render(timestamp: number) {
    if (this.renderer === 'canvas') {
      this.canvasRenderer.render(
        [this.boids, this.predators],
        this.drawQuadtree ? this.finalQuadtreeList : null,
        { darkMode: this.darkMode, glow: this.glow, displayQuadtreeCount: this.displayQuadtreeCount }
      );
    }

    // The view is refreshed at each frame for the DOM renderer, and only a few times per second for the counters otherwise
    if (this.renderer === 'dom' || timestamp - this.lastUiRefresh >= this.uiRefreshInterval) {
      this.lastUiRefresh = timestamp;
      this.cdr.detectChanges();
    }
  }

  stepSimulation() {

    if ( this.pauseSimulation === false ) {

    if ( this.drawQuadtree == true ) {
      this.finalQuadtreeList = this.quadtree.retrieveFinalQuadtrees();
    }

    this.totalBoids = this.boids.length;
    this.totalPredators = this.predators.length;

    this.dealWithDepletion();

    const allBoids = [...this.boids, ...this.predators];

    // Boids behavior rules
    for (let boid of allBoids) {

      // Avoid borders: Redirect away from the borders
      let avoidBorders = this.avoidBorders(boid);

      if ( boid.isDead ) {

        // Gradually decrease velocity (you can adjust the rate)
        boid.velocity.x *= 0.98;
        boid.velocity.y *= 0.98;

        if ( boid.preyLink !== null ) {
          // Remove the prey mark if any
          boid.preyLink.preyLink = null;
        }
      
        // Gradually decrease alpha (transparency) (adjust the rate)
        boid.alpha = Math.max(0, boid.alpha - 0.01);

        if ( boid.alpha <= 0.01 ) {
          // Remove the starving predator
          boid.quadtree.remove(boid);
          this.predators = this.predators.filter(predator => predator !== boid);
        }

      } else if (!boid.isPredator) {

        const boidsLargestRadius = Math.max(
          this.alignmentRadius,
          this.cohesionRadius,
          this.boidsSeparationRadius,
          this.reproductionRadius
        );

        const nearbyBoids = boid.quadtree.rangeQuery( boid, boidsLargestRadius, this.rangeQueryCap );
        let nearbyPredators: Boid[] = [];
        if ( this.fleeFactor != 0 ) {
          nearbyPredators = boid.quadtree.rangeQuery( boid, this.fleeRadius, this.rangeQueryCap, true );
        }

        // Alignment: Align the velocity with the average velocity of nearby boids
        let { alignment, cohesion, separation } = this.calculateFlock(boid, nearbyBoids);

        boid.reproductionCooldown = Math.max ( 0, Math.min(boid.reproductionCooldown - 1, boid.genome.reproductionRate * (11 - this.boidReproductionModificator)/10  ));

        // Check for quiet times and proximity for reproduction
        if ( this.isReadyToNest(boid) ) {
          this.tryToReproduce(boid);
          cohesion.x *= 1.2;
          cohesion.y *= 1.2;
          separation.x /= 1.2;
          separation.y /= 1.2;
        }

        // Flee predators: Move away from nearby predators
        let fleePredators = this.fleePredators(boid, nearbyPredators);
        
        // Check if the flee force is below a certain threshold
        const fleeForceMagnitudeSquared = fleePredators.x ** 2 + fleePredators.y ** 2;

        if (fleeForceMagnitudeSquared < (this.fleeForceThreshold ** 2 * (1.1 + this.boidReproductionModificator / 10))) {
          // Increment the quiet time counter
          boid.predationCounter++;
        } else if ( this.fleeReset ) {
          // Reset the quiet time counter since the boid is actively fleeing predators
          boid.predationCounter = 0;
        }


        let velocityChangeX = (separation.x + alignment.x + cohesion.x + avoidBorders.x + fleePredators.x * this.fleeFactor);
        let velocityChangeY = (separation.y + alignment.y + cohesion.y + avoidBorders.y + fleePredators.y * this.fleeFactor);

        // Limit the maximum steering force
        const totalForceSquared = velocityChangeX ** 2 + velocityChangeY ** 2;

        // Compare with the squared maximum steering force
        if (totalForceSquared > this.boidMaxSteeringForce ** 2) {
          // Calculate the scaling ratio
          const ratio = this.boidMaxSteeringForce / Math.sqrt(totalForceSquared);

          // Scale the individual force components
          velocityChangeX *= ratio;
          velocityChangeY *= ratio;
        }


        // Update velocity based on the rules
        boid.velocity.x += velocityChangeX;
        boid.velocity.y += velocityChangeY;

        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speedSquared = (boid.velocity.x ** 2 + boid.velocity.y ** 2);
        if (speedSquared > boid.genome.maxVelocity ** 2) {
          const ratio = boid.genome.maxVelocity / Math.sqrt(speedSquared);
          boid.velocity.x *= ratio;
          boid.velocity.y *= ratio;
        }

      } else {

        const nearbyPredators = boid.quadtree.rangeQuery( boid, this.predatorsSeparationRadius, this.rangeQueryCap, true );

        // Separation: Move away from other predators that are too close
        let separation = this.calculatePredatorSeparation(boid, nearbyPredators, this.predatorsSeparationRadius);

        let chase = { x: 0, y: 0 };
        let maxVelocity = boid.genome.maxVelocity;
        let maxSteeringForce = this.predatorMaxSteeringForce;
        
        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speedBeforeSquared = (boid.velocity.x ** 2 + boid.velocity.y ** 2);

        if ( boid.reproductionCooldown == 0 ) {

          if (boid.predationCounter! >= ( this.starvationThreshold * ( 11 + +this.predatorStarvationModificator )/10 ) ) {
            boid.isDead = true;
          } else {

            let closestBoid = boid.preyLink;
            if ( this.predatorVersatility || closestBoid === null ) {
              closestBoid = boid.quadtree.findClosestRegularBoid(boid, this.predatorsCooperativeness);
            }
            
            if ( closestBoid !== null ) {
              let closestBoidPosition = { x: closestBoid.position.x, y: closestBoid.position.y };

              // Check if the predator has caught the boid (arbitrary threshold for simplicity)
              if ( this.calculateDistanceSquared(boid.position, closestBoidPosition) < this.captureDistance**2 ) {
                  // Remove the captured boid
                  closestBoid.quadtree.remove(closestBoid);
                  this.boids = this.boids.filter(b => b !== closestBoid);
                  
                  if ( Math.random() <= this.predatorReproductionChances/100 ) {
                    this.giveBirth ( boid );
                  }

                  boid.reproductionCooldown = boid.genome.reproductionRate;
                  boid.predationCounter = 0;
                  boid.preyLink = null;
              } else {
                if ( closestBoid.preyLink === null ) {
                  // Remove the prey mark from the previous prey if it is different
                  if ( boid.preyLink != null && boid.preyLink != closestBoid ) {
                    boid.preyLink.preyLink = null;
                  }
                  // Mark the prey
                  closestBoid.preyLink = boid;
                  boid.preyLink = closestBoid;
                }
                // Update predator's velocity to move towards the closest boid
                closestBoidPosition.x += closestBoid.velocity.x;
                closestBoidPosition.y += closestBoid.velocity.y;
                chase.x += (closestBoidPosition.x - boid.position.x) * boid.genome.maxVelocity;
                chase.y += (closestBoidPosition.y - boid.position.y) * boid.genome.maxVelocity;
              }
            }
          }

        } else {
          boid.reproductionCooldown = Math.max ( 0, Math.min(boid.reproductionCooldown - 1, boid.genome.reproductionRate * (11 - this.predatorReproductionModificator)/10  ));
          boid.alpha = Math.max ( boid.alpha * 0.99, 1 - Math.min(0.7, boid.reproductionCooldown/boid.genome.reproductionRate));
          maxVelocity = Math.max(Math.sqrt(speedBeforeSquared) * 0.99, boid.genome.maxVelocity / 3);
          if (avoidBorders.x === 0 && avoidBorders.y === 0) {
            maxSteeringForce /= 10;
          }
        }

        
        if ( chase.x == 0 && chase.y == 0 && this.totalBoids != 0 ) {
          // Update predator's velocity to move towards the last Boid Birth Position
          chase.x += ((this.lastBoidBirthPosition.x - boid.position.x) + avoidBorders.x) * maxVelocity;
          chase.y += ((this.lastBoidBirthPosition.y - boid.position.y) + avoidBorders.y) * maxVelocity;
        }

        let velocityChangeX = (separation.x + chase.x );
        let velocityChangeY = (separation.y + chase.y );

        // Limit the maximum steering force
        const totalForceSquared = velocityChangeX ** 2 + velocityChangeY ** 2;

        // Compare with the squared maximum steering force
        if (totalForceSquared > maxSteeringForce ** 2) {
          // Calculate the scaling ratio
          const ratio = maxSteeringForce / Math.sqrt(totalForceSquared);

          // Scale the individual force components
          velocityChangeX *= ratio;
          velocityChangeY *= ratio;
        }

        // Update velocity based on the rules
        boid.velocity.x += velocityChangeX;
        boid.velocity.y += velocityChangeY;
        
        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speedSquared = boid.velocity.x ** 2 + boid.velocity.y ** 2;
        if (speedSquared > maxVelocity ** 2) {
          const ratio = maxVelocity / Math.sqrt(speedSquared);
          boid.velocity.x *= ratio;
          boid.velocity.y *= ratio;
          if ( boid.reproductionCooldown == 0 && boid.isPredator ) {
            // Increase starvation counter if the predator didn't eat
            boid.predationCounter+= boid.genome.maxVelocity;
          }
        } else if ( boid.reproductionCooldown == 0 && boid.isPredator ) {
          // Increase starvation counter if the predator didn't eat
          boid.predationCounter+= Math.sqrt(boid.velocity.x**2 + boid.velocity.y**2);
        }
        
      }
    
      // Update position based on velocity
      const newPosition: Point = { x: boid.position.x + boid.velocity.x, y: boid.position.y + boid.velocity.y };

      // Update the boid's position
      boid.quadtree.move( boid, newPosition );

      // Remember the position for the trail - move() gives the boid a new position object, so it can be kept as is
      if ( this.trailLength > 0 ) {
        boid.trail.push(boid.position);
        if ( boid.trail.length > this.trailLength ) {
          boid.trail.splice(0, boid.trail.length - this.trailLength);
        }
      } else if ( boid.trail.length > 0 ) {
        boid.trail = [];
      }

    }
  }
  }

  dealWithDepletion() {
    if ( this.totalBoids === 0 || this.totalPredators === 0 ) {
      if ( this.simulationMode === "DeathMatch" ) {
        this.pauseSimulation = true;
      } else if ( this.simulationMode === "Retry" ) {
        this.restartSimulation();
      } else if ( this.simulationMode === "Infinite" ) {
        if ( this.totalBoids === 0 ) {
          const numberToAdd = Math.max(4,Math.min(100,this.totalPredators));
          // Add boids with random positions and velocities
          for (let i = 0; i < numberToAdd; i++) {
            // Determine whether the new boid should be placed on a vertical or horizontal boundary
            const onVerticalBoundary = Math.random() < 0.5;

            // Determine the position on the boundary
            let position;
            if (onVerticalBoundary) {
              // Place on the left or right boundary
              position = {
                x: Math.random() < 0.5 ? -5 : this.containerWidth + 5,
                y: Math.random() * this.containerHeight,
              };
            } else {
              // Place on the top or bottom boundary
              position = {
                x: Math.random() * this.containerWidth,
                y: Math.random() < 0.5 ? -5 : this.containerHeight + 5,
              };
            }
            this.insertNewBoid (
              position,
              { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
              false,
              this.createGenome(false),
              Math.random() * this.boidReproductionRate,
              this.quadtree
            );
          }
        } else {
          const numberToAdd = Math.max(2,Math.min(20,this.totalBoids/20));
          // Add boids with random positions and velocities
          for (let i = 0; i < numberToAdd; i++) {
            // Determine whether the new boid should be placed on a vertical or horizontal boundary
            const onVerticalBoundary = Math.random() < 0.5;

            // Determine the position on the boundary
            let position;
            if (onVerticalBoundary) {
              // Place on the left or right boundary
              position = {
                x: Math.random() < 0.5 ? -5 : this.containerWidth + 5,
                y: Math.random() * this.containerHeight,
              };
            } else {
              // Place on the top or bottom boundary
              position = {
                x: Math.random() * this.containerWidth,
                y: Math.random() < 0.5 ? -5 : this.containerHeight + 5,
              };
            }
            this.insertNewBoid (
              position,
              { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
              true,
              this.createGenome(true),
              Math.random() * this.predatorReproductionRate,
              this.quadtree
            );
          }
        }
      }
    }
  }

  fleePredators(currentBoid: Boid, predators: Boid[]): Point {
    
      const fleePredatorsForce = { x: 0, y: 0 };
      const fleeRadiusSquared = this.fleeRadius**2;

      for (let predator of predators) {
          const distanceSquared = this.calculateDistanceSquared(currentBoid.position, predator.position);

          if (distanceSquared < fleeRadiusSquared && distanceSquared != 0) {
              const diffX = currentBoid.position.x - predator.position.x;
              const diffY = currentBoid.position.y - predator.position.y;
              const distance = Math.sqrt(distanceSquared);
              // Forces add up: being surrounded by several predators is scarier
              fleePredatorsForce.x += diffX / distance;
              fleePredatorsForce.y += diffY / distance;
          }
      }

      // The mouse acts as a predator
      if (this.mousePosition !== null) {
        const distanceSquared = this.calculateDistanceSquared(currentBoid.position, this.mousePosition);

        if (distanceSquared < fleeRadiusSquared && distanceSquared != 0) {
            const diffX = currentBoid.position.x - this.mousePosition.x;
            const diffY = currentBoid.position.y - this.mousePosition.y;
            const distance = Math.sqrt(distanceSquared);
            fleePredatorsForce.x += diffX / distance;
            fleePredatorsForce.y += diffY / distance;
        }
      }

      return fleePredatorsForce;
  }

  giveBirth ( parent: Boid, partner: Boid = parent ) {
    // Crossover: each gene comes from one parent or the other, which keeps the diversity of the population
    const genome: Genome = {
      maxVelocity: (Math.random() < 0.5 ? parent : partner).genome.maxVelocity,
      reproductionRate: (Math.random() < 0.5 ? parent : partner).genome.reproductionRate,
    };

    const evolutionChances = parent.isPredator ? this.predatorEvolutionChances/100 : this.boidEvolutionChances/100;
    if ( Math.random() <= evolutionChances ) {
      this.mutate(genome, parent.isPredator);
    }

    this.insertNewBoid (
      { x: parent.position.x, y: parent.position.y },
      { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      parent.isPredator,
      genome,
      genome.reproductionRate * 2,
      parent.quadtree
    );
  }

  // Default genome of the species, slightly varied so that natural selection has something to work on from the start
  createGenome ( isPredator: boolean ): Genome {
    const variation = (isPredator ? this.predatorEvolutionStep : this.boidEvolutionStep) / 100;
    const vary = (value: number) => value * (1 + (Math.random() * 2 - 1) * variation);
    return {
      maxVelocity: vary(isPredator ? this.predatorMaxVelocity : this.boidMaxVelocity),
      reproductionRate: vary(isPredator ? this.predatorReproductionRate : this.boidReproductionRate),
    };
  }

  // Alter one random gene by one evolution step, for better or worse, within the evolution cap
  mutate ( genome: Genome, isPredator: boolean ) {
    const evolutionStep = (isPredator ? this.predatorEvolutionStep : this.boidEvolutionStep) / 100;
    const evolutionCap = (isPredator ? this.predatorEvolutionCap : this.boidEvolutionCap) / 100;
    const gene: keyof Genome = Math.random() < 0.5 ? 'maxVelocity' : 'reproductionRate';
    const defaultValue = gene === 'maxVelocity'
      ? (isPredator ? this.predatorMaxVelocity : this.boidMaxVelocity)
      : (isPredator ? this.predatorReproductionRate : this.boidReproductionRate);
    const mutated = genome[gene] * (Math.random() < 0.5 ? 1 + evolutionStep : 1 - evolutionStep);
    genome[gene] = Math.min(defaultValue * (1 + evolutionCap), Math.max(defaultValue * (1 - evolutionCap), mutated));
  }

  // Normalized deviation of a gene from its species default, in [-1, 1], used to color the boid
  geneTrait ( value: number, defaultValue: number ): number {
    return Math.max(-1, Math.min(1, (value / defaultValue - 1) / this.traitScale));
  }

  insertNewBoid ( position: Point, velocity: Point, isPredator: boolean, genome: Genome,
    reproductionCooldown: number, quadtree: Quadtree ) {
    if ( this.errorFadeOut == 0 || this.pauseSimulation ) {
      if ( this.fps >= this.minFPS  ) {

        const boid: Boid = {
          position: position,
          velocity: velocity,
          genome: genome,
          speedTrait: this.geneTrait(genome.maxVelocity, isPredator ? this.predatorMaxVelocity : this.boidMaxVelocity),
          // a lower reproduction rate means a more fertile boid
          fertilityTrait: -this.geneTrait(genome.reproductionRate, isPredator ? this.predatorReproductionRate : this.boidReproductionRate),
          isPredator: isPredator,
          isDead: false,
          reproductionCooldown: reproductionCooldown,
          predationCounter: 0,
          alpha: 1,
          quadtree: quadtree,
          preyLink: null,
          trail: []
        };
        
        // Insert boid into Quadtree
        quadtree.insert(boid);
        
        if (isPredator) {
          this.predators.push(boid);
        } else {
          this.boids.push(boid);
          this.lastBoidBirthPosition = position;
        }
      } else {
        this.errorMessage = "Boid not created, FPS too low !";
        this.errorFadeOut = 50;
        this.dealWithLowFPS();
      }
    }
  }

  dealWithLowFPS() {
    if ( this.lowFPSAction == "PopulationControl" ) {
      if ( this.totalBoids < this.totalPredators * 5 ) {
        this.removeBoids(Math.floor(this.totalPredators * 0.05), this.predators);
      } else {
        this.removeBoids(Math.floor(this.totalBoids * 0.05), this.boids);
      }
    } else if ( this.lowFPSAction == "BudgetCuts" ) {
      this.removeBoids(Math.floor(this.totalPredators / 2), this.predators);
      this.removeBoids(Math.floor(this.totalBoids / 2), this.boids);
    }
  }

  removeBoids (numberToRemove: number, listOfBoids: Boid[]) {
    for (let i = 0; i < numberToRemove; i++) {
      const boidToRemove = listOfBoids.shift();
      boidToRemove!.quadtree.remove(boidToRemove!);
    }
  }

  tryToReproduce(boid: Boid) {
    const reproductionRadiusSquared = this.reproductionRadius**2;
    const reproductionPartners = this.boids.filter(otherBoid => {
      if ( otherBoid === boid ) {
        return false;
      }
      const distanceSquared = this.calculateDistanceSquared(boid.position, otherBoid.position);
      return (
        distanceSquared < reproductionRadiusSquared &&
        this.areVelocitiesSimilar(boid.velocity, otherBoid.velocity) &&
        this.isReadyToNest(otherBoid)
      );
    });

    if ( reproductionPartners && reproductionPartners.length > 0 ) {

      const partner = reproductionPartners[Math.floor(Math.random() * reproductionPartners.length)];

      if ( Math.random() <= this.boidReproductionChances/100 ) {
        this.giveBirth ( boid, partner );
      }

      boid.reproductionCooldown = boid.genome.reproductionRate * (11 - this.boidReproductionModificator)/10;
      partner.reproductionCooldown = partner.genome.reproductionRate * (11 - this.boidReproductionModificator)/10;
      boid.predationCounter = partner.predationCounter = 0; // Reset quiet time for both parents

    }
  }

  // A regular boid can nest after a quiet time and a cooldown, both shortened by its fertility gene
  isReadyToNest(boid: Boid): boolean {
    const fertilityRatio = boid.genome.reproductionRate / this.boidReproductionRate;
    return boid.reproductionCooldown === 0 &&
      boid.predationCounter >= this.reproductionThreshold * (11 - this.boidReproductionModificator)/10 * fertilityRatio;
  }

  areVelocitiesSimilar(velocity1: { x: number, y: number }, velocity2: { x: number, y: number }): boolean {
    const angleThreshold = 0.1;
    const dotProduct = velocity1.x * velocity2.x + velocity1.y * velocity2.y;
    const magnitudesProduct = Math.sqrt(velocity1.x ** 2 + velocity1.y ** 2) * Math.sqrt(velocity2.x ** 2 + velocity2.y ** 2);
    if ( magnitudesProduct === 0 ) {
      return false;
    }
    // Clamp to avoid NaN from floating point rounding
    const cosineSimilarity = Math.max(-1, Math.min(1, dotProduct / magnitudesProduct));
    return Math.acos(cosineSimilarity) < angleThreshold;
  }

  calculatePredatorSeparation(currentBoid: Boid, boids: Boid[], separationRadius: number) {
    
    const separation = { x: 0, y: 0 };
    const separationRadiusSquared = separationRadius**2;

    for (let otherBoid of boids) {
      if (otherBoid !== currentBoid) {
        const distanceSquared = this.calculateDistanceSquared(currentBoid.position, otherBoid.position);

        if (distanceSquared < separationRadiusSquared && distanceSquared != 0) {
          const diffX = currentBoid.position.x - otherBoid.position.x;
          const diffY = currentBoid.position.y - otherBoid.position.y;
          const distance = Math.sqrt(distanceSquared);
          separation.x += diffX / distance;
          separation.y += diffY / distance;
        }
      }
    }
    return separation;
  }

  calculateFlock(currentBoid: Boid, boids: Boid[]) {
    const averageVelocity = { x: 0, y: 0 };
    let totalBoidsForVelocity = 0;
    const averagePosition = { x: 0, y: 0 };
    let totalBoidsForDirection = 0;
    let direction = { x: 0, y: 0 }
    const separation = { x: 0, y: 0 };
    const alignmentRadiusSquared = this.alignmentRadius**2;
    const cohesionRadiusSquared = this.cohesionRadius**2;
    const boidsSeparationRadiusSquared = this.boidsSeparationRadius**2;

    for (let otherBoid of boids) {
      if (otherBoid !== currentBoid) {
        const distanceSquared = this.calculateDistanceSquared(currentBoid.position, otherBoid.position);

        if (distanceSquared < alignmentRadiusSquared) {
          averageVelocity.x += otherBoid.velocity.x;
          averageVelocity.y += otherBoid.velocity.y;
          totalBoidsForVelocity++;
        }
        if (distanceSquared < cohesionRadiusSquared) {
          averagePosition.x += otherBoid.position.x;
          averagePosition.y += otherBoid.position.y;
          totalBoidsForDirection++;
        }
        if (distanceSquared < boidsSeparationRadiusSquared) {
          const diffX = currentBoid.position.x - otherBoid.position.x;
          const diffY = currentBoid.position.y - otherBoid.position.y;
          const distance = Math.sqrt(distanceSquared);
          separation.x += diffX / distance;
          separation.y += diffY / distance;
        }
      }
    }

    if (totalBoidsForVelocity > 0) {
      averageVelocity.x /= totalBoidsForVelocity;
      averageVelocity.y /= totalBoidsForVelocity;
    }

    if (totalBoidsForDirection > 0) {
      averagePosition.x /= totalBoidsForDirection;
      averagePosition.y /= totalBoidsForDirection;
      direction = this.calculateDirection(currentBoid.position, averagePosition);
    }

    return {
      alignment: averageVelocity,
      cohesion: direction,
      separation: separation
    };
  }

  calculateDistanceSquared(point1: Point, point2: Point) {
    const diffX = point1.x - point2.x;
    const diffY = point1.y - point2.y;
    return (diffX **2 + diffY **2);
  }
  
  calculateDirection(from: Point, to: Point) {
    const diffX = to.x - from.x;
    const diffY = to.y - from.y;
    const distance = Math.sqrt(diffX * diffX + diffY * diffY);

    if (distance > 0) {
      return { x: diffX / distance, y: diffY / distance } as Point;
    } else {
      return { x: 0, y: 0 } as Point;
    }
  }
  
  avoidBorders(boid: Boid): Point {
    const avoid = { x: 0, y: 0 };

    // Avoid left border
    if (boid.position.x < this.borderDistance) {
      avoid.x += this.borderAvoidanceForce;
    }
    // Avoid right border
    if (boid.position.x > this.containerWidth - this.borderDistance) {
      avoid.x -= this.borderAvoidanceForce;
    }
    // Avoid top border
    if (boid.position.y < this.borderDistance) {
      avoid.y += this.borderAvoidanceForce;
    }
    // Avoid bottom border
    if (boid.position.y > this.containerHeight - this.borderDistance) {
      avoid.y -= this.borderAvoidanceForce;
    }

    return avoid;
  }
}

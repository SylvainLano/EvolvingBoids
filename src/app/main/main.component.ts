import { Component, OnInit, ElementRef, NgZone, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Quadtree } from '../classes/Quadtree';
import { Boid, Genome, Heritage, Point } from '../classes/Boid';
import { CanvasRenderer, MutantHalo } from '../classes/CanvasRenderer';
import { SegmentField } from '../classes/SegmentField';
import { boidColor } from '../classes/BoidColor';
import { DemoMode } from '../classes/DemoMode';
import { Statistics } from '../classes/Statistics';
import { ChartRenderer } from '../classes/ChartRenderer';

// What a click or a drag with the mouse does
type Tool = 'boid' | 'predator' | 'superPredator' | 'obstacle' | 'current' | 'eraser';

// Content and position of the card describing the inspected boid
interface Inspection {
  x: number;
  y: number;
  title: string;
  color: string;
  speed: string;
  fertility: string;
  lifeLabel: string;
  life: string;
}

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.sass'],
})

export class MainComponent implements OnInit {
  boids: Boid[] = [];
  numberOfBoids = 150;                // number of boids created when the simulation starts
  boidReproductionRate = 300;         // delay before a boid can reproduce again - can be modified by evolution and by the input boidReproductionModificator
  reproductionThreshold = 600;        // needed quiet time to nest - can be modified by the input boidReproductionModificator
  boidLifespan = 180;                 // average lifespan in seconds (+/- 20 %), 0 for immortal boids - can be modified by the user
  partnerAngleThreshold = 0.3;        // maximum angle in radians between the directions of two partners
  infiniteMinBoids = 30;              // in Infinite mode, reinforcements arrive when there are fewer boids than this, enough for them to find partners
  areaPerBoid = 4000;                // screen area in px² per boid when the screen is full, boids stop reproducing at this density
  geneCostFactor = 1.5;               // each +10 % of speed or fertility costs 15 % of lifespan (boids) or starvation resistance (predators)
  minGeneCost = 0.2;                  // the gene cost never shortens a life below 20 %
  reproductionRadius = 20;            // radius to find a partner (needed to reproduce for regular Boids only)
  boidReproductionChances = 30;     // percentage of chances to reproduce - can be modified by the user
  boidEvolutionChances = 5;           // chances for the child to evolve - can be modified by the user
  boidEvolutionStep = 5;              // size of steps of evolution modification in percent
  boidEvolutionCap = 50;              // maximum evolution modification in percent - can be modified by the user
  birthVariation = 2;                 // random variation of every gene at each birth, in percent, for boids and predators
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
  private pointerPosition: Point | null = null;   // the mouse position, even while it doesn't scare the boids
  inspecting = false;                   // Shift is held: the mouse inspects the boids instead of scaring them
  inspectRadius = 30;                   // distance in px from the mouse to pick a boid to inspect
  inspectedBoid: Boid | null = null;
  inspection: Inspection | null = null;
  mutantHalos: MutantHalo[] = [];
  containerWidth = 0;
  containerHeight = 0;
  totalBoids: number = 0;
  totalPredators: number = 0;

  // Mouse tools, selected in the tool bar or with the keys 1 to 6
  tool: Tool = 'predator';
  readonly tools: { id: Tool, label: string, title: string }[] = [
    { id: 'boid', label: 'Boid', title: 'Click to add a boid' },
    { id: 'predator', label: 'Predator', title: 'Click to add a predator' },
    { id: 'superPredator', label: 'Super Predator', title: 'Click to add a super predator: it hunts boids and predators for 45 seconds' },
    { id: 'obstacle', label: 'Obstacle', title: 'Drag to draw a wall the boids can\'t cross' },
    { id: 'current', label: 'Current', title: 'Drag to draw a current carrying the boids along' },
    { id: 'eraser', label: 'Eraser', title: 'Hold and move to remove boids, obstacles and currents' },
  ];
  obstacleAvoidRadius = 35;           // distance at which boids start to steer away from an obstacle, beyond the distance they need to turn
  obstacleAvoidanceForce = 3;         // importance of avoiding obstacles regarding other directional factors
  obstacles = new SegmentField(this.obstacleAvoidRadius + 5);   // the reach includes the move of a step, to detect the crossings
  currentRadius = 30;                 // half width of a current
  currentStrength = 1.5;              // speed in px per step given by a current at its center
  currentAlignment = 0.05;            // how fast a current turns the boids in its direction
  currents = new SegmentField(this.currentRadius);
  eraserRadius = 30;
  superPredatorMaxVelocity = 3.2;
  superPredatorLifetime = 45;         // in seconds
  superPredatorCaptureDistance = 8;
  superPredatorMaxSteeringForce = 0.15;
  superFleeRadius = 120;              // distance at which predators flee a Super Predator
  private stroke: { kind: 'obstacle' | 'current', points: Point[] } | null = null;   // the line being drawn
  private mousePressed = false;
  private readonly strokeStep = 12;   // minimum distance in px between two points of a drawn line
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

  timeScale = 1;                                // simulation speed: number of simulated seconds per real second
  readonly timeScales = [1, 2, 4, 8];
  displayCharts = true;                         // live charts of the populations and of the average genes
  stats = new Statistics();
  genePoolSize = 30;                            // number of dead individuals whose genes are remembered, per species
  private boidGenePool: Heritage[] = [];
  private predatorGenePool: Heritage[] = [];
  private chartRenderer!: ChartRenderer;
  private lastChartRefresh = 0;
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('boidCanvas', { static: true }) boidCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(private el: ElementRef, private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.canvasRenderer = new CanvasRenderer(this.boidCanvas.nativeElement);
    this.chartRenderer = new ChartRenderer(this.chartCanvas.nativeElement);
    this.initializeSimulation();

    // The animation loop and the mouse listeners run outside of Angular, so they don't trigger a change detection
    // of the whole application at each frame or mouse move: the view is refreshed on demand in render()
    this.ngZone.runOutsideAngular(() => {
      // Listeners are registered once, not at each restart
      document.addEventListener('mousemove', (event) => this.handleMouseMove(event));
      document.addEventListener('click', (event) => this.handleMouseClick(event));
      document.addEventListener('mousedown', (event) => this.handleMouseDown(event));
      window.addEventListener('mouseup', () => this.handleMouseUp());
      document.documentElement.addEventListener('mouseleave', () => this.mousePosition = this.pointerPosition = null);
      document.addEventListener('keydown', (event) => this.handleKeyDown(event));
      document.addEventListener('keyup', (event) => {
        if ( event.key === 'Shift' ) {
          this.setInspecting(false);
        }
      });
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
    if (event.key === 'Shift') {
      this.setInspecting(true);
      return;
    }
    if (/^[1-9]$/.test(event.key) && !this.demo.active) {
      const tool = this.tools[Number(event.key) - 1];
      if (tool) {
        this.selectTool(tool.id);
      }
    } else if (event.key === 'd' || event.key === 'D') {
      this.demo.toggle();
    } else if (event.key === 'Escape') {
      this.demo.stop();
    } else if ((event.key === '+' || event.key === '-') && !this.demo.active) {
      // Next or previous simulation speed
      const index = this.timeScales.indexOf(this.timeScale) + (event.key === '+' ? 1 : -1);
      this.timeScale = this.timeScales[Math.max(0, Math.min(this.timeScales.length - 1, index))];
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
    this.stats.clear();
    this.boidGenePool = [];
    this.predatorGenePool = [];
    this.mutantHalos = [];
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

    // The first boids have random ages, so they don't all die of old age at the same time
    for (const boid of this.boids) {
      boid.age = Math.random() * this.boidLifespan * (1000 / this.stepDuration) * 0.8;
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
    this.obstacles.transform(scale);
    this.currents.transform(scale);
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
    this.pointerPosition = { x: event.clientX, y: event.clientY };
    this.setInspecting(event.shiftKey);

    // The line being drawn gets a new point every few pixels
    if ( this.stroke !== null ) {
      const last = this.stroke.points[this.stroke.points.length - 1];
      if ( SegmentField.distanceSquared(last, this.pointerPosition) >= this.strokeStep ** 2 ) {
        this.stroke.points.push(this.pointerPosition);
      }
    }
  }

  // Clicks on the options or the tool bar are not meant for the tools
  isOnInterface(event: MouseEvent): boolean {
    const target = event.target as Element | null;
    return typeof target?.closest === 'function' && target.closest('.display-container, .tool-bar') !== null;
  }

  selectTool(tool: Tool) {
    this.tool = tool;
    this.stroke = null;
    this.setInspecting(this.inspecting);
  }

  // The mouse scares the boids like a predator, only with the tools adding creatures
  get toolScares(): boolean {
    return this.tool === 'boid' || this.tool === 'predator' || this.tool === 'superPredator';
  }

  handleMouseDown(event: MouseEvent) {
    if ( this.demo.active || event.button !== 0 || this.isOnInterface(event) ) {
      return;
    }
    this.mousePressed = true;
    const point = { x: event.clientX, y: event.clientY };
    if ( this.tool === 'obstacle' || this.tool === 'current' ) {
      this.stroke = { kind: this.tool, points: [point] };
    } else if ( this.tool === 'eraser' ) {
      this.erase(point);
    }
  }

  // A drawn line becomes an obstacle or a current when the mouse is released
  handleMouseUp() {
    if ( this.stroke !== null ) {
      const points = this.stroke.points;
      const last = points[points.length - 1];
      if ( this.pointerPosition !== null && SegmentField.distanceSquared(last, this.pointerPosition) >= 9 ) {
        points.push(this.pointerPosition);
      }
      (this.stroke.kind === 'obstacle' ? this.obstacles : this.currents).add(points);
      this.stroke = null;
    }
    this.mousePressed = false;
  }

  // The eraser removes the boids (they fade away), and the parts of the obstacles and currents under it
  erase(center: Point) {
    const radiusSquared = this.eraserRadius ** 2;
    for (const boid of [...this.boids, ...this.predators]) {
      if ( !boid.isDead && this.calculateDistanceSquared(boid.position, center) < radiusSquared ) {
        boid.isDead = true;
        if ( !boid.isSuper ) {
          this.rememberGenes(boid);
        }
      }
    }
    this.obstacles.erase(center, this.eraserRadius);
    this.currents.erase(center, this.eraserRadius);
  }

  clearDrawings() {
    this.obstacles.clear();
    this.currents.clear();
  }

  // While Shift is held, the mouse inspects the boids instead of scaring them
  setInspecting(inspecting: boolean) {
    this.inspecting = inspecting && !this.demo.active;
    this.mousePosition = this.inspecting || !this.toolScares ? null : this.pointerPosition;
    if ( !this.inspecting ) {
      this.inspectedBoid = null;
      this.inspection = null;
    }
  }

  // The closest living boid under the mouse, and the card describing it next to the mouse
  updateInspection() {
    this.inspectedBoid = null;
    this.inspection = null;
    const pointer = this.pointerPosition;
    if ( !this.inspecting || pointer === null || this.demo.active ) {
      return;
    }
    let closestDistance = this.inspectRadius ** 2;
    for (const boid of [...this.boids, ...this.predators]) {
      const distance = this.calculateDistanceSquared(boid.position, pointer);
      if ( !boid.isDead && distance < closestDistance ) {
        closestDistance = distance;
        this.inspectedBoid = boid;
      }
    }
    const boid = this.inspectedBoid;
    if ( boid === null ) {
      return;
    }

    const percent = (ratio: number) => `${ratio >= 0 ? '+' : ''}${Math.round(ratio * 100)} %`;
    const stepsPerSecond = 1000 / this.stepDuration;
    let lifeLabel: string;
    let life: string;
    if ( boid.isSuper ) {
      lifeLabel = 'Lifetime';
      life = `${Math.round(boid.age / stepsPerSecond)} s / ${this.superPredatorLifetime} s`;
    } else if ( boid.isPredator ) {
      const starvation = this.starvationThreshold * ( 11 + +this.predatorStarvationModificator )/10 * boid.geneCost;
      lifeLabel = 'Hunger';
      life = boid.reproductionCooldown > 0 ? 'digesting' : `${Math.round(100 * boid.predationCounter / starvation)} %`;
    } else {
      lifeLabel = 'Age';
      life = this.boidLifespan > 0
        ? `${Math.round(boid.age / stepsPerSecond)} s / ${Math.round(this.boidLifespan * boid.lifespanFactor * boid.geneCost)} s`
        : `${Math.round(boid.age / stepsPerSecond)} s / immortal`;
    }

    // The card stays inside the window
    const cardWidth = 230;
    const cardHeight = 90;
    this.inspection = {
      x: pointer.x + 16 + cardWidth > this.containerWidth ? pointer.x - 16 - cardWidth : pointer.x + 16,
      y: pointer.y + 16 + cardHeight > this.containerHeight ? pointer.y - 16 - cardHeight : pointer.y + 16,
      title: boid.isSuper
        ? 'Super Predator'
        : `${boid.isPredator ? 'Predator' : 'Boid'} - Generation ${boid.generation}${boid.isMutant ? ' - Mutant' : ''}`,
      color: boidColor(boid.isPredator, false, boid.speedTrait, boid.fertilityTrait, 1, this.darkMode, 1, boid.isSuper),
      speed: percent(boid.genome.maxVelocity / (boid.isPredator ? this.predatorMaxVelocity : this.boidMaxVelocity) - 1),
      fertility: boid.isSuper
        ? '-'
        : percent(1 - boid.genome.reproductionRate / (boid.isPredator ? this.predatorReproductionRate : this.boidReproductionRate)),
      lifeLabel,
      life,
    };
  }

  handleMouseClick(event: MouseEvent) {
    if ( this.demo.active ) {
      this.demo.onMouseMove();
      return;
    }
    if ( this.isOnInterface(event) ) {
      return;
    }
    const position = { x: event.clientX, y: event.clientY };
    if ( this.tool === 'boid' || this.tool === 'predator' ) {
      const isPredator = this.tool === 'predator';
      // Create a new boid at the mouse click position
      this.insertNewBoid (
        position,
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        isPredator,
        this.createGenome(isPredator),
        0,
        this.quadtree
      );
    } else if ( this.tool === 'superPredator' ) {
      this.addSuperPredator(position);
    }
  }

  // A Super Predator doesn't evolve nor reproduce, it hunts for a while then fades away
  addSuperPredator(position: Point) {
    const superPredator = this.insertNewBoid (
      position,
      { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      true,
      { maxVelocity: this.superPredatorMaxVelocity, reproductionRate: this.predatorReproductionRate },
      0,
      this.quadtree
    );
    if ( superPredator !== null ) {
      superPredator.isSuper = true;
    }
  }

  // Animation loop: the simulation advances by fixed steps, so its speed doesn't depend on the screen refresh rate
  updateBoids(timestamp: number) {
    this.demo.update(timestamp);

    // The eraser keeps erasing while the mouse is held, even without moving
    if ( this.mousePressed && this.tool === 'eraser' && this.pointerPosition !== null && !this.demo.active ) {
      this.erase(this.pointerPosition);
    }

    // The time scale runs more steps per frame to speed up the simulation
    // Long gaps (hidden tab, very slow frame) are not caught up, to avoid a burst of steps
    const elapsed = (timestamp - this.lastStepTime) * this.timeScale;
    this.stepAccumulator += Math.max(0, Math.min(elapsed, this.stepDuration * this.maxStepsPerFrame * this.timeScale));
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
      // Halos last in real time
      const now = performance.now();
      this.mutantHalos = this.mutantHalos.filter(halo => now - halo.start < this.canvasRenderer.mutantHaloDuration);
      this.updateInspection();
      this.canvasRenderer.render(
        [this.boids, this.predators],
        this.drawQuadtree ? this.finalQuadtreeList : null,
        { darkMode: this.darkMode, glow: this.glow, displayQuadtreeCount: this.displayQuadtreeCount },
        this.mutantHalos,
        this.inspectedBoid,
        {
          obstacles: this.obstacles.polylines,
          currents: this.currents.polylines,
          currentWidth: this.currentRadius * 2,
          stroke: this.stroke,
          eraser: this.tool === 'eraser' && this.pointerPosition !== null && !this.demo.active
            ? { position: this.pointerPosition, radius: this.eraserRadius }
            : null,
        }
      );
    } else {
      this.updateInspection();
    }

    // The view is refreshed at each frame for the DOM renderer, and only a few times per second for the counters otherwise
    // While inspecting, the card follows the mouse at each frame too
    if (this.renderer === 'dom' || this.inspection !== null || timestamp - this.lastUiRefresh >= this.uiRefreshInterval) {
      this.lastUiRefresh = timestamp;
      this.cdr.detectChanges();
    }

    // The charts only change once per simulated second
    if (this.displayCharts && !this.demo.active && timestamp - this.lastChartRefresh >= this.uiRefreshInterval) {
      this.lastChartRefresh = timestamp;
      this.chartRenderer.render(this.stats.samples, this.darkMode);
    }
  }

  stepSimulation() {

    if ( this.pauseSimulation === false ) {

    if ( this.drawQuadtree == true ) {
      this.finalQuadtreeList = this.quadtree.retrieveFinalQuadtrees();
    }

    this.totalBoids = this.boids.length;
    // Super Predators are a tool of the user, they don't count as predators
    this.totalPredators = this.predators.filter(predator => !predator.isSuper).length;

    this.dealWithDepletion();

    this.stats.step(
      this.boids,
      this.predators,
      { maxVelocity: this.boidMaxVelocity, reproductionRate: this.boidReproductionRate },
      { maxVelocity: this.predatorMaxVelocity, reproductionRate: this.predatorReproductionRate }
    );

    const allBoids = [...this.boids, ...this.predators];

    // Boids behavior rules
    for (let boid of allBoids) {

      // Avoid borders: Redirect away from the borders
      let avoidBorders = this.avoidBorders(boid);

      // Regular boids die of old age, a lifespan of 0 makes them immortal
      if ( !boid.isPredator && !boid.isDead ) {
        boid.age++;
        if ( this.boidLifespan > 0 && boid.age >= this.boidLifespan * (1000 / this.stepDuration) * boid.lifespanFactor * boid.geneCost ) {
          boid.isDead = true;
          this.rememberGenes(boid);
        }
      }

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
          // Remove the starving predator, or the boid dead of old age
          boid.quadtree.remove(boid);
          if ( boid.isPredator ) {
            this.predators = this.predators.filter(predator => predator !== boid);
          } else {
            this.boids = this.boids.filter(other => other !== boid);
          }
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


        // Steer away from the obstacles drawn with the mouse
        const avoidObstacles = this.avoidObstacles(boid);

        let velocityChangeX = (separation.x + alignment.x + cohesion.x + avoidBorders.x + fleePredators.x * this.fleeFactor + avoidObstacles.x * this.obstacleAvoidanceForce);
        let velocityChangeY = (separation.y + alignment.y + cohesion.y + avoidBorders.y + fleePredators.y * this.fleeFactor + avoidObstacles.y * this.obstacleAvoidanceForce);

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

      } else if ( boid.isSuper ) {

        this.moveSuperPredator(boid, avoidBorders);

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

          if (boid.predationCounter! >= ( this.starvationThreshold * ( 11 + +this.predatorStarvationModificator )/10 * boid.geneCost ) ) {
            boid.isDead = true;
            this.rememberGenes(boid);
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
                  this.rememberGenes(closestBoid);
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

        // Predators flee the Super Predators, whatever they were doing
        const threat = this.closestSuperPredator(boid);
        if ( threat !== null ) {
          const away = this.calculateDirection(threat.position, boid.position);
          chase = { x: away.x, y: away.y };
          maxVelocity = boid.genome.maxVelocity;
          maxSteeringForce = this.predatorMaxSteeringForce * 1.5;
        }

        if ( chase.x == 0 && chase.y == 0 && this.totalBoids != 0 ) {
          // Update predator's velocity to move towards the last Boid Birth Position
          chase.x += ((this.lastBoidBirthPosition.x - boid.position.x) + avoidBorders.x) * maxVelocity;
          chase.y += ((this.lastBoidBirthPosition.y - boid.position.y) + avoidBorders.y) * maxVelocity;
        }

        // Steer away from the obstacles: the chase grows with the distance to the prey, so does the avoidance,
        // otherwise a predator would press against a wall hiding its prey instead of keeping a small distance
        const avoidObstacles = this.avoidObstacles(boid);
        const avoidanceWeight = this.obstacleAvoidanceForce * Math.max(1, Math.sqrt(chase.x ** 2 + chase.y ** 2));

        let velocityChangeX = (separation.x + chase.x + avoidObstacles.x * avoidanceWeight);
        let velocityChangeY = (separation.y + chase.y + avoidObstacles.y * avoidanceWeight);

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
    
      // Update position based on velocity, carried by the currents, without crossing the obstacles
      const flow = this.currentFlow(boid);
      let newPosition: Point = { x: boid.position.x + boid.velocity.x + flow.x, y: boid.position.y + boid.velocity.y + flow.y };
      if ( !this.obstacles.isEmpty ) {
        newPosition = this.collideWithObstacles(boid, newPosition);
      }

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

  // A Super Predator hunts the closest boid or predator, until its lifetime is over
  moveSuperPredator(superPredator: Boid, avoidBorders: Point) {
    superPredator.age++;
    if ( superPredator.age >= this.superPredatorLifetime * (1000 / this.stepDuration) ) {
      superPredator.isDead = true;
      return;
    }

    const steering = { x: avoidBorders.x, y: avoidBorders.y };
    const target = this.closestTargetOfSuperPredator(superPredator);
    if ( target !== null ) {
      if ( this.calculateDistanceSquared(superPredator.position, target.position) < this.superPredatorCaptureDistance ** 2 ) {
        this.devour(target);
      } else {
        // It anticipates the movement of its target
        const direction = this.calculateDirection(superPredator.position, {
          x: target.position.x + target.velocity.x * 5,
          y: target.position.y + target.velocity.y * 5,
        });
        steering.x += direction.x;
        steering.y += direction.y;
      }
    }

    // Steer away from the obstacles, like the other predators
    const avoidObstacles = this.avoidObstacles(superPredator);
    steering.x += avoidObstacles.x * this.obstacleAvoidanceForce;
    steering.y += avoidObstacles.y * this.obstacleAvoidanceForce;

    // Limit the steering force, then the velocity
    const steeringSquared = steering.x ** 2 + steering.y ** 2;
    if ( steeringSquared > this.superPredatorMaxSteeringForce ** 2 ) {
      const ratio = this.superPredatorMaxSteeringForce / Math.sqrt(steeringSquared);
      steering.x *= ratio;
      steering.y *= ratio;
    }
    superPredator.velocity.x += steering.x;
    superPredator.velocity.y += steering.y;
    const speedSquared = superPredator.velocity.x ** 2 + superPredator.velocity.y ** 2;
    if ( speedSquared > superPredator.genome.maxVelocity ** 2 ) {
      const ratio = superPredator.genome.maxVelocity / Math.sqrt(speedSquared);
      superPredator.velocity.x *= ratio;
      superPredator.velocity.y *= ratio;
    }
  }

  closestTargetOfSuperPredator(superPredator: Boid): Boid | null {
    let closest: Boid | null = null;
    let closestDistance = Infinity;
    for (const group of [this.boids, this.predators]) {
      for (const other of group) {
        if ( other.isDead || other.isSuper ) {
          continue;
        }
        const distance = this.calculateDistanceSquared(superPredator.position, other.position);
        if ( distance < closestDistance ) {
          closestDistance = distance;
          closest = other;
        }
      }
    }
    return closest;
  }

  // An eaten boid disappears, an eaten predator fades away
  devour(target: Boid) {
    if ( target.preyLink !== null ) {
      target.preyLink.preyLink = null;
    }
    if ( target.isPredator ) {
      target.isDead = true;
    } else {
      target.quadtree.remove(target);
      this.boids = this.boids.filter(other => other !== target);
    }
    this.rememberGenes(target);
  }

  // The closest Super Predator a predator should flee, if any
  closestSuperPredator(predator: Boid): Boid | null {
    let closest: Boid | null = null;
    let closestDistance = this.superFleeRadius ** 2;
    for (const other of this.predators) {
      if ( other.isSuper && !other.isDead ) {
        const distance = this.calculateDistanceSquared(predator.position, other.position);
        if ( distance < closestDistance ) {
          closestDistance = distance;
          closest = other;
        }
      }
    }
    return closest;
  }

  // Boids and predators steer away from the obstacles near them, the closer the stronger
  avoidObstacles(boid: Boid): Point {
    const avoid = { x: 0, y: 0 };
    if ( this.obstacles.isEmpty ) {
      return avoid;
    }
    for (const segment of this.obstacles.near(boid.position)) {
      const closest = SegmentField.closestPoint(boid.position, segment);
      const distance = Math.sqrt(SegmentField.distanceSquared(boid.position, closest));
      if ( distance > 0 && distance < this.obstacleAvoidRadius ) {
        const weight = (1 - distance / this.obstacleAvoidRadius) / distance;
        avoid.x += (boid.position.x - closest.x) * weight;
        avoid.y += (boid.position.y - closest.y) * weight;
      }
    }
    return avoid;
  }

  // Currents carry the boids faster than they swim, and slowly turn them in their direction
  currentFlow(boid: Boid): Point {
    const flow = { x: 0, y: 0 };
    if ( this.currents.isEmpty ) {
      return flow;
    }
    for (const segment of this.currents.near(boid.position)) {
      const closest = SegmentField.closestPoint(boid.position, segment);
      const distance = Math.sqrt(SegmentField.distanceSquared(boid.position, closest));
      if ( distance < this.currentRadius ) {
        const direction = this.calculateDirection(segment.a, segment.b);
        const weight = 1 - distance / this.currentRadius;
        flow.x += direction.x * weight;
        flow.y += direction.y * weight;
      }
    }
    const magnitude = Math.sqrt(flow.x ** 2 + flow.y ** 2);
    if ( magnitude === 0 ) {
      return flow;
    }
    // Near the joints of a line, the segments don't add up beyond the strength of the current
    const strength = this.currentStrength * Math.min(1, magnitude) / magnitude;
    flow.x *= strength;
    flow.y *= strength;
    if ( !boid.isDead ) {
      boid.velocity.x += flow.x * this.currentAlignment;
      boid.velocity.y += flow.y * this.currentAlignment;
    }
    return flow;
  }

  // Obstacles can't be crossed: a boid about to cross one slides along it instead
  collideWithObstacles(boid: Boid, target: Point): Point {
    const start = boid.position;
    const segments = this.obstacles.near(start);
    const hit = segments.find(segment => SegmentField.crosses(start, target, segment));
    if ( hit === undefined ) {
      return target;
    }

    // Only the part of the move and of the velocity along the wall is kept
    const wall = this.calculateDirection(hit.a, hit.b);
    const along = (target.x - start.x) * wall.x + (target.y - start.y) * wall.y;
    const velocityAlong = boid.velocity.x * wall.x + boid.velocity.y * wall.y;
    boid.velocity = { x: wall.x * velocityAlong, y: wall.y * velocityAlong };

    // Pushed slightly away from the wall, on its own side, so it never ends up exactly on the line
    const away = this.calculateDirection(SegmentField.closestPoint(start, hit), start);
    const slid = { x: start.x + wall.x * along + away.x * 0.5, y: start.y + wall.y * along + away.y * 0.5 };
    return segments.some(segment => SegmentField.crosses(start, slid, segment)) ? start : slid;
  }

  dealWithDepletion() {
    // In Infinite mode, a few boids left can neither reproduce nor let the reinforcements come, so they arrive under a threshold
    const boidsDepleted = this.simulationMode === "Infinite" ? this.totalBoids < this.infiniteMinBoids : this.totalBoids === 0;
    if ( boidsDepleted || this.totalPredators === 0 ) {
      if ( this.simulationMode === "DeathMatch" ) {
        this.pauseSimulation = true;
      } else if ( this.simulationMode === "Retry" ) {
        this.restartSimulation();
      } else if ( this.simulationMode === "Infinite" ) {
        if ( boidsDepleted ) {
          // Enough reinforcements to get back above the threshold at once
          const numberToAdd = Math.max(4, this.infiniteMinBoids - this.totalBoids, Math.min(100,this.totalPredators));
          const heritages = this.inheritGenes(false, Math.ceil(numberToAdd));
          // Add boids with random positions and velocities
          for (let i = 0; i < numberToAdd; i++) {
            // Determine whether the new boid should be placed on a vertical or horizontal boundary
            const onVerticalBoundary = Math.random() < 0.5;

            // Determine the position on the boundary
            let position;
            if (onVerticalBoundary) {
              // Place on the left or right boundary
              position = {
                x: Math.random() < 0.5 ? 2 : this.containerWidth - 2,
                y: Math.random() * this.containerHeight,
              };
            } else {
              // Place on the top or bottom boundary
              position = {
                x: Math.random() * this.containerWidth,
                y: Math.random() < 0.5 ? 2 : this.containerHeight - 2,
              };
            }
            const { genome, generation } = heritages[i];
            this.insertNewBoid (
              position,
              { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
              false,
              genome,
              Math.random() * this.boidReproductionRate,
              this.quadtree,
              generation
            );
          }
        } else {
          const numberToAdd = Math.max(2,Math.min(20,this.totalBoids/20));
          const heritages = this.inheritGenes(true, Math.ceil(numberToAdd));
          // Add boids with random positions and velocities
          for (let i = 0; i < numberToAdd; i++) {
            // Determine whether the new boid should be placed on a vertical or horizontal boundary
            const onVerticalBoundary = Math.random() < 0.5;

            // Determine the position on the boundary
            let position;
            if (onVerticalBoundary) {
              // Place on the left or right boundary
              position = {
                x: Math.random() < 0.5 ? 2 : this.containerWidth - 2,
                y: Math.random() * this.containerHeight,
              };
            } else {
              // Place on the top or bottom boundary
              position = {
                x: Math.random() * this.containerWidth,
                y: Math.random() < 0.5 ? 2 : this.containerHeight - 2,
              };
            }
            const { genome, generation } = heritages[i];
            this.insertNewBoid (
              position,
              { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
              true,
              genome,
              Math.random() * this.predatorReproductionRate,
              this.quadtree,
              generation
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

    this.varyAtBirth(genome, parent.isPredator);

    // Rare and larger mutations
    const evolutionChances = parent.isPredator ? this.predatorEvolutionChances/100 : this.boidEvolutionChances/100;
    const isMutant = Math.random() <= evolutionChances;
    if ( isMutant ) {
      this.mutate(genome, parent.isPredator);
    }

    const child = this.insertNewBoid (
      { x: parent.position.x, y: parent.position.y },
      { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      parent.isPredator,
      genome,
      genome.reproductionRate * 2,
      parent.quadtree,
      Math.max(parent.generation, partner.generation) + 1,
      isMutant
    );

    // A ring spreads around the newborn mutant
    if ( isMutant && child !== null ) {
      this.mutantHalos.push({ boid: child, start: performance.now() });
    }
  }

  // Remember the genes of the last dead individuals, so the reinforcements of an extinct species can inherit them
  rememberGenes ( boid: Boid ) {
    const pool = boid.isPredator ? this.predatorGenePool : this.boidGenePool;
    pool.push({ genome: boid.genome, generation: boid.generation });
    if ( pool.length > this.genePoolSize ) {
      pool.shift();
    }
  }

  // Genes for a group of reinforcements: copied from living individuals, or from recently dead ones if the species is extinct
  // They are all picked before any insertion, otherwise the first reinforcement would be the only living source of the others
  inheritGenes ( isPredator: boolean, count: number ): Heritage[] {
    const living = isPredator ? this.predators.filter(predator => !predator.isDead && !predator.isSuper) : this.boids;
    const pool: Heritage[] = living.length > 0 ? living : (isPredator ? this.predatorGenePool : this.boidGenePool);
    return Array.from({ length: count }, () => {
      if ( pool.length === 0 ) {
        return { genome: this.createGenome(isPredator), generation: 0 };
      }
      const source = pool[Math.floor(Math.random() * pool.length)];
      return { genome: { ...source.genome }, generation: source.generation };
    });
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
    const gene: keyof Genome = Math.random() < 0.5 ? 'maxVelocity' : 'reproductionRate';
    this.setGene(genome, gene, isPredator, genome[gene] * (Math.random() < 0.5 ? 1 + evolutionStep : 1 - evolutionStep));
  }

  // Small random variation of every gene at each birth, so natural selection always has some diversity to work on
  varyAtBirth ( genome: Genome, isPredator: boolean ) {
    const variation = this.birthVariation / 100;
    for (const gene of ['maxVelocity', 'reproductionRate'] as const) {
      this.setGene(genome, gene, isPredator, genome[gene] * (1 + (Math.random() * 2 - 1) * variation));
    }
  }

  // Set a gene, kept within the evolution cap around the species default
  setGene ( genome: Genome, gene: keyof Genome, isPredator: boolean, value: number ) {
    const evolutionCap = (isPredator ? this.predatorEvolutionCap : this.boidEvolutionCap) / 100;
    const defaultValue = gene === 'maxVelocity'
      ? (isPredator ? this.predatorMaxVelocity : this.boidMaxVelocity)
      : (isPredator ? this.predatorReproductionRate : this.boidReproductionRate);
    genome[gene] = Math.min(defaultValue * (1 + evolutionCap), Math.max(defaultValue * (1 - evolutionCap), value));
  }

  // Trade-off of the genes: faster or more fertile boids live shorter, more fertile predators starve faster
  // (fast predators already get hungry faster). With a cost above 1, the best genes depend on the predation:
  // boids that are eaten young gain from living fast, boids that die of old age gain from living long
  calculateGeneCost ( genome: Genome, isPredator: boolean ): number {
    const speed = isPredator ? 0 : genome.maxVelocity / this.boidMaxVelocity - 1;
    const fertility = 1 - genome.reproductionRate / (isPredator ? this.predatorReproductionRate : this.boidReproductionRate);
    return Math.max(this.minGeneCost, 1 - this.geneCostFactor * (speed + fertility));
  }

  // Normalized deviation of a gene from its species default, in [-1, 1], used to color the boid
  geneTrait ( value: number, defaultValue: number ): number {
    return Math.max(-1, Math.min(1, (value / defaultValue - 1) / this.traitScale));
  }

  insertNewBoid ( position: Point, velocity: Point, isPredator: boolean, genome: Genome,
    reproductionCooldown: number, quadtree: Quadtree, generation: number = 0, isMutant: boolean = false ): Boid | null {
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
          isSuper: false,
          generation: generation,
          isMutant: isMutant,
          age: 0,
          lifespanFactor: 0.8 + Math.random() * 0.4,
          geneCost: this.calculateGeneCost(genome, isPredator),
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
        return boid;
      } else {
        this.errorMessage = "Boid not created, FPS too low !";
        this.errorFadeOut = 50;
        this.dealWithLowFPS();
      }
    }
    return null;
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
      this.rememberGenes(boidToRemove!);
    }
  }

  tryToReproduce(boid: Boid) {
    const reproductionRadiusSquared = this.reproductionRadius**2;
    const reproductionPartners = this.boids.filter(otherBoid => {
      if ( otherBoid === boid || otherBoid.isDead ) {
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

      // Logistic growth: the more crowded the screen, the lower the chances, down to 0 at its carrying capacity
      const carryingCapacity = this.containerWidth * this.containerHeight / this.areaPerBoid;
      const crowding = Math.max(0, 1 - this.boids.length / carryingCapacity);
      if ( Math.random() <= this.boidReproductionChances/100 * crowding ) {
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
    const dotProduct = velocity1.x * velocity2.x + velocity1.y * velocity2.y;
    const magnitudesProduct = Math.sqrt(velocity1.x ** 2 + velocity1.y ** 2) * Math.sqrt(velocity2.x ** 2 + velocity2.y ** 2);
    if ( magnitudesProduct === 0 ) {
      return false;
    }
    // Clamp to avoid NaN from floating point rounding
    const cosineSimilarity = Math.max(-1, Math.min(1, dotProduct / magnitudesProduct));
    return Math.acos(cosineSimilarity) < this.partnerAngleThreshold;
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

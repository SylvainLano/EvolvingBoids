import { Component, OnInit, OnDestroy, ElementRef, NgZone, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Quadtree } from '../classes/Quadtree';
import { Boid, Point } from '../classes/Boid';
import { CanvasRenderer, MutantHalo } from '../classes/CanvasRenderer';
import { SegmentField } from '../classes/SegmentField';
import { boidColor } from '../classes/BoidColor';
import { DemoMode } from '../classes/DemoMode';
import { ChartRenderer } from '../classes/ChartRenderer';
import { Simulation } from '../classes/Simulation';

// What a click or a drag with the mouse does
type Tool = 'boid' | 'predator' | 'superPredator' | 'obstacle' | 'current' | 'eraser' | 'food';

type OptionsPanel = 'Simulation' | 'Display' | 'Boids' | 'Predator';

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
  energy: string | null;      // regular boids, with plankton
}

// The display of the simulation and its controls: the animation loop, the mouse tools, the options
@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.sass'],
})
export class MainComponent implements OnInit, OnDestroy {
  readonly sim = new Simulation();
  demo = new DemoMode(this);

  // Display
  renderer: 'canvas' | 'dom' = 'canvas';        // the DOM renderer is kept to compare performances
  darkMode = false;
  glow = true;                                  // additive blending and halos with the canvas renderer, in dark mode
  drawQuadtree = true;
  displayQuadtreeCount = true;
  displayFPSCount = false;
  displayBoidCount = true;
  displayCharts = true;                         // live charts of the populations, of the plankton and of the average genes
  readonly optionsPanels: OptionsPanel[] = ['Simulation', 'Display', 'Boids', 'Predator'];
  openOptions: OptionsPanel | null = null;      // only one panel of options is open at a time
  finalQuadtreeList: Quadtree[] = [];

  // Speed: the simulation advances by fixed steps, so its speed doesn't depend on the screen refresh rate
  timeScale = 1;                                // number of simulated seconds per real second
  readonly timeScales = [1, 2, 4, 8];
  readonly maxStepsPerFrame = 4;                // maximum number of steps computed for a single frame, at normal speed
  private stepAccumulator = 0;
  private lastStepTime = performance.now();

  fps = 60;
  private fpsValues: number[] = [];
  private lastFrameTime = performance.now();
  private readonly fpsUpdateInterval = 100;

  // Mouse tools, selected in the tool bar or with the keys 1 to 7
  tool: Tool = 'predator';
  readonly tools: { id: Tool, label: string, title: string }[] = [
    { id: 'boid', label: 'Boid', title: 'Click to add a boid' },
    { id: 'predator', label: 'Predator', title: 'Click to add a predator' },
    { id: 'superPredator', label: 'Super Predator', title: 'Click to add a super predator: it hunts boids and predators for 45 seconds' },
    { id: 'obstacle', label: 'Obstacle', title: 'Drag to draw a wall the boids can\'t cross' },
    { id: 'current', label: 'Current', title: 'Drag to draw a current carrying the boids along' },
    { id: 'eraser', label: 'Eraser', title: 'Hold and move to remove boids, obstacles, currents and plankton' },
    { id: 'food', label: 'Food', title: 'Hold and move to sow plankton, it fades away out of the fertile areas' },
  ];
  readonly eraserRadius = 30;
  readonly sowRadius = 40;
  readonly sowQuantity = 0.05;                  // food added per frame at the center of the sowing area
  private readonly strokeStep = 12;             // minimum distance in px between two points of a drawn line
  private stroke: { kind: 'obstacle' | 'current', points: Point[] } | null = null;   // the line being drawn
  private mousePressed = false;
  private pointerPosition: Point | null = null; // the mouse position, even while it doesn't scare the boids

  // Inspection of a boid, while Shift is held
  inspecting = false;
  readonly inspectRadius = 30;                  // distance in px from the mouse to pick a boid to inspect
  inspectedBoid: Boid | null = null;
  inspection: Inspection | null = null;
  mutantHalos: MutantHalo[] = [];

  readonly uiRefreshInterval = 200;             // delay in ms between two refreshes of the counters, messages and charts
  private readonly sizeCheckInterval = 500;     // delay in ms between two checks of the window size
  private lastUiRefresh = 0;
  private lastChartRefresh = 0;
  private lastSizeCheck = 0;
  private canvasRenderer!: CanvasRenderer;
  private chartRenderer!: ChartRenderer;
  private frameRequest = 0;
  private destroyed = false;
  private listeners: { target: EventTarget, type: string, handler: EventListener }[] = [];
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('boidCanvas', { static: true }) boidCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(private el: ElementRef, private ngZone: NgZone, private cdr: ChangeDetectorRef) {
    // A ring spreads around each newborn mutant, in real time so it stays visible when the simulation is sped up
    this.sim.onMutantBirth = (boid) => this.mutantHalos.push({ boid, start: performance.now() });
  }

  ngOnInit(): void {
    this.canvasRenderer = new CanvasRenderer(this.boidCanvas.nativeElement);
    this.chartRenderer = new ChartRenderer(this.chartCanvas.nativeElement);
    this.restart();

    // The animation loop and the listeners run outside of Angular, so they don't trigger a change detection
    // of the whole application at each frame or mouse move: the view is refreshed on demand in render()
    this.ngZone.runOutsideAngular(() => {
      this.listen(document, 'mousemove', (event: MouseEvent) => this.handleMouseMove(event));
      this.listen(document, 'click', (event: MouseEvent) => this.handleMouseClick(event));
      this.listen(document, 'mousedown', (event: MouseEvent) => this.handleMouseDown(event));
      this.listen(window, 'mouseup', () => this.handleMouseUp());
      this.listen(document.documentElement, 'mouseleave', () => this.sim.mousePosition = this.pointerPosition = null);
      this.listen(document, 'keydown', (event: KeyboardEvent) => this.handleKeyDown(event));
      this.listen(document, 'keyup', (event: KeyboardEvent) => {
        if ( event.key === 'Shift' ) {
          this.setInspecting(false);
        }
      });
      this.listen(document, 'visibilitychange', () => this.demo.onVisibilityChange());
      this.listen(document, 'fullscreenchange', () => this.demo.onFullscreenChange());

      // The demo can be started directly with an url like index.html?demo
      if (new URLSearchParams(window.location.search).has('demo')) {
        this.demo.start(false);
      }

      this.frameRequest = requestAnimationFrame((timestamp) => this.frame(timestamp));
    });
  }

  // The loop and the listeners stop with the component
  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameRequest);
    for (const { target, type, handler } of this.listeners) {
      target.removeEventListener(type, handler);
    }
    this.listeners = [];
    this.demo.stop();
  }

  private listen<E extends Event>(target: EventTarget, type: string, handler: (event: E) => void) {
    target.addEventListener(type, handler as EventListener);
    this.listeners.push({ target, type, handler: handler as EventListener });
  }

  private containerSize(): { width: number, height: number } {
    const container: HTMLElement = this.el.nativeElement.querySelector('.main-container');
    return { width: container.offsetWidth, height: container.offsetHeight };
  }

  restart() {
    const { width, height } = this.containerSize();
    this.sim.initialize(width, height);
    this.mutantHalos = [];
  }

  toggleOptions(panel: OptionsPanel) {
    this.openOptions = this.openOptions === panel ? null : panel;
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

  handleMouseMove(event: MouseEvent) {
    // In demo mode, the mouse only reveals how to exit
    if ( this.demo.active ) {
      this.demo.onMouseMove();
      return;
    }
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

  get toolDraws(): boolean {
    return this.tool === 'obstacle' || this.tool === 'current' || this.tool === 'eraser' || this.tool === 'food';
  }

  handleMouseDown(event: MouseEvent) {
    if ( this.demo.active || event.button !== 0 || this.isOnInterface(event) ) {
      return;
    }
    this.mousePressed = true;
    const point = { x: event.clientX, y: event.clientY };
    if ( this.tool === 'obstacle' || this.tool === 'current' ) {
      this.stroke = { kind: this.tool, points: [point] };
    } else {
      this.applyHeldTool(point);
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
      (this.stroke.kind === 'obstacle' ? this.sim.obstacles : this.sim.currents).add(points);
      this.stroke = null;
    }
    this.mousePressed = false;
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
      this.sim.insertNewBoid(
        position,
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        isPredator,
        this.sim.createGenome(isPredator),
        0
      );
    } else if ( this.tool === 'superPredator' ) {
      this.sim.addSuperPredator(position);
    }
  }

  // The eraser and the food act as long as the mouse is held, even without moving
  private applyHeldTool(point: Point) {
    if ( this.tool === 'eraser' ) {
      this.sim.erase(point, this.eraserRadius);
    } else if ( this.tool === 'food' ) {
      this.sim.food.sow(point, this.sowRadius, this.sowQuantity);
    }
  }

  // While Shift is held, the mouse inspects the boids instead of scaring them
  setInspecting(inspecting: boolean) {
    this.inspecting = inspecting && !this.demo.active;
    this.sim.mousePosition = this.inspecting || !this.toolScares ? null : this.pointerPosition;
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
    for (const boid of [...this.sim.boids, ...this.sim.predators]) {
      const distance = this.sim.calculateDistanceSquared(boid.position, pointer);
      if ( !boid.isDead && distance < closestDistance ) {
        closestDistance = distance;
        this.inspectedBoid = boid;
      }
    }
    const boid = this.inspectedBoid;
    if ( boid === null ) {
      return;
    }

    const sim = this.sim;
    const percent = (ratio: number) => `${ratio >= 0 ? '+' : ''}${Math.round(ratio * 100)} %`;
    const seconds = (steps: number) => Math.round(steps / sim.stepsPerSecond);
    let lifeLabel: string;
    let life: string;
    if ( boid.isSuper ) {
      lifeLabel = 'Lifetime';
      life = `${seconds(boid.age)} s / ${sim.superPredatorLifetime} s`;
    } else if ( boid.isPredator ) {
      const starvation = sim.starvationThreshold * ( 11 + +sim.predatorStarvationModificator )/10 * boid.geneCost;
      lifeLabel = 'Hunger';
      life = boid.reproductionCooldown > 0 ? 'digesting' : `${Math.round(100 * boid.predationCounter / starvation)} %`;
    } else {
      lifeLabel = 'Age';
      life = sim.boidLifespan > 0
        ? `${seconds(boid.age)} s / ${Math.round(sim.boidLifespan * boid.lifespanFactor * boid.geneCost)} s`
        : `${seconds(boid.age)} s / immortal`;
    }

    // The card stays inside the window
    const cardWidth = 230;
    const cardHeight = 110;
    this.inspection = {
      x: pointer.x + 16 + cardWidth > sim.width ? pointer.x - 16 - cardWidth : pointer.x + 16,
      y: pointer.y + 16 + cardHeight > sim.height ? pointer.y - 16 - cardHeight : pointer.y + 16,
      title: boid.isSuper
        ? 'Super Predator'
        : `${boid.isPredator ? 'Predator' : 'Boid'} - Generation ${boid.generation}${boid.isMutant ? ' - Mutant' : ''}`,
      color: boidColor(boid.isPredator, false, boid.speedTrait, boid.fertilityTrait, 1, this.darkMode, 1, boid.isSuper),
      speed: percent(boid.genome.maxVelocity / (boid.isPredator ? sim.predatorMaxVelocity : sim.boidMaxVelocity) - 1),
      fertility: boid.isSuper
        ? '-'
        : percent(1 - boid.genome.reproductionRate / (boid.isPredator ? sim.predatorReproductionRate : sim.boidReproductionRate)),
      lifeLabel,
      life,
      energy: sim.foodEnabled && !boid.isPredator ? `${Math.round(boid.energy * 100)} %` : null,
    };
  }

  // Animation loop
  private frame(timestamp: number) {
    if ( this.destroyed ) {
      return;
    }
    this.demo.update(timestamp);

    // The size of the window is checked regularly, it changes with a resize, the fullscreen, or a page shown for the first time
    if ( timestamp - this.lastSizeCheck >= this.sizeCheckInterval ) {
      this.lastSizeCheck = timestamp;
      const { width, height } = this.containerSize();
      this.sim.resize(width, height);
    }

    if ( this.mousePressed && this.pointerPosition !== null && !this.demo.active ) {
      this.applyHeldTool(this.pointerPosition);
    }

    // The time scale runs more steps per frame to speed up the simulation
    // Long gaps (hidden tab, very slow frame) are not caught up, to avoid a burst of steps
    const stepDuration = this.sim.stepDuration;
    const elapsed = (timestamp - this.lastStepTime) * this.timeScale;
    this.stepAccumulator += Math.max(0, Math.min(elapsed, stepDuration * this.maxStepsPerFrame * this.timeScale));
    this.lastStepTime = timestamp;
    while (this.stepAccumulator >= stepDuration) {
      this.sim.step();
      this.stepAccumulator -= stepDuration;
    }

    this.updateFPS(timestamp);
    this.render(timestamp);

    this.frameRequest = requestAnimationFrame((nextTimestamp) => this.frame(nextTimestamp));
  }

  private updateFPS(timestamp: number) {
    const elapsed = timestamp - this.lastFrameTime;
    this.fpsValues.push(1000 / elapsed);

    // The average FPS is updated a few times per second, boids are not created when it is too low
    if (elapsed > this.fpsUpdateInterval) {
      this.fps = Math.round(this.fpsValues.reduce((sum, fps) => sum + fps, 0) / this.fpsValues.length);
      this.sim.fps = this.fps;
      this.sim.errorFadeOut = Math.max(0, this.sim.errorFadeOut - 1);
      if ( this.fps >= this.sim.minFPS && this.sim.errorFadeOut == 0 ) {
        this.sim.errorMessage = '';
      }
      this.fpsValues = [];
      this.lastFrameTime = timestamp;
    }
  }

  render(timestamp: number) {
    const now = performance.now();
    this.mutantHalos = this.mutantHalos.filter(halo => now - halo.start < this.canvasRenderer.mutantHaloDuration);
    this.updateInspection();
    this.finalQuadtreeList = this.drawQuadtree ? this.sim.quadtree.retrieveFinalQuadtrees() : [];

    // The world is always drawn on the canvas, the boids only with the Canvas renderer: with the DOM one, they are HTML elements above it
    const sim = this.sim;
    this.canvasRenderer.render(
      this.renderer === 'canvas' ? [sim.boids, sim.predators] : [],
      this.drawQuadtree ? this.finalQuadtreeList : null,
      { darkMode: this.darkMode, glow: this.glow, displayQuadtreeCount: this.displayQuadtreeCount },
      this.mutantHalos,
      this.inspectedBoid,
      {
        food: sim.foodEnabled
          ? { texture: sim.food.texture(this.darkMode), width: sim.food.cols * sim.food.cellSize, height: sim.food.rows * sim.food.cellSize }
          : null,
        obstacles: sim.obstacles.polylines,
        currents: sim.currents.polylines,
        currentWidth: sim.currentRadius * 2,
        stroke: this.stroke,
        eraser: this.tool === 'eraser' && this.pointerPosition !== null && !this.demo.active
          ? { position: this.pointerPosition, radius: this.eraserRadius }
          : null,
      }
    );

    // The view is refreshed at each frame for the DOM renderer, and only a few times per second for the counters otherwise
    // While inspecting, the card follows the mouse at each frame too
    if (this.renderer === 'dom' || this.inspection !== null || timestamp - this.lastUiRefresh >= this.uiRefreshInterval) {
      this.lastUiRefresh = timestamp;
      this.cdr.detectChanges();
    }

    // The charts only change once per simulated second
    if (this.displayCharts && !this.demo.active && timestamp - this.lastChartRefresh >= this.uiRefreshInterval) {
      this.lastChartRefresh = timestamp;
      this.chartRenderer.render(sim.stats.samples, this.darkMode);
    }
  }
}

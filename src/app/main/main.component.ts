import { Component, OnInit, OnDestroy, ElementRef, ChangeDetectorRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { BoidComponent } from '../boid/boid.component';
import { Quadtree } from '../classes/Quadtree';
import { Boid, Point } from '../classes/Boid';
import { CanvasRenderer, MutantHalo } from '../classes/CanvasRenderer';
import { SegmentField } from '../classes/SegmentField';
import { boidColor } from '../classes/BoidColor';
import { DemoMode } from '../classes/DemoMode';
import { ChartRenderer } from '../classes/ChartRenderer';
import { Simulation } from '../classes/Simulation';
import { Challenge, ChallengeRunner, clock } from '../classes/Challenges';
import { Tool } from '../classes/Tool';
import { Explainer, ExplanationArea, isArea } from '../classes/Explainer';

type OptionsPanel = 'Simulation' | 'Display' | 'Boids' | 'Predator' | 'Challenges';

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
  imports: [NgClass, FormsModule, MatSliderModule, BoidComponent],
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.sass'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MainComponent implements OnInit, OnDestroy {
  readonly sim = new Simulation();
  demo = new DemoMode(this);
  challenges = new ChallengeRunner(this.sim, () => this.restart());
  readonly clock = clock;
  explainer = new Explainer();
  explanationPosition: Point | null = null;     // where the bubble of the explanation is drawn
  explanationProgress = 0;                      // part of the reading time elapsed, from 0 to 1
  explained: Boid | ExplanationArea | null = null;
  private explanationStart = -1;
  private explanationPoint: Point | null = null;  // where the subject of the bubble was when it appeared, null for the charts
  private explanationMargin = 30;
  explainGlows = !MainComponent.explainSeen();  // on the first visit, the Explain button glows to catch the eye
  private static readonly explainSeenKey = 'evolvingboids.explainSeen';

  // Display
  renderer: 'canvas' | 'dom' = 'canvas';        // the DOM renderer is kept to compare performances
  darkMode = true;                              // the boids glow beautifully on a dark sea
  glow = true;                                  // additive blending and halos with the canvas renderer, in dark mode
  drawQuadtree = false;
  displayQuadtreeCount = true;
  displayFPSCount = false;
  displayBoidCount = true;
  displayCharts = true;                         // live charts of the populations, of the plankton and of the average genes
  readonly optionsPanels: OptionsPanel[] = ['Simulation', 'Display', 'Boids', 'Predator', 'Challenges'];
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
  readonly inspectionStillDelay = 250;          // in ms without moving the mouse before the card stands still
  private lastPointerMove = 0;
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

  constructor(private el: ElementRef, private cdr: ChangeDetectorRef) {
    this.sim.onEvent = (event) => {
      // A ring spreads around each newborn mutant, in real time so it stays visible when the simulation is sped up
      if ( event.type === 'mutant' ) {
        this.mutantHalos.push({ boid: event.boid, start: performance.now() });
      }
      if ( !this.demo.active ) {
        this.explainer.notify(event, performance.now());
      }
    };
  }

  ngOnInit(): void {
    this.canvasRenderer = new CanvasRenderer(this.boidCanvas.nativeElement);
    this.chartRenderer = new ChartRenderer(this.chartCanvas.nativeElement);
    this.restart();

    // Angular runs without zone.js: the animation loop and these listeners don't trigger any change detection
    // at each frame or mouse move, the view is refreshed on demand in render()
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

  // During a challenge, restarting means trying the challenge again
  restartButton() {
    if ( this.challenges.active !== null ) {
      this.challenges.retry();
    } else {
      this.restart();
    }
  }

  startChallenge(challenge: Challenge) {
    this.challenges.start(challenge);
    this.openOptions = null;
    if ( !this.challenges.isAllowed(this.tool) ) {
      this.selectTool(challenge.tools[0]);
    }
  }

  toggleOptions(panel: OptionsPanel) {
    this.openOptions = this.openOptions === panel ? null : panel;
  }

  toggleExplain() {
    this.explainer.setEnabled(!this.explainer.enabled, performance.now(), this.sim, this.displayCharts);
    if ( this.explainGlows ) {
      this.explainGlows = false;
      try {
        localStorage.setItem(MainComponent.explainSeenKey, 'true');
      } catch {
        // Not remembered: the button will glow again on the next visit
      }
    }
  }

  // Whether the visitor already used the Explain mode, the browser may refuse to tell (private browsing...)
  private static explainSeen(): boolean {
    try {
      return localStorage.getItem(MainComponent.explainSeenKey) === 'true';
    } catch {
      return false;
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'Shift') {
      this.setInspecting(true);
      return;
    }
    // Enter shows the next explanation, instead of clicking the focused button
    if (event.key === 'Enter' && this.explainer.current !== null) {
      event.preventDefault();
      this.nextExplanation();
      return;
    }
    if (/^[1-9]$/.test(event.key) && !this.demo.active) {
      const tool = this.tools[Number(event.key) - 1];
      if (tool) {
        this.selectTool(tool.id);
      }
    } else if ((event.key === 'e' || event.key === 'E') && !this.demo.active) {
      this.toggleExplain();
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
    this.lastPointerMove = performance.now();
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
    return typeof target?.closest === 'function' && target.closest('.display-container, .tool-bar, .challenge-card, .explain-bubble') !== null;
  }

  // Some tools are not allowed during a challenge
  selectTool(tool: Tool) {
    if ( !this.challenges.isAllowed(tool) ) {
      return;
    }
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
    // During a challenge, some tools can only be used a few times
    if ( this.isOnInterface(event) || !this.toolScares || !this.challenges.use(this.tool) ) {
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
  // When the mouse stops, the card stays on the last boid and stands still to be read, while its boid stays circled
  updateInspection() {
    const pointer = this.pointerPosition;
    if ( !this.inspecting || pointer === null || this.demo.active ) {
      this.inspectedBoid = null;
      this.inspection = null;
      return;
    }
    const still = this.inspection !== null && this.inspectedBoid !== null && !this.inspectedBoid.isDead
      && performance.now() - this.lastPointerMove >= this.inspectionStillDelay;
    if ( !still ) {
      this.inspectedBoid = null;
      this.inspection = null;
      let closestDistance = this.inspectRadius ** 2;
      for (const boid of [...this.sim.boids, ...this.sim.predators]) {
        const distance = this.sim.calculateDistanceSquared(boid.position, pointer);
        if ( !boid.isDead && distance < closestDistance ) {
          closestDistance = distance;
          this.inspectedBoid = boid;
        }
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

    // The card stays inside the window, and where it was while the mouse is still
    const cardWidth = 230;
    const cardHeight = 110;
    this.inspection = {
      x: still ? this.inspection!.x : pointer.x + 16 + cardWidth > sim.width ? pointer.x - 16 - cardWidth : pointer.x + 16,
      y: still ? this.inspection!.y : pointer.y + 16 + cardHeight > sim.height ? pointer.y - 16 - cardHeight : pointer.y + 16,
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

  // The bubble of the explanation follows its boid, above and to the right of it, inside the window; or stands above the charts
  private updateExplanation(now: number) {
    if ( !this.demo.active ) {
      this.explainer.update(this.sim, now, this.displayCharts);
    }
    const current = this.demo.active ? null : this.explainer.current;
    if ( current === null ) {
      this.explanationPosition = null;
      this.explained = null;
      this.explanationStart = -1;
      return;
    }
    this.explanationProgress = Math.min(1, (now - current.start) / current.duration);
    this.explained = current.anchor === 'charts' ? null : current.anchor;

    // The bubble is placed from where its subject was when it appeared, then stands still for an easy reading,
    // even if its boid swims away. It is only kept inside the window, with its size measured once displayed
    if ( current.start !== this.explanationStart ) {
      this.explanationStart = current.start;
      this.explanationPoint = current.anchor === 'charts' ? null
        : { ...(isArea(current.anchor) ? current.anchor.center : current.anchor.position) };
      this.explanationMargin = current.anchor !== 'charts' && isArea(current.anchor) ? current.anchor.radius : 30;
    }
    const bubble: HTMLElement | null = this.el.nativeElement.querySelector('.explain-bubble');
    const width = bubble?.offsetWidth || 400;
    const height = bubble?.offsetHeight || 200;
    const { width: screenWidth, height: screenHeight } = this.sim;
    let x: number;
    let y: number;
    if ( this.explanationPoint === null ) {
      // Above the charts
      x = screenWidth - 20 - width;
      y = screenHeight - 20 - 240 - 10 - height;
    } else {
      // On the side of the center of the screen, so it doesn't go off the edges
      const point = this.explanationPoint;
      const margin = this.explanationMargin;
      x = point.x < screenWidth / 2 ? point.x + margin : point.x - margin - width;
      y = point.y < screenHeight / 2 ? point.y + margin : point.y - margin - height;
    }
    // Inside the window, below the tool bar
    this.explanationPosition = {
      x: Math.min(screenWidth - width - 10, Math.max(10, x)),
      y: Math.min(screenHeight - height - 10, Math.max(60, y)),
    };
  }

  // The user read the bubble: the next one comes right away
  nextExplanation() {
    this.explainer.next(performance.now());
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
    this.challenges.update();

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
    this.updateExplanation(now);
    this.finalQuadtreeList = this.drawQuadtree ? this.sim.quadtree.retrieveFinalQuadtrees() : [];

    // The world is always drawn on the canvas, the boids only with the Canvas renderer: with the DOM one, they are HTML elements above it
    const sim = this.sim;
    this.canvasRenderer.render(
      this.renderer === 'canvas' ? [sim.boids, sim.predators] : [],
      this.drawQuadtree ? this.finalQuadtreeList : null,
      { darkMode: this.darkMode, glow: this.glow, displayQuadtreeCount: this.displayQuadtreeCount },
      this.mutantHalos,
      this.inspectedBoid,
      this.explained,
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

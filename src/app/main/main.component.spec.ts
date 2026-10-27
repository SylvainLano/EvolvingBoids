import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainComponent } from './main.component';
import { UserSettings, encodeLines, parseLink } from '../classes/Settings';
import { AMBIANCES } from '../classes/Ambiance';
import { SCENES } from '../classes/DemoMode';

describe('MainComponent', () => {
  let component: MainComponent;
  let fixture: ComponentFixture<MainComponent>;

  beforeEach(async () => {
    // Each test starts with the default settings, nothing remembered by the previous ones
    localStorage.removeItem(UserSettings.storageKey);
    await TestBed.configureTestingModule({
      imports: [MainComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create and start a simulation', () => {
    expect(component).toBeTruthy();
    expect(component.sim.boids.length).toBe(component.sim.numberOfBoids);
    expect(component.sim.predators.length).toBe(component.sim.numberOfPredators);
  });

  it('should open one options panel at a time', () => {
    component.toggleOptions('Boids');
    expect(component.openOptions).toBe('Boids');
    component.toggleOptions('Display');
    expect(component.openOptions).toBe('Display');
    component.toggleOptions('Display');
    expect(component.openOptions).toBeNull();
  });

  it('should select a tool with the number keys', () => {
    component.handleKeyDown(new KeyboardEvent('keydown', { key: '4' }));
    expect(component.tool).toBe('obstacle');
    component.handleKeyDown(new KeyboardEvent('keydown', { key: '7' }));
    expect(component.tool).toBe('food');
  });

  it('should plant an alga with a click of the Plant tool, the key 8', () => {
    component.handleKeyDown(new KeyboardEvent('keydown', { key: '8' }));
    expect(component.tool).toBe('plant');
    component.sim.plants.plants = [];
    component.handleMouseClick(new MouseEvent('click', { clientX: component.sim.width / 2, clientY: component.sim.height / 2 }));
    expect(component.sim.plants.plants.length).toBe(1);
  });

  it('should let the mouse scare the boids only with the tools adding creatures', () => {
    component.selectTool('predator');
    component.handleMouseMove(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
    expect(component.sim.mousePosition).toEqual({ x: 100, y: 100 });
    component.selectTool('obstacle');
    expect(component.sim.mousePosition).toBeNull();
  });

  it('should change the speed with the + and - keys', () => {
    component.handleKeyDown(new KeyboardEvent('keydown', { key: '+' }));
    expect(component.timeScale).toBe(2);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: '-' }));
    component.handleKeyDown(new KeyboardEvent('keydown', { key: '-' }));
    expect(component.timeScale).toBe(1);
  });

  // A section of the options panel, opened with its header
  const openSection = async (title: string) => {
    const headers: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.section-header'));
    headers.find(header => header.textContent!.includes(title))!.click();
    await fixture.whenStable();
  };
  const button = (text: string): HTMLButtonElement => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.section button'))
    .find(element => element.textContent!.trim().startsWith(text))!;

  it('should switch an option, and choose a value, in the options panel', async () => {
    await openSection('Display');
    button('Dark mode').click();
    expect(component.darkMode).toBe(false);
    await openSection('Simulation');
    button('Continued').click();
    expect(component.sim.simulationMode).toBe('Continued');
    button('x4').click();
    expect(component.timeScale).toBe(4);
  });

  it('should give numbers to the simulation from the sliders', async () => {
    await openSection('Boids');
    const thumb: HTMLInputElement = fixture.nativeElement.querySelector('input[name="alignmentRadius"]');
    thumb.value = '120';
    thumb.dispatchEvent(new Event('input'));
    expect(component.sim.alignmentRadius).toBe(120);
  });

  it('should start in dark mode, without the Quadtree', () => {
    expect(component.darkMode).toBe(true);
    expect(component.drawQuadtree).toBe(false);
  });

  it('should turn the page of the charts with a click, without using the tool', () => {
    const charts: HTMLCanvasElement = fixture.nativeElement.querySelector('.chart-canvas');
    const predators = component.sim.predators.length;
    component.selectTool('predator');
    charts.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(component.chartPage).toBe(1);
    expect(component.isOnInterface({ target: charts } as unknown as MouseEvent)).toBe(true);
    component.nextChartPage();
    expect(component.chartPage).toBe(0);
    expect(component.sim.predators.length).toBe(predators);
  });

  it('should play the cinema mode in the ambiance of its scene, then restore the settings when it stops', () => {
    component.darkMode = false;
    component.drawQuadtree = true;
    component.demo.start(false);
    expect(component.drawQuadtree).toBe(false);
    expect(component.longTrails).toBe(true);
    expect(component.ambiance).not.toBe('classic');
    expect(component.darkMode).toBe(AMBIANCES[component.ambiance].dark);
    expect(component.boidShape).toBe(AMBIANCES[component.ambiance].shape);
    component.demo.stop();
    expect(component.darkMode).toBe(false);
    expect(component.drawQuadtree).toBe(true);
    expect(component.ambiance).toBe('classic');
    expect(component.longTrails).toBe(false);
  });

  it('should film the cinema mode in smooth shots, inside the world, and fade to black between two scenes', () => {
    component.demo.start(false);
    const start = performance.now();
    component.demo.update(start);
    expect(component.demo.fade).toBeGreaterThan(0.9);
    const camera = component.demo.camera;
    const inside = () => {
      const halfWidth = component.sim.width / 2 / camera.zoom;
      const halfHeight = component.sim.height / 2 / camera.zoom;
      return camera.x - halfWidth > -0.01 && camera.x + halfWidth < component.sim.width + 0.01
        && camera.y - halfHeight > -0.01 && camera.y + halfHeight < component.sim.height + 0.01;
    };
    const zooms = new Set<number>();
    let previous = { ...camera };
    for (let elapsed = 100; elapsed <= 60000; elapsed += 100) {
      component.demo.update(start + elapsed);
      zooms.add(Math.round(camera.zoom * 10) / 10);
      // Never a jump: at most a few dozen pixels on the screen in a tenth of a second
      expect(Math.hypot(camera.x - previous.x, camera.y - previous.y) * camera.zoom).toBeLessThan(60);
      expect(inside()).toBe(true);
      previous = { ...camera };
    }
    // A wide shot without zoom, then closer ones
    expect(zooms.has(1)).toBe(true);
    expect(Math.max(...zooms)).toBeGreaterThan(1.5);
    component.demo.update(start + component.demo.sceneDuration - 500);
    expect(component.demo.fade).toBeGreaterThan(0.5);
    component.demo.stop();
  });

  it('should keep the camera of the cinema mode inside the world when a phone turns', () => {
    component.demo.start(false);
    const start = performance.now();
    const camera = () => component.demo.camera;
    for (let elapsed = 0; elapsed <= 20000; elapsed += 100) {
      component.demo.update(start + elapsed);
    }
    // From a landscape screen to a portrait one, as the window would tell the simulation
    component.sim.resize(400, 900);
    component.demo.update(start + 20100);
    const halfWidth = component.sim.width / 2 / camera().zoom;
    const halfHeight = component.sim.height / 2 / camera().zoom;
    expect(camera().x - halfWidth).toBeGreaterThan(-0.01);
    expect(camera().x + halfWidth).toBeLessThan(400.01);
    expect(camera().y - halfHeight).toBeGreaterThan(-0.01);
    expect(camera().y + halfHeight).toBeLessThan(900.01);
    component.demo.stop();
  });

  it('should stay on a scene of the cinema mode once locked, choose another one with the arrows, and go on once unlocked', () => {
    const demo = component.demo;
    const key = (name: string) => component.handleKeyDown(new KeyboardEvent('keydown', { key: name }));
    demo.start(false);
    let now = performance.now();
    demo.update(now);
    const title = demo.sceneTitle;
    key(' ');
    expect(demo.locked).toBe(true);
    for (let elapsed = 0; elapsed < 2 * demo.sceneDuration; elapsed += 1000) {
      demo.update(now += 1000);
    }
    expect(demo.sceneTitle).toBe(title);
    expect(demo.fade).toBe(0);

    // The next scene comes after a fade to black, and stays too
    const next = SCENES[(SCENES.findIndex(scene => scene.title === title) + 1) % SCENES.length];
    key('ArrowRight');
    expect(demo.chosenTitle).toBe(next.title);
    demo.update(now += demo.fadeDuration / 2);
    expect(demo.fade).toBeGreaterThan(0.4);
    expect(demo.sceneTitle).toBe(title);
    demo.update(now += demo.fadeDuration);
    expect(demo.sceneTitle).toBe(next.title);
    expect(component.ambiance).toBe(next.ambiance);
    for (let elapsed = 0; elapsed < demo.sceneDuration; elapsed += 1000) {
      demo.update(now += 1000);
    }
    expect(demo.sceneTitle).toBe(next.title);

    // Unlocked, it goes on for a while before giving way to another one
    key(' ');
    expect(demo.locked).toBe(false);
    demo.update(now += demo.unlockedRest - 2000);
    expect(demo.sceneTitle).toBe(next.title);
    demo.update(now += 2100);
    expect(demo.sceneTitle).not.toBe(next.title);
    demo.stop();
  });

  it('should start the cinema mode on the scene named by a link, and stay on it', () => {
    component.demo.start(false, 'night-hunt');
    expect(component.demo.sceneTitle).toBe('Night Hunt');
    expect(component.demo.locked).toBe(true);
    expect(component.ambiance).toBe('neon');
    component.demo.stop();
    component.demo.start(false, 'SAKURA');
    expect(component.ambiance).toBe('sakura');
    component.demo.stop();
    component.demo.start(false, 'nowhere');
    expect(component.demo.locked).toBe(false);
    component.demo.stop();
  });

  it('should use the buttons of the cinema mode without leaving it', () => {
    component.demo.start(false);
    component.demo.onMouseMove();
    component.demo.update(performance.now());
    // As the frames of the component refresh its view
    component['cdr'].detectChanges();
    const padlock: HTMLButtonElement = fixture.nativeElement.querySelector('.demo-scene');
    expect(padlock.textContent).toContain(component.demo.sceneTitle);
    padlock.click();
    expect(component.demo.locked).toBe(true);
    expect(component.demo.active).toBe(true);
    component.demo.stop();
  });

  it('should give an ambiance the dark mode that suits it, the dark mode of the user coming after it in the settings', () => {
    component.ambiance = 'paper';
    expect(component.darkMode).toBe(false);
    component.ambiance = 'neon';
    expect(component.darkMode).toBe(true);
    component.darkMode = false;
    component.settings.save();
    fixture.destroy();
    const next = TestBed.createComponent(MainComponent);
    next.detectChanges();
    expect(next.componentInstance.ambiance).toBe('neon');
    expect(next.componentInstance.darkMode).toBe(false);
    next.destroy();
  });

  it('should draw a wall with a finger, and forget the finger once lifted', () => {
    const touch = (type: string, x: number, y: number) => new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'touch' });
    component.selectTool('obstacle');
    component.handleMouseDown(touch('pointerdown', 100, 100));
    component.handleMouseMove(touch('pointermove', 200, 100));
    component.handleMouseUp(touch('pointerup', 200, 100));
    expect(component.sim.obstacles.polylines.length).toBe(1);

    component.selectTool('predator');
    component.handleMouseMove(touch('pointermove', 300, 300));
    expect(component.sim.mousePosition).toEqual({ x: 300, y: 300 });
    component.handleMouseUp(touch('pointerup', 300, 300));
    expect(component.sim.mousePosition).toBeNull();
  });

  it('should leave the demo with a second click, the first one showing how to exit', () => {
    component.demo.start(false);
    component.handleMouseClick(new MouseEvent('click'));
    component.demo.update(performance.now());
    expect(component.demo.active).toBe(true);
    expect(component.demo.showHint).toBe(true);
    component.handleMouseClick(new MouseEvent('click'));
    expect(component.demo.active).toBe(false);
  });

  it('should remember the settings for the next visit, until they are reset', () => {
    component.darkMode = false;
    component.sim.fertileAreas = 4;
    component.settings.save();
    fixture.destroy();
    const next = TestBed.createComponent(MainComponent);
    next.detectChanges();
    expect(next.componentInstance.darkMode).toBe(false);
    expect(next.componentInstance.sim.fertileAreas).toBe(4);
    next.componentInstance.settings.reset();
    expect(next.componentInstance.darkMode).toBe(true);
    expect(next.componentInstance.sim.fertileAreas).toBe(1);
    next.destroy();
  });

  it('should open a shared link: its settings, then its walls once the screen has a size', () => {
    component.sim.boidLifespan = 300;
    component.openLink(parseLink('?darkMode=false&walls=' + encodeLines([[{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]]))!);
    expect(component.darkMode).toBe(false);
    expect(component.sim.boidLifespan).toBe(180);
    component['frame'](performance.now());
    expect(component.sim.obstacles.polylines.length).toBe(1);
    expect(component.sim.obstacles.polylines[0][1].x).toBeCloseTo(component.sim.width * 0.9, 0);
  });

  it('should start a shared challenge, without changing the settings of the user', () => {
    component.darkMode = false;
    component.openLink(parseLink('?challenge=fortress')!);
    expect(component.challenges.active?.id).toBe('fortress');
    expect(component.darkMode).toBe(false);
  });

  it('should stop listening to the page once destroyed', () => {
    fixture.destroy();
    const before = component.sim.mousePosition;
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 321, clientY: 123 }));
    expect(component.sim.mousePosition).toEqual(before);
  });
});

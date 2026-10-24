import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { MainComponent } from './main.component';
import { BoidComponent } from '../boid/boid.component';

describe('MainComponent', () => {
  let component: MainComponent;
  let fixture: ComponentFixture<MainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MainComponent, BoidComponent],
      imports: [FormsModule, MatSliderModule, NoopAnimationsModule],
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

  it('should start in dark mode, without the Quadtree', () => {
    expect(component.darkMode).toBeTrue();
    expect(component.drawQuadtree).toBeFalse();
  });

  it('should restore the settings when the demo stops', () => {
    component.darkMode = false;
    component.drawQuadtree = true;
    component.demo.start(false);
    expect(component.darkMode).toBeTrue();
    expect(component.drawQuadtree).toBeFalse();
    component.demo.stop();
    expect(component.darkMode).toBeFalse();
    expect(component.drawQuadtree).toBeTrue();
  });

  it('should stop listening to the page once destroyed', () => {
    fixture.destroy();
    const before = component.sim.mousePosition;
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 321, clientY: 123 }));
    expect(component.sim.mousePosition).toEqual(before);
  });
});

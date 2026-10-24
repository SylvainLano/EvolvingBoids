import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';

import { BoidComponent } from './boid.component';

describe('BoidComponent', () => {
  let component: BoidComponent;
  let fixture: ComponentFixture<BoidComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BoidComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoidComponent);
    component = fixture.componentInstance;
    component.position = { x: 10, y: 20 };
    component.velocity = { x: 1, y: 0 };
    component.isPredator = false;
    component.isDead = false;
    component.speedTrait = 0;
    component.fertilityTrait = 0;
    component.alpha = 1;
    component.darkMode = false;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should point in the direction of its velocity', () => {
    component.velocity = { x: 0, y: 1 };
    expect(component.calculateRotation()).toBeCloseTo(90);
  });

  it('should be golden when it is a Super Predator', () => {
    component.isPredator = true;
    component.isSuper = true;
    component.ngOnChanges({ isSuper: new SimpleChange(false, true, false) });
    expect(component.colorStyle['color']).toContain('hsla(45,');
  });
});

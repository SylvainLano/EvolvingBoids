// options.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import type { MainComponent, OptionsPanel } from '../main/main.component';
import { findSetting } from '../classes/Settings';
import { clock } from '../classes/Challenges';

// A line of the options: a heading, a slider, an on/off switch, or a choice between a few values
interface Control {
  kind: 'heading' | 'slider' | 'toggle' | 'choice';
  label: string;
  key?: string;             // the setting it changes, in the display or in the simulation
  step?: number;            // for a slider, its range is the one of the setting
  unit?: string;
  title?: string;
  options?: { value: string, label: string, title?: string }[];
}

const slider = (key: string, label: string, step: number, unit = '', title?: string): Control => ({ kind: 'slider', key, label, step, unit, title });
const toggle = (key: string, label: string, title?: string): Control => ({ kind: 'toggle', key, label, title });
const heading = (label: string): Control => ({ kind: 'heading', label });

// The counters and the options of the simulation, in a panel at the top left of the screen
// Only one section is open at a time
@Component({
  selector: 'app-options',
  imports: [FormsModule, MatSliderModule],
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.sass'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class OptionsComponent {
  @Input({ required: true }) app!: MainComponent;
  readonly clock = clock;
  openChallenge: string | null = null;      // the challenge whose goal is shown

  readonly titles: Record<OptionsPanel, string> = {
    Simulation: 'Simulation', Display: 'Display', Boids: 'Boids', Predator: 'Predators', Challenges: 'Challenges',
  };

  readonly sections: Record<OptionsPanel, Control[]> = {
    Simulation: [
      {
        kind: 'choice', key: 'simulationMode', label: 'When a species dies out', options: [
          { value: 'Infinite', label: 'Infinite', title: 'When one side is almost depleted, add some boids to this side, with the genes of the population.' },
          { value: 'Continued', label: 'Continued', title: 'Continue the simulation without noticing depletion.' },
          { value: 'Retry', label: 'Retry', title: 'Restart the simulation when one side is depleted.' },
          { value: 'DeathMatch', label: 'Death match', title: 'Pause the simulation when one side is depleted.' },
        ],
      },
      {
        kind: 'choice', key: 'lowFPSAction', label: 'When the FPS gets low', options: [
          { value: 'PopulationControl', label: 'Population control', title: 'Remove 5 % of the boids in the side in excess.' },
          { value: 'BudgetCuts', label: 'Budget cuts', title: 'Remove 50 % of the boids in each side.' },
          { value: 'SuperPredator', label: 'Super Predator', title: 'A Super Predator comes to thin out the boids, at most once a minute.' },
          { value: 'Nothing', label: 'Nothing', title: 'Continue the simulation without noticing depletion.' },
        ],
      },
      toggle('deusExMachina', 'Deus Ex Machina', 'A Super Predator comes to thin out the boids when they crowd the screen, at most once a minute.'),
    ],
    Display: [
      {
        kind: 'choice', key: 'renderer', label: 'Renderer', options: [
          { value: 'canvas', label: 'Canvas', title: 'Draw the boids on a canvas, with trails and glow.' },
          { value: 'dom', label: 'DOM', title: 'Draw each boid as an HTML element, to compare performances.' },
        ],
      },
      {
        kind: 'choice', key: 'boidShape', label: 'Shape', options: [
          { value: 'arrow', label: 'Arrow', title: 'Arrow heads, with the Canvas renderer.' },
          { value: 'fish', label: 'Fish', title: 'Fish waving their tails, and sharks for the predators, with the Canvas renderer.' },
          { value: 'bird', label: 'Bird', title: 'Birds flapping their wings, and hawks for the predators, with the Canvas renderer.' },
          { value: 'letters', label: 'Letters', title: 'A letter for each family: a mutant gets the next one. Lowercase boids, uppercase predators, with the Canvas renderer.' },
        ],
      },
      toggle('darkMode', 'Dark mode'),
      toggle('glow', 'Glow', 'Additive blending and halos, with the Canvas renderer in Dark Mode.'),
      slider('trailLength', 'Trails length', 2, '', 'With the Canvas renderer.'),
      toggle('displayCharts', 'Charts', 'Populations, plankton, and average genes compared to the species defaults, with the winters shaded.'),
      toggle('displayBoidCount', 'Counters'),
      toggle('displayFPSCount', 'FPS'),
      toggle('drawQuadtree', 'Quadtrees'),
      toggle('displayQuadtreeCount', 'Boids in the quadtrees'),
    ],
    Boids: [
      heading('Flocking'),
      slider('alignmentRadius', 'Alignment radius', 5, ' px'),
      slider('cohesionRadius', 'Cohesion radius', 5, ' px'),
      slider('boidsSeparationRadius', 'Separation radius', 5, ' px'),
      heading('Predators'),
      slider('fleeRadius', 'Detection radius', 20, ' px', 'How far a boid sees the predators all around it, before its field of view and its vision gene.'),
      slider('boidFieldOfView', 'Field of view', 30, '°', 'The boids don\'t see the predators behind them, but the narrower their field of view, the farther they see ahead. 360°: all around.'),
      slider('fleeFactor', 'Fleeing force', 1),
      toggle('fleeReset', 'Fleeing resets the nesting time'),
      heading('Life'),
      slider('boidLifespan', 'Lifespan', 30, ' s', 'Average age at which a boid dies, +/- 20 %. 0 makes the boids immortal.'),
      slider('boidReproductionChances', 'Reproduction chances', 5, ' %'),
      slider('boidReproductionModificator', 'Reproduction modifier', 1),
      heading('Food and seasons'),
      toggle('foodEnabled', 'Plankton', 'Boids eat plankton, growing in drifting fertile areas: they need energy to reproduce, and starve without it.'),
      toggle('plantsEnabled', 'Plants', 'Algae grow in place, the boids nibble them: they spread in summer, wither in winter and sprout again in spring.'),
      slider('fertileAreas', 'Fertile areas', 1, '', 'Number of drifting areas where the plankton grows: fewer areas make the food scarcer.'),
      toggle('seasonsEnabled', 'Seasons', 'The plankton thrives in summer and fades in winter: the enduring boids get through.'),
      slider('yearDuration', 'Year length', 2, ' min', 'Length of a year, in simulated minutes.'),
      slider('winterFood', 'Winter plankton', 5, ' %', 'Plankton the fertile areas hold in the middle of winter, in percent of the summer.'),
      heading('Evolution'),
      slider('boidEvolutionChances', 'Evolution chances', 5, ' %'),
      slider('boidEvolutionCap', 'Max evolution', 5, ' %'),
      slider('geneCostFactor', 'Genes cost', 0.5, '', 'Each +10 % of speed or fertility shortens a life by this many tenths. Above 1, the best genes depend on the predation. Applies to the newborns.'),
    ],
    Predator: [
      heading('Hunting'),
      slider('predatorSight', 'Detection radius', 50, ' px', 'How far a predator sees the boids all around it, before its field of view and its vision gene. Without a prey in sight, it prowls slowly. 0: the whole screen, without the vision gene.'),
      slider('predatorFieldOfView', 'Field of view', 30, '°', 'The predators look ahead: the narrower their field of view, the farther they see. 360°: all around.'),
      toggle('predatorsCooperativeness', 'Cooperative hunt', 'Predator will try to choose a prey that is not already chased.'),
      toggle('predatorVersatility', 'Change of prey'),
      slider('predatorsSeparationRadius', 'Separation radius', 5, ' px'),
      slider('predatorStarvationModificator', 'Starvation resistance', 1),
      heading('Life and evolution'),
      slider('predatorReproductionChances', 'Reproduction chances', 5, ' %'),
      slider('predatorReproductionModificator', 'Reproduction modifier', 1),
      slider('predatorEvolutionChances', 'Evolution chances', 5, ' %'),
      slider('predatorEvolutionCap', 'Max evolution', 5, ' %'),
    ],
    Challenges: [],
  };

  // Each setting belongs to the display or to the simulation
  private owner(key: string): Record<string, unknown> {
    return (findSetting(key)?.owner === 'sim' ? this.app.sim : this.app) as unknown as Record<string, unknown>;
  }

  value(control: Control): unknown {
    return this.owner(control.key!)[control.key!];
  }

  set(control: Control, value: unknown) {
    this.owner(control.key!)[control.key!] = value;
  }

  min(control: Control): number {
    return findSetting(control.key!)?.range?.[0] ?? 0;
  }

  max(control: Control): number {
    return findSetting(control.key!)?.range?.[1] ?? 100;
  }
}

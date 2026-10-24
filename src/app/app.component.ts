import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MainComponent } from './main/main.component';

@Component({
  selector: 'app-root',
  imports: [MainComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.sass',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AppComponent {
  title = 'Evolving Boids';
}

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

// A single page, without zone.js: the animation loop refreshes the view itself
bootstrapApplication(AppComponent)
  .catch((err) => console.error(err));

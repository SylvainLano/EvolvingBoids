// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSliderModule } from '@angular/material/slider';

import { AppComponent } from './app.component';
import { MainComponent } from './main/main.component';
import { BoidComponent } from './boid/boid.component';
import { routes } from './app.routes';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [AppComponent, MainComponent, BoidComponent],  
  imports: [BrowserModule, FormsModule, RouterModule.forRoot(routes), BrowserAnimationsModule, CommonModule, MatSliderModule],
  bootstrap: [AppComponent],
})
export class AppModule {}

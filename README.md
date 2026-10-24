# EvolvingBoids

## Description
[Evolving Boids](https://sylvainlano.github.io/EvolvingBoids/) is an Angular Boids simulation using SASS and Quadtree

### The Rendering
- The simulation runs at a fixed 60 steps per second, whatever the screen refresh rate  
- Angular runs without zone.js: the animation loop refreshes the view itself, the counters 5 times per second  
- Boids are drawn on a Canvas by default, with trails and, in Dark Mode, a glow  
- The simulation starts in Dark Mode, without the Quadtree drawn: both can be changed in the Display Options  
- The DOM renderer (one HTML element per boid) can still be selected in the Display Options, to compare performances: the world (plankton, obstacles, currents, quadtrees) is still drawn on the Canvas under the boids  
- The simulation adapts to the window size (resize, fullscreen) without restarting  

### The Plankton
- Regular Boids eat plankton, drawn as a glowing mist, that grows in fertile areas slowly drifting across the screen: the flocks graze and migrate to follow it  
- The number of fertile areas (3 by default) can be modified in the Boids Options: with a single one, the food gets scarce  
- Boids are drawn to the plankton, all the more when hungry: with 3 fertile areas, they stay about 3 times more in them than by chance  
- A grazed area grows back like grass, the plankton left behind by a drifting area fades away  
- Boids spend energy to live, and much more to swim fast (with the square of the speed), they look for food when hungry and starve without energy  
- A boid needs 80 % of energy to nest, and each parent spends 30 % at a birth, given to the child  
- The plankton can be disabled in the Boids Options, the boids then don't need food anymore  

### The Mouse Tools
- A tool bar, or the keys 1 to 7, selects what the mouse does  
- Boid, Predator: a click adds one, and the mouse scares the boids like a predator  
- Super Predator: a click adds a golden predator, bigger and faster, that hunts boids and predators for 45 seconds then fades away. Predators flee it. It doesn't reproduce nor evolve, and isn't counted in the statistics  
- Obstacle: a drag draws a wall that can't be crossed, boids and predators steer away from it and keep a small distance while following it. Predators don't chase the boids hidden behind a wall  
- Current: a drag draws a current that carries the boids along, faster than they swim, and slowly turns them in its direction  
- Eraser: holding the mouse removes the boids, and the parts of the obstacles, currents and plankton, under it  
- Food: holding the mouse sows plankton, it fades away out of the fertile areas  
- Obstacles and currents stay when the simulation restarts, the Clear button removes them  

### On a Phone or a Tablet
- The tools work with a finger as with a mouse: a finger draws the walls and currents, and the boids flee it while it touches the screen  
- On a narrow screen, the tool bar spans the width and scrolls sideways, with Clear, Reset, Share and Explain first. The keys of the tools are hidden on a touch screen  
- The charts are hidden at first on a phone, they can be shown in the Display Options. The challenge card and the charts take the bottom of the screen  
- Dragging a finger never scrolls nor zooms the page, nor reloads it  
- The inspection of a boid needs the Shift key, it isn't available on a touch screen  

### The Settings and the Sharing
- The settings of the options are remembered in the browser, and come back on the next visit. Only the ones changed are kept: the others follow the defaults of the next versions  
- The Reset button, next to Clear, brings every option back to its default value, after a confirmation. Clear only removes the walls and currents  
- The Share button copies a link to the clipboard: it gives the same settings, walls and currents to whoever opens it, on a screen of any size. During a challenge, the link starts this challenge  
- A link is short: only the changed settings are written, readable (like `?darkMode=false&boidLifespan=300`), and the walls and currents are simplified then packed in 4 characters per point  
- Opening a link replaces the settings, which are then remembered. The address forgets the link right away: a reload keeps the settings, but not the walls and currents, like the ones drawn by hand  
- The values of a link are checked: a number is brought back into the range of its option, anything else is ignored  
- The settings of the demo and of the challenges are never remembered, the settings of the user come back when they end  
- In a message, a link shows a preview: the title, a short description and a picture of the simulation. The site has its own icon, a small flock of boids  

### The Explain Mode
- The Explain button, at the top next to the tools, or the E key, shows short bubbles about what happens on the screen, when it happens. On the first visit, the button glows and pulses to catch the eye  
- A bubble stands still next to what it explains, circled in amber: the boid an event happened to, or an area of the screen (a flock, the plankton, a wall). It stands on the side of the center of the screen, so no edge cuts it  
- It starts with how a flock works, then explains the births, the mutants, the captures, the predators giving up a chase, the deaths of old age and of hunger, the reinforcements, the Super Predators, the round generations, the fleeing flocks, the plankton, the colors, the walls and the charts  
- One bubble at a time, long enough to read it calmly (a bar shows the time left), a click on the bubble or the Enter key shows the next one. Every explanation is shown once, then comes back now and then  

### The Challenges
- Five challenges, in the Challenges Options, each with its own starting conditions and its own mouse tools (some with a limited number of uses):  
  - Coexistence: keep both species alive for 10 minutes without reinforcement, through the booms and busts of the predators (3 predators to add)  
  - Fortress: a Super Predator arrives every 15 seconds, keep at least 40 boids alive for 3 minutes  
  - Lone Hunter: keep a single predator, that can't reproduce, alive for 4 minutes (10 boids to drop)  
  - Arms Race: bring the average speed of the boids to +10 % within 20 minutes  
  - Slow and Steady: bring the average speed of the boids to -6 % within 20 minutes  
- The time is the simulated time, so the speed can be raised. A card shows the goal and the progress, the simulation pauses when the challenge is won or lost  
- The settings of the user are restored when the challenge is closed, and the completed challenges are remembered in the browser  
- Each challenge was checked by simulation: lost without any action, won with a simple strategy  

### The Charts and the Speed
- Live charts show the populations, the plankton (compared to what the fertile areas can hold), and the average speed and fertility of each species compared to its defaults, over the last 15 simulated minutes  
- The highest generation of each species is displayed with the boid counts  
- A ring spreads around each newborn mutant  
- Holding Shift and hovering a boid shows its generation, genes, and age (or hunger for a Predator), the mouse then doesn't scare the boids. When the mouse stops, the card stands still to be read and its boid stays circled, until the mouse moves or Shift is released  
- The simulation can be sped up x2, x4 or x8 in the Simulation Options, or with the + and - keys, to watch the evolution  

### The Demo Mode
- A never ending screensaver, started with the D key, the Simulation Options, or the url `index.html?demo`  
- The interface and the cursor are hidden, the page goes fullscreen and the screen is kept awake  
- Scenes (Shoal, Murmuration, Fireflies, Night Hunt) follow each other every 2.5 minutes, with a smooth transition of the parameters  
- A director keeps the ecosystem alive: new flocks and predator packs arrive from the borders when a population is low, with the genes of the current population, and reproduction stops when a population is too large or the FPS too low  
- Moving the mouse, or a click, shows how to exit: D, Esc, or a second click (a second tap on a phone)  

### The Quadtree
- Regular Boids and Predators detection are handled by a Quadtree  
- Boids are not inserted when FPS gets under 20  
- Quadtree capacity is 24 before splitting, and merge is triggered at 1/4 of that  

### The Boids
- Regular Boids have alignment, cohesion and separation  
- Predators only have separation  
- A Predator tires of a chase that makes no progress for 3 seconds (a prey turning more sharply than it can, going round in circles): it leaves this prey alone for 10 seconds and looks for another one  
- Regular Boids need a partner to reproduce, heading roughly the same way, and both should have had some quiet time with no fleeing  
- Regular Boids reproduce less as the screen gets crowded (logistic growth), and stop at 1 boid per 4000 px²  
- Regular Boids die of old age after about 3 minutes (+/- 20 %), the lifespan can be modified in the options, 0 makes them immortal  
- Predators only need to eat to reproduce, but must calm down after eating  
- All Boids carry a Genome with a Maximum Velocity and a Reproduction Rate, that can be altered by evolution  
- All Boids have a Reproduction Chance, an Evolution Chance and an Evolution Cap that can be modified in the options  

### Evolutions
- Each child inherits every gene from one of its two parents (Predators have a single parent)  
- A mutation alters one gene by one step, for better or worse, within the Evolution Cap  
- The first Boids start with a slight variation around the species defaults, so natural selection can work right away  
- Every gene varies slightly (+/- 2 %) at each birth, on top of the rarer and larger mutations  
- Genes have a cost: each +10 % of speed or fertility shortens the life of a Regular Boid by 15 %, and each +10 % of fertility shortens the starvation resistance of a Predator by 15 % (fast Predators already get hungry faster). The best genes depend on the predation: boids that are eaten young gain from living fast, boids that die of old age gain from living long. The cost can be modified in the Boids Options  
- In Infinite mode, reinforcements arrive when fewer than 30 Regular Boids are left (a few boids can hardly find partners), or when no Predator is left  
- Reinforcements (Infinite mode, Demo Mode) inherit the genes of the living population, or of the last 30 dead individuals if the species is extinct  
- The Reproduction Rate shortens both the cooldown and, for Regular Boids, the quiet time needed to nest  
- The color is derived from the genes:  
  - Speed shifts the hue: Regular Boids go from violet (slow) to blue to cyan (fast), Predators from orange (slow) to red to magenta (fast)  
  - Fertility shifts the lightness: the more fertile, the brighter  
  - A digesting Predator gets paler

## Development

### Architecture
- Angular 22, with standalone components (no NgModule nor router for this single page), zoneless change detection, the new control flow (`@if`, `@for`) and the esbuild based `@angular/build`  
- `classes/Simulation.ts` is the simulation engine, without anything about Angular nor the display: the boids, the predators, the plankton, the obstacles and currents, the genetics and the statistics  
- `main/main.component.ts` displays it and controls it: the animation loop, the mouse tools, the inspection, the options  
- `classes/CanvasRenderer.ts` and `classes/ChartRenderer.ts` draw the world and the charts, `classes/DemoMode.ts` drives the screensaver, `classes/Challenges.ts` defines and runs the challenges, `classes/Explainer.ts` chooses the explanations from the events of the simulation, `classes/Settings.ts` remembers the settings and writes or reads the shared links  
- `classes/Quadtree.ts`, `classes/SegmentField.ts` and `classes/FoodField.ts` index the boids, the drawn lines and the plankton  
- `src/favicon.svg` is the icon, also drawn as `favicon.ico` (16, 32 and 48 px) and `apple-touch-icon.png` (180 px). `src/assets/preview.png` is the picture of the link previews, a capture of the demo at 1200 x 630 px, declared with absolute addresses in `index.html`  
- `index.html` also gives the search engines the canonical address (the shared links all lead to it), a description of the application as structured data, and a short presentation for the robots and the visitors without JavaScript  

### Tests
- `ng test` runs the unit tests: the engine (obstacles never crossed, reinforcements, energy, Super Predators...), the Quadtree, the drawn lines, the plankton, and the components  
- They run with Vitest in a headless Chromium driven by Playwright, as the components draw on real canvases: set `CHROME_BIN` to the installed Chrome, or run `npx playwright install chromium` once  

### Todos
- Add different skins (or letters) for boid
- Add more evolutions 

### Futures developments and ideas
- Deus Ex Machina Mode and/or low FPS : Spawn a Super Predator automatically
- Add a field of view (the line of sight is already blocked by the walls)  
- Add movement anticipation for predators

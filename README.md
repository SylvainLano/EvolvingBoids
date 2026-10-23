# EvolvingBoids

## Description
[Evolving Boids](https://sylvainlano.github.io/EvolvingBoids/index.html) is an Angular Boids simulation using SASS and Quadtree

### The Rendering
- The simulation runs at a fixed 60 steps per second, whatever the screen refresh rate  
- The animation loop runs outside of Angular's zone, the counters are refreshed 5 times per second  
- Boids are drawn on a Canvas by default, with trails and, in Dark Mode, a glow  
- The DOM renderer (one HTML element per boid) can still be selected in the Display Options, to compare performances  
- The simulation adapts to the window size (resize, fullscreen) without restarting  

### The Plankton
- Regular Boids eat plankton, drawn as a glowing mist, that grows in 4 fertile areas slowly drifting across the screen: the flocks graze and migrate to follow it  
- A grazed area grows back like grass, the plankton left behind by a drifting area fades away  
- Boids spend energy to live, and much more to swim fast (with the square of the speed), they look for food when hungry and starve without energy  
- A boid needs 80 % of energy to nest, and each parent spends 30 % at a birth, given to the child  
- The plankton can be disabled in the Boids Options, the boids then don't need food anymore  

### The Mouse Tools
- A tool bar, or the keys 1 to 7, selects what the mouse does  
- Boid, Predator: a click adds one, and the mouse scares the boids like a predator  
- Super Predator: a click adds a golden predator, bigger and faster, that hunts boids and predators for 45 seconds then fades away. Predators flee it. It doesn't reproduce nor evolve, and isn't counted in the statistics  
- Obstacle: a drag draws a wall that can't be crossed, boids and predators steer away from it and keep a small distance while following it  
- Current: a drag draws a current that carries the boids along, faster than they swim, and slowly turns them in its direction  
- Eraser: holding the mouse removes the boids, and the parts of the obstacles, currents and plankton, under it  
- Food: holding the mouse sows plankton, it fades away out of the fertile areas  
- Obstacles and currents stay when the simulation restarts, the Clear button removes them. They are only drawn by the Canvas renderer  

### The Charts and the Speed
- Live charts show the populations, the plankton (compared to what the fertile areas can hold), and the average speed and fertility of each species compared to its defaults, over the last 15 simulated minutes  
- The highest generation of each species is displayed with the boid counts  
- A ring spreads around each newborn mutant  
- Holding Shift and hovering a boid shows its generation, genes, and age (or hunger for a Predator), the mouse then doesn't scare the boids  
- The simulation can be sped up x2, x4 or x8 in the Simulation Options, or with the + and - keys, to watch the evolution  

### The Demo Mode
- A never ending screensaver, started with the D key, the Simulation Options, or the url `index.html?demo`  
- The interface and the cursor are hidden, the page goes fullscreen and the screen is kept awake  
- Scenes (Shoal, Murmuration, Fireflies, Night Hunt) follow each other every 2.5 minutes, with a smooth transition of the parameters  
- A director keeps the ecosystem alive: new flocks and predator packs arrive from the borders when a population is low, with the genes of the current population, and reproduction stops when a population is too large or the FPS too low  
- Moving the mouse shows how to exit: D or Esc  

### The Quadtree
- Regular Boids and Predators detection are handled by a Quadtree  
- Boids are not inserted when FPS gets under 20  
- Quadtree capacity is 24 before splitting, and merge is triggered at 1/4 of that  

### The Boids
- Regular Boids have alignment, cohesion and separation  
- Predators only have separation  
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
- Genes have a cost: each +10 % of speed or fertility shortens the life of a Regular Boid by 15 %, and each +10 % of fertility shortens the starvation resistance of a Predator by 15 % (fast Predators already get hungry faster). The best genes depend on the predation: boids that are eaten young gain from living fast, boids that die of old age gain from living long  
- In Infinite mode, reinforcements arrive when fewer than 30 Regular Boids are left (a few boids can hardly find partners), or when no Predator is left  
- Reinforcements (Infinite mode, Demo Mode) inherit the genes of the living population, or of the last 30 dead individuals if the species is extinct  
- The Reproduction Rate shortens both the cooldown and, for Regular Boids, the quiet time needed to nest  
- The color is derived from the genes:  
  - Speed shifts the hue: Regular Boids go from violet (slow) to blue to cyan (fast), Predators from orange (slow) to red to magenta (fast)  
  - Fertility shifts the lightness: the more fertile, the brighter  
  - A digesting Predator gets paler

## Development

### Todos
- Add different skins (or letters) for boid
- Add more evolutions 

### Futures developments and ideas
- Deus Ex Machina Mode and/or low FPS : Spawn a Super Predator automatically
- Add line of sight  
- Add movement anticipation for predators

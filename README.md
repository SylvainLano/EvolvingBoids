# EvolvingBoids

## Description
[Evolving Boids](https://sylvainlano.github.io/EvolvingBoids/index.html) is an Angular Boids simulation using SASS and Quadtree

### The Quadtree
- Regular Boids and Predators detection are handled by a Quadtree  
- Boids are not inserted when FPS gets under 20  
- Quadtree capacity is 24 before splitting, and merge is triggered at 1/4 of that  

### The Boids
- Regular Boids have alignment, cohesion and separation  
- Predators only have separation  
- Regular Boids need a partner to reproduce, and both should have had some quiet time with no fleeing  
- Predators only need to eat to reproduce, but must calm down after eating  
- All Boids carry a Genome with a Maximum Velocity and a Reproduction Rate, that can be altered by evolution  
- All Boids have a Reproduction Chance, an Evolution Chance and an Evolution Cap that can be modified in the options  

### Evolutions
- Each child inherits every gene from one of its two parents (Predators have a single parent)  
- A mutation alters one gene by one step, for better or worse, within the Evolution Cap  
- The first Boids start with a slight variation around the species defaults, so natural selection can work right away  
- The Reproduction Rate shortens both the cooldown and, for Regular Boids, the quiet time needed to nest  
- The color is derived from the genes:  
  - Speed shifts the hue: Regular Boids go from violet (slow) to blue to cyan (fast), Predators from orange (slow) to red to magenta (fast)  
  - Fertility shifts the lightness: the more fertile, the brighter  
  - A digesting Predator gets paler

## Development

### Todos
- Add different skins (or letters) for boid
- Create a Canvas version to allow users to compare performances
- Add more evolutions 

### Futures developments and ideas
- Deus Ex Machina Mode and/or low FPS : Spawn a Super Predator
- Add a way to manually remove boids
- Add line of sight  
- Add drawing obstacles with the mouse  
- Add movement anticipation for predators

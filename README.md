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
- All Boids have a Maximum Velocity and a Reproduction Rate that can be altered by evolution  
- All Boids have a Reproduction Chance, an Evolution Chance and an Evolution Cap that can be modified in the options  

## Development

### DONES
- New options to show/hide the Quadtrees, their boid count, the total boids and the FPS  
- New options for Boids to modify preadator detection and fleeing force  
- Few improvements in Quadtree and main component

### Todos
- Add more evolutions  
- Improve optimization  

### Futures developments and ideas
- Add line of sight  
- Add drawing obstacles with the mouse  
- Add movement anticipation for predators

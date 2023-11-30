# EvolvingBoids

## Description
[Evolving Boids](https://sylvainlano.github.io/EvolvingBoids/index.html) is an Angular Boids simulation using SASS

### In details
- Boids and Predators detection are handled by a Quadtree  
- Regular Boids have alignment, cohesion and separation  
- Predators only have separation,  
- Regular Boids need a partner to reproduce, and both should have had some quiet time with no fleeing  
- Predators only need to eat to reproduce, but must calm down after eating  
- All Boids have a Maximum Velocity and a Reproduction Rate that can be altered by evolution  
- All Boids have a Reproduction Chance, an Evolution Chance and an Evolution Cap that can be modified in the options  

## Development

### Todos
- Add more controls  
- Add more evolutions  
- Improve optimization  

### Futures developments and ideas
- Option to show the Quadtrees  
- Add line of sight  
- Add drawing borders with the mouse  
- Add movement anticipation for predators

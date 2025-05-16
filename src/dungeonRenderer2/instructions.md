# DungeonRenderer Documentation

A high-performance, modular system for rendering large tile-based dungeons in Phaser 3. This system is designed for efficient rendering of large maps through structure-based visibility culling, optimized sprite management, and asynchronous loading.

## Features

- **Structure-Based Culling**: Only renders visible parts of the dungeon
- **Efficient Sprite Management**: Uses object pooling to reduce garbage collection
- **Progressive Loading**: Loads map data asynchronously with progress feedback
- **Minimap**: Provides an overview of the dungeon with player position
- **Performance Monitoring**: Tracks FPS, render times, and memory usage
- **Debug Visualization**: Optional visual debugging tools

## Quick Start

Here's how to integrate the DungeonRenderer into your game:

```javascript
import DungeonRenderer from '../dungeonRenderer';

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.dungeonRenderer = null;
  }
  
  create() {
    // Initialize the dungeon renderer
    this.dungeonRenderer = new DungeonRenderer(this);
    this.dungeonRenderer.init({
      tileSize: 64,
      debug: false
    });
    
    // Load map data from server or local storage
    this.loadMapData()
      .then(mapData => {
        // Load and render the dungeon
        this.dungeonRenderer.loadMap(mapData, (success) => {
          if (success) {
            console.log('Dungeon loaded successfully!');
          } else {
            console.error('Failed to load dungeon');
          }
        });
      });
  }
  
  update(time, delta) {
    // Update the dungeon renderer
    if (this.dungeonRenderer) {
      this.dungeonRenderer.update(time, delta);
    }
  }
  
  // Handle window resize
  resize(width, height) {
    if (this.dungeonRenderer) {
      this.dungeonRenderer.handleResize(width, height);
    }
  }
  
  shutdown() {
    // Clean up resources
    if (this.dungeonRenderer) {
      this.dungeonRenderer.destroy();
      this.dungeonRenderer = null;
    }
  }
}
```

## Core Components

### DungeonRenderer

The main orchestrator class that manages rendering of the dungeon.

```javascript
import { DungeonRenderer } from '../dungeonRenderer';

// Create and initialize
const renderer = new DungeonRenderer(scene);
renderer.init({
  tileSize: 64,              // Size of tiles in pixels
  debug: false,              // Enable debug visualization
  visibilityBuffer: 5,       // Buffer of tiles around camera view
  minimapSize: 200,          // Size of minimap in pixels
  minimapPadding: 20,        // Padding from screen edge
  trackFPS: true,            // Track FPS statistics
  trackMemory: false,        // Track memory usage
  poolInitialSize: 100       // Initial size of sprite pools
});

// Load map data
renderer.loadMap(mapData, (success, error) => {
  console.log(success ? 'Map loaded!' : `Error: ${error.message}`);
});

// Update each frame
renderer.update(time, delta);

// Handle resize
renderer.handleResize(width, height);

// Clean up
renderer.destroy();
```

### StructureManager

Manages dungeon structures (rooms, corridors) and their visibility.

```javascript
import { StructureManager } from '../dungeonRenderer';

const structureManager = new StructureManager(scene, textureRegistry);
structureManager.init({
  tileSize: 64,
  visibilityBuffer: 5,
  debug: false
});

// Preload a structure
await structureManager.preloadStructure(structure, mapData, 'room');

// Update visibility based on camera position
structureManager.updateVisibility(cameraBounds);

// Get visible structures
const visibleStructures = structureManager.getVisibleStructures();

// Get structure at position
const structure = structureManager.getStructureAtPosition(x, y);
```

### TileFactory

Creates and manages tile sprites with efficient pooling.

```javascript
import { TileFactory } from '../dungeonRenderer';

const tileFactory = new TileFactory(scene, textureRegistry);
tileFactory.init({
  tileSize: 64,
  poolInitialSize: 100,
  debug: false
});

// Create a tile sprite
const sprite = tileFactory.createTileSprite(tileValue, x, y);

// Release a sprite back to the pool
tileFactory.releaseSprite(sprite);

// Get stats
const stats = tileFactory.getStats();
```

### LoadingManager

Manages loading screen and progress tracking.

```javascript
import { LoadingManager } from '../dungeonRenderer';

const loadingManager = new LoadingManager(scene);
loadingManager.init({
  progressBarWidth: 400,
  progressBarHeight: 30,
  debug: false
});

// Show loading UI
loadingManager.showLoadingUI('Loading dungeon...', 0);

// Update progress
loadingManager.updateProgress(0.5); // 50%

// Hide loading UI
loadingManager.hideLoadingUI();

// Show error
loadingManager.showError('Failed to load dungeon', () => {
  // Error dialog closed callback
});
```

## UI Components

### MinimapRenderer

Renders a minimap overview of the dungeon.

```javascript
import { MinimapRenderer } from '../dungeonRenderer';

const minimapRenderer = new MinimapRenderer(scene);
minimapRenderer.init({
  size: 200,
  padding: 20,
  showSpawnPoints: true,
  showPlayerPosition: true,
  showStructureTypes: true,
  showViewport: false,
  debug: false
});

// Render the minimap
minimapRenderer.render(mapData, tileSize);

// Update player position
minimapRenderer.updatePlayerPosition(x, y);

// Toggle features
minimapRenderer.toggleFeature('viewport', true);

// Handle resize
minimapRenderer.handleResize(width, height);
```

## Utilities

### VisibilityCulling

Determines what structures and tiles should be visible.

```javascript
import { VisibilityCulling } from '../dungeonRenderer';

const culling = new VisibilityCulling();
culling.init({
  debug: false
});

// Check if visibility should be updated
const shouldUpdate = culling.shouldUpdateVisibility(camera, lastPosition);

// Check if structure is visible
const isVisible = culling.isStructureVisible(structureBounds, cameraBounds, buffer);

// Get visible tile bounds
const bounds = culling.getVisibleTileBounds(camera, tileSize, buffer);
```

### PerformanceMonitor

Tracks and reports renderer performance metrics.

```javascript
import { PerformanceMonitor } from '../dungeonRenderer';

const perfMonitor = new PerformanceMonitor();
perfMonitor.init({
  trackFPS: true,
  trackMemory: false,
  updateFrequency: 1000,
  debug: false
});

// Start measuring an operation
perfMonitor.startMeasure('visibilityUpdate');

// End measuring
const duration = perfMonitor.endMeasure('visibilityUpdate');

// Update each frame
perfMonitor.update(time, delta);

// Get stats
const stats = perfMonitor.getStats();
```

### SpritePool

Manages a pool of reusable sprite objects.

```javascript
import { SpritePool } from '../dungeonRenderer';

const pool = new SpritePool(scene, 'floor', 100);
pool.setCreateFunction(() => {
  return scene.add.sprite(0, 0, 'floor');
});

// Get sprite from pool
const sprite = pool.get();

// Release sprite back to pool
pool.release(sprite);

// Get stats
const stats = pool.getStats();
```

## Textures

### TextureRegistry

Maps tile values to textures and manages texture loading.

```javascript
import { TextureRegistry } from '../dungeonRenderer';

const textureRegistry = new TextureRegistry(scene);
textureRegistry.init({
  tileSize: 64,
  debug: false
});

// Preload textures
await textureRegistry.preloadTextures();

// Get texture key for tile value
const textureKey = textureRegistry.getTextureKey(tileValue);

// Get fallback color
const color = textureRegistry.getFallbackColor(tileValue);
```

## Map Data Format

The DungeonRenderer expects map data in the following format:

```javascript
const mapData = {
  // Map dimensions
  worldTileWidth: 512,
  worldTileHeight: 512,
  dungeonTileWidth: 200,
  dungeonTileHeight: 200,
  
  // Properties
  tileSize: 64,
  floorLevel: 1,
  
  // Spawn points
  spawnPoints: [
    { id: 'spawn_1', x: 100, y: 100 },
    { id: 'spawn_2', x: 150, y: 100 }
  ],
  
  // Layers
  layers: {
    tiles: [...],     // 2D array of tile values
    props: [...],     // 2D array of prop values
    monsters: [...]   // 2D array of monster values
  },
  
  // Structural data
  structural: {
    rooms: [
      { id: 'room_1', x: 50, y: 50, width: 10, height: 8, type: 'normal' }
    ],
    corridors: [
      { x: 60, y: 54, width: 10, height: 4, direction: 'horizontal' }
    ],
    spawnRooms: [
      { id: 'spawn_room_1', x: 100, y: 100, width: 5, height: 5 }
    ]
  }
};
```

## Best Practices

1. **Initialize Early**: Initialize the renderer in your scene's `create` method
2. **Progressive Loading**: For large maps, load structures progressively
3. **Clean Up**: Always call `destroy()` in your scene's `shutdown` method
4. **Performance Monitoring**: Use the performance monitor to identify bottlenecks
5. **Mobile Optimization**: Reduce quality settings on mobile devices
6. **Memory Management**: Release unused sprites back to the pool

## Debugging

To enable debug mode, set `debug: true` when initializing the DungeonRenderer:

```javascript
dungeonRenderer.init({ debug: true });
```

This will show:
- Visible structure boundaries
- Sprite count and FPS
- Performance measurements
- Visibility culling areas

## Customization

The DungeonRenderer system is modular and can be extended by:

1. **Custom Texture Mapping**: Define your own texture mappings in `TextureRegistry`
2. **Custom Tile Factory**: Create your own tile creation logic
3. **Custom UI Components**: Replace or extend the minimap and loading UI
4. **Custom Culling Logic**: Implement custom visibility algorithms

## Troubleshooting

- **Performance Issues**: Check the performance monitor stats
- **Memory Leaks**: Ensure sprites are properly released to pools
- **Rendering Glitches**: Check for proper texture loading
- **Loading Errors**: Check console for detailed error messages

## API Reference

For complete API reference, see the source code documentation.

## License

This code is licensed under MIT License.
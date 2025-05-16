// src/dungeonRenderer2/index.js

// Main renderer class
import { DungeonRenderer } from './core/DungeonRenderer';

// Core components
import { StructureManager } from './core/StructureManager';
import { TileFactory } from './core/TileFactory';
import { LoadingManager } from './core/LoadingManager';

// UI components
import { MinimapRenderer } from './ui/MinimapRenderer';
import { DebugOverlay } from './ui/DebugOverlay';
import { LoadingUI } from './ui/LoadingUI';

// Utilities
import { VisibilityCulling } from './utils/VisibilityCulling';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import { SpritePool } from './utils/SpritePool';

// Textures
import { TextureRegistry } from './textures/TextureRegistry';

// Export the main DungeonRenderer as default export
export default DungeonRenderer;

// Named exports for individual components
export {
  // Core components
  DungeonRenderer,
  StructureManager,
  TileFactory,
  LoadingManager,
  
  // UI components
  MinimapRenderer,
  DebugOverlay,
  LoadingUI,
  
  // Utilities
  VisibilityCulling,
  PerformanceMonitor,
  SpritePool,
  
  // Textures
  TextureRegistry
};
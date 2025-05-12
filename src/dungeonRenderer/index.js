// src/dungeonRenderer/index.js
import { DungeonRenderer } from './DungeonRenderer.js';

// Export the main class as the default export
export default DungeonRenderer;

// Also export individual components for advanced usage
export { DungeonRenderer } from './DungeonRenderer.js';
export { StructureRenderer } from './renderers/StructureRenderer.js';
export { PropRenderer } from './renderers/PropRenderer.js';
export { MonsterRenderer } from './renderers/MonsterRenderer.js';
export { BackgroundRenderer } from './renderers/BackgroundRenderer.js';
export { MinimapRenderer } from './ui/MinimapRenderer.js';
export { TextureCache } from './utils/TextureCache.js';
export { VisibilityCulling } from './utils/VisibilityCulling.js';
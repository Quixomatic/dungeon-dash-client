// src/dungeonRenderer/renderers/BackgroundRenderer.js
/**
 * BackgroundRenderer - Handles rendering of the solid background layer
 * Renders a single large background using a tiling sprite for efficiency
 */
export class BackgroundRenderer {
  constructor(scene, textureCache) {
    this.scene = scene;
    this.textureCache = textureCache;
    this.background = null;
    this.tileSize = 64;
    this.debug = false;
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.tileSize = options.tileSize || 64;
    this.debug = options.debug || false;
    return this;
  }

  /**
   * Render the background layer
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  render(mapData, tileSize) {
    this.tileSize = tileSize || this.tileSize;

    // Clear existing background
    if (this.background) {
      this.background.destroy();
      this.background = null;
    }

    // Create a background that covers the entire world
    const worldWidth = mapData.worldTileWidth * this.tileSize;
    const worldHeight = mapData.worldTileHeight * this.tileSize;

    // Determine the appropriate background texture
    let backgroundTexture = "wall"; // Default texture key
    let backgroundColor = 0x444444; // Default color if texture not available

    // Try to use textures if they exist
    if (
      this.scene.textures.exists("wall") ||
      this.scene.textures.exists("background_wall")
    ) {
      // Use a tiling sprite for large backgrounds (more efficient than a huge sprite)
      const textureKey = this.scene.textures.exists("background_wall")
        ? "background_wall"
        : "wall";

      this.background = this.scene.add
        .tileSprite(0, 0, worldWidth, worldHeight, textureKey)
        .setOrigin(0, 0)
        .setDepth(5);
    } else {
      // Fallback to a solid rectangle if texture isn't available
      this.background = this.scene.add
        .rectangle(0, 0, worldWidth, worldHeight, backgroundColor)
        .setOrigin(0, 0)
        .setDepth(5);
    }

    if (this.debug) {
      console.log(`Created background: ${worldWidth}x${worldHeight}px`);
    }
  }

  /**
   * Clear the background
   */
  clear() {
    if (this.background) {
      this.background.destroy();
      this.background = null;
    }
  }

  /**
   * Destroy the renderer and clean up resources
   */
  destroy() {
    this.clear();
  }
}

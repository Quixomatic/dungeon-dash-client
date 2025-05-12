// src/dungeonRenderer/renderers/StructureRenderer.js
/**
 * StructureRenderer - Handles rendering of dungeon rooms and corridors
 * Uses render textures for efficient rendering of large structures
 */
export class StructureRenderer {
  constructor(scene, textureCache) {
    this.scene = scene;
    this.textureCache = textureCache;
    this.container = scene.add.container();
    this.structureTextures = {};
    this.visibleStructures = new Set();
    this.previouslyVisibleStructures = new Set();
    this.tileSize = 64;
    this.buffer = 5; // Default buffer size in tiles
    this.debug = false;
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.buffer = options.buffer || 5;
    this.tileSize = options.tileSize || 64;
    this.debug = options.debug || false;
    this.container.setDepth(10);
    return this;
  }

  /**
   * Render all structures from map data
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  render(mapData, tileSize) {
    if (!mapData || !mapData.structural) return;

    this.tileSize = tileSize || this.tileSize;

    // Process all rooms
    if (mapData.structural.rooms && Array.isArray(mapData.structural.rooms)) {
      mapData.structural.rooms.forEach((room) => {
        this.renderStructure(mapData, room, "room");
      });
    }

    // Process all corridors
    if (
      mapData.structural.corridors &&
      Array.isArray(mapData.structural.corridors)
    ) {
      mapData.structural.corridors.forEach((corridor) => {
        this.renderStructure(mapData, corridor, "corridor");
      });
    }

    // Process all spawn rooms
    if (
      mapData.structural.spawnRooms &&
      Array.isArray(mapData.structural.spawnRooms)
    ) {
      mapData.structural.spawnRooms.forEach((room) => {
        this.renderStructure(mapData, room, "spawnRoom");
      });
    }

    // Initial visibility check
    this.previouslyVisibleStructures.clear();
  }

  /**
   * Render a single structure (room or corridor) with buffer
   * @param {Object} mapData - Map data from server
   * @param {Object} structure - Structure data
   * @param {string} type - Type of structure ('room', 'corridor', 'spawnRoom')
   */
  renderStructure(mapData, structure, type) {
    // Generate unique ID for this structure
    const structureId = `${type}_${
      structure.id || structure.x + "_" + structure.y
    }`;

    // Skip if already rendered
    if (this.structureTextures[structureId]) return;

    // Calculate expanded bounds with buffer
    const bounds = this.getExpandedBounds(structure);

    // Ensure bounds are within map limits
    this.clampBounds(
      bounds,
      mapData.dungeonTileWidth,
      mapData.dungeonTileHeight
    );

    // Create render texture for this structure
    const renderTexture = this.scene.add
      .renderTexture(
        bounds.x * this.tileSize,
        bounds.y * this.tileSize,
        bounds.width * this.tileSize,
        bounds.height * this.tileSize
      )
      .setDepth(10)
      .setName(structureId)
      .setOrigin(0);

    // Draw all tiles for this structure
    this.drawTilesToTexture(mapData, renderTexture, bounds);

    // Store texture for reuse
    this.structureTextures[structureId] = {
      texture: renderTexture,
      bounds: bounds,
      type: type,
      originalStructure: structure,
      visible: false,
    };

    // Initially hidden until we update visibility
    renderTexture.setVisible(false);

    // Add to structures container
    this.container.add(renderTexture);

    if (this.debug) {
      console.log(
        `Rendered structure: ${structureId} at (${bounds.x},${bounds.y}) size ${bounds.width}x${bounds.height}`
      );
    }
  }

  /**
   * Draw tiles to a render texture
   * @param {Object} mapData - Map data from server
   * @param {Phaser.GameObjects.RenderTexture} renderTexture - Texture to draw to
   * @param {Object} bounds - Bounds to draw (in tile coordinates)
   */
  drawTilesToTexture(mapData, renderTexture, bounds) {
    // Clear the texture first
    renderTexture.clear();

    // Draw each tile in the bounds
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const worldX = bounds.x + x;
        const worldY = bounds.y + y;

        // Get tile value at this position
        let tileValue = 0; // Default to floor

        // If tile coordinates are within the map data
        if (
          mapData.layers.tiles &&
          mapData.layers.tiles[worldY] &&
          mapData.layers.tiles[worldY][worldX] !== undefined
        ) {
          tileValue = mapData.layers.tiles[worldY][worldX];
        }

        // Get the appropriate texture for this tile
        const tileTexture = this.textureCache.getTileTexture(
          tileValue,
          this.tileSize
        );

        // Draw tile texture to the render texture
        renderTexture.draw(tileTexture, x * this.tileSize, y * this.tileSize);
      }
    }
  }

  /**
   * Calculate expanded bounds with buffer for a structure
   * @param {Object} structure - Structure data
   * @returns {Object} - Expanded bounds
   */
  getExpandedBounds(structure) {
    return {
      x: Math.max(0, structure.x - this.buffer),
      y: Math.max(0, structure.y - this.buffer),
      width: structure.width + this.buffer * 2,
      height: structure.height + this.buffer * 2,
    };
  }

  /**
   * Clamp bounds to map limits
   * @param {Object} bounds - Bounds to clamp
   * @param {number} mapWidth - Map width in tiles
   * @param {number} mapHeight - Map height in tiles
   */
  clampBounds(bounds, mapWidth, mapHeight) {
    // Make sure x and y aren't negative
    if (bounds.x < 0) {
      bounds.width += bounds.x; // Reduce width by the amount x is negative
      bounds.x = 0;
    }

    if (bounds.y < 0) {
      bounds.height += bounds.y; // Reduce height by the amount y is negative
      bounds.y = 0;
    }

    // Make sure width and height don't exceed map dimensions
    if (bounds.x + bounds.width > mapWidth) {
      bounds.width = mapWidth - bounds.x;
    }

    if (bounds.y + bounds.height > mapHeight) {
      bounds.height = mapHeight - bounds.y;
    }
  }

  /**
   * Update visibility of structures based on camera position
   * @param {Object} cameraBounds - Camera bounds in pixels
   * @param {number} tileSize - Size of tiles in pixels
   */
  updateVisibility(cameraBounds, tileSize) {
    // Save previous state for comparison
    this.previouslyVisibleStructures = new Set(this.visibleStructures);
    this.visibleStructures.clear();

    // Check each structure
    Object.entries(this.structureTextures).forEach(([id, structureData]) => {
      // Calculate structure bounds in pixels
      const bounds = structureData.bounds;
      const pixelBounds = {
        left: bounds.x * tileSize,
        right: (bounds.x + bounds.width) * tileSize,
        top: bounds.y * tileSize,
        bottom: (bounds.y + bounds.height) * tileSize,
      };

      // Check if structure intersects with camera view
      const isVisible = !(
        pixelBounds.right < cameraBounds.left ||
        pixelBounds.left > cameraBounds.right ||
        pixelBounds.bottom < cameraBounds.top ||
        pixelBounds.top > cameraBounds.bottom
      );

      // Update visibility
      structureData.texture.setVisible(isVisible);
      structureData.visible = isVisible;

      if (isVisible) {
        this.visibleStructures.add(id);
      }
    });

    if (this.debug) {
      console.log(
        `Visible structures: ${this.visibleStructures.size}/${
          Object.keys(this.structureTextures).length
        }`
      );
    }
  }

  /**
   * Get all currently visible structures
   * @returns {Array} - Array of visible structure objects
   */
  getVisibleStructures() {
    const visible = [];

    this.visibleStructures.forEach((id) => {
      if (this.structureTextures[id]) {
        visible.push(this.structureTextures[id]);
      }
    });

    return visible;
  }

  /**
   * Get structures that just became visible in this update
   * @returns {Array} - Array of newly visible structure objects
   */
  getNewlyVisibleStructures() {
    const newlyVisible = [];

    this.visibleStructures.forEach((id) => {
      if (
        !this.previouslyVisibleStructures.has(id) &&
        this.structureTextures[id]
      ) {
        newlyVisible.push(this.structureTextures[id]);
      }
    });

    return newlyVisible;
  }

  /**
   * Get the count of visible structures
   * @returns {number} - Number of visible structures
   */
  getVisibleCount() {
    return this.visibleStructures.size;
  }

  /**
   * Check if a structure is visible
   * @param {string} id - Structure ID
   * @returns {boolean} - True if structure is visible
   */
  isStructureVisible(id) {
    return this.visibleStructures.has(id);
  }

  /**
   * Find which structure contains a point (in tile coordinates)
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @returns {Object|null} - Structure that contains the point, or null
   */
  findStructureContainingTile(tileX, tileY) {
    for (const [id, data] of Object.entries(this.structureTextures)) {
      const bounds = data.bounds;

      if (
        tileX >= bounds.x &&
        tileX < bounds.x + bounds.width &&
        tileY >= bounds.y &&
        tileY < bounds.y + bounds.height
      ) {
        return data;
      }
    }

    return null;
  }

  /**
   * Check if a point (in tile coordinates) is contained in any visible structure
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @returns {boolean} - True if the point is in a visible structure
   */
  isTileInVisibleStructure(tileX, tileY) {
    const structure = this.findStructureContainingTile(tileX, tileY);
    return structure && this.isStructureVisible(structure.id);
  }

  /**
   * Clear all structures
   */
  clear() {
    // Destroy all structure textures
    Object.values(this.structureTextures).forEach((data) => {
      if (data.texture) {
        data.texture.destroy();
      }
    });

    // Reset structure tracking
    this.structureTextures = {};
    this.visibleStructures.clear();
    this.previouslyVisibleStructures.clear();

    // Clear container
    this.container.removeAll(true);
  }

  /**
   * Destroy the renderer and clean up resources
   */
  destroy() {
    this.clear();

    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}

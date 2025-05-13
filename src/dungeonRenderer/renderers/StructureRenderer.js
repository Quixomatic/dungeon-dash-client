// src/dungeonRenderer/renderers/StructureRenderer.js - IMPROVED VERSION
/**
 * StructureRenderer - Handles rendering of dungeon rooms and corridors
 * Uses sprite batching for cross-platform compatibility
 */
export class StructureRenderer {
  constructor(scene, textureCache) {
    this.scene = scene;
    this.textureCache = textureCache;
    this.container = scene.add.container();
    this.structures = {}; // Map of structure ID to structure object
    this.visibleStructures = new Set(); // Set of visible structure IDs
    this.previouslyVisibleStructures = new Set();
    this.tileSize = 64;
    this.buffer = 8; // IMPROVED: Increased buffer from 5 to 8 tiles
    this.debug = false;

    // New property to track if a structure has ever been rendered
    this.renderedStructures = new Set();
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.buffer = options.buffer || 1; // IMPROVED: Default to higher buffer
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

    if (this.debug) {
      console.log(`Rendered ${Object.keys(this.structures).length} structures`);
    }
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
    if (this.structures[structureId]) return;

    // Calculate expanded bounds with buffer
    const bounds = this.getExpandedBounds(structure);

    // Ensure bounds are within map limits
    this.clampBounds(
      bounds,
      mapData.dungeonTileWidth,
      mapData.dungeonTileHeight
    );

    // Create a container for this structure
    const structureContainer = this.scene.add.container(
      bounds.x * this.tileSize,
      bounds.y * this.tileSize
    );
    structureContainer.setName(structureId);
    structureContainer.setDepth(10);

    // Draw all tiles for this structure
    this.drawTilesToContainer(mapData, structureContainer, bounds);

    // Store structure for reuse
    this.structures[structureId] = {
      container: structureContainer,
      bounds: bounds,
      type: type,
      originalStructure: structure,
      visible: false,
    };

    // Initially hidden until we update visibility
    structureContainer.setVisible(false);

    // Add to structures container
    this.container.add(structureContainer);

    if (this.debug) {
      console.log(
        `Rendered structure: ${structureId} at (${bounds.x},${bounds.y}) size ${bounds.width}x${bounds.height}`
      );
    }
  }

  /**
   * Draw tiles to a container - FIXED TILE ACCESS
   * @param {Object} mapData - Map data from server
   * @param {Phaser.GameObjects.Container} container - Container to add sprites to
   * @param {Object} bounds - Bounds to draw (in tile coordinates)
   */
  drawTilesToContainer(mapData, container, bounds) {
    // Draw debug outline if in debug mode
    if (this.debug) {
      const outline = this.scene.add.rectangle(
        0,
        0,
        bounds.width * this.tileSize,
        bounds.height * this.tileSize,
        0x00ff00,
        0.1
      );
      outline.setOrigin(0, 0);
      container.add(outline);
    }

    // Create sprites for each tile in the bounds
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const worldX = bounds.x + x;
        const worldY = bounds.y + y;

        // Get tile value at this position
        let tileValue = 0; // Default to floor

        // If tile coordinates are within the map data
        if (
          mapData.layers.tiles &&
          worldY >= 0 &&
          worldY < mapData.layers.tiles.length &&
          worldX >= 0 &&
          mapData.layers.tiles[worldY] &&
          worldX < mapData.layers.tiles[worldY].length
        ) {
          // CRITICAL FIX: Use worldX, not x
          tileValue = mapData.layers.tiles[worldY][worldX];
        }

        // Skip if tile is empty (shouldn't happen with default value)
        if (tileValue === undefined) continue;

        // Create sprite for this tile
        const tileKey = `tile_${tileValue}`;
        let tileSprite;

        // Try to use the texture if available
        if (this.scene.textures.exists(tileKey)) {
          tileSprite = this.scene.add.sprite(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            tileKey
          );
          tileSprite.setDisplaySize(this.tileSize, this.tileSize);
        } else {
          // Fallback based on tile type
          let color;
          if (tileValue > 0) {
            color = 0x666666; // Wall
          } else if (tileValue < 0) {
            color = 0x111111; // Hole
          } else {
            color = 0x333333; // Floor
          }

          tileSprite = this.scene.add.rectangle(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            this.tileSize,
            this.tileSize,
            color
          );
        }

        // Add to container
        container.add(tileSprite);

        // For debugging: add tiny text showing the tile value
        /*if (this.debug) {
            const tileText = this.scene.add.text(
              x * this.tileSize + 5,
              y * this.tileSize + 5,
              `${tileValue}`,
              { fontSize: "10px", fill: "#ffffff" }
            );
            container.add(tileText);
          }*/
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

    // IMPROVED: Add a larger buffer to camera bounds for smoother transitions
    const bufferSize = tileSize * 10; // Increased from 5 to 10 tiles
    const bufferedCameraBounds = {
      left: cameraBounds.left - bufferSize,
      right: cameraBounds.right + bufferSize,
      top: cameraBounds.top - bufferSize,
      bottom: cameraBounds.bottom + bufferSize,
    };

    // Check each structure
    Object.entries(this.structures).forEach(([id, structureData]) => {
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
        pixelBounds.right < bufferedCameraBounds.left ||
        pixelBounds.left > bufferedCameraBounds.right ||
        pixelBounds.bottom < bufferedCameraBounds.top ||
        pixelBounds.top > bufferedCameraBounds.bottom
      );

      // Update visibility
      structureData.container.setVisible(isVisible);
      structureData.visible = isVisible;

      if (isVisible) {
        this.visibleStructures.add(id);

        // IMPROVED: Track that this structure has been rendered at least once
        this.renderedStructures.add(id);
      }
    });

    if (this.debug) {
      console.log(
        `Visible structures: ${this.visibleStructures.size}/${
          Object.keys(this.structures).length
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
      if (this.structures[id]) {
        visible.push(this.structures[id]);
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
      if (!this.previouslyVisibleStructures.has(id) && this.structures[id]) {
        newlyVisible.push(this.structures[id]);
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
    for (const [id, data] of Object.entries(this.structures)) {
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
   * Clear all structures
   */
  clear() {
    // Destroy all structures
    Object.values(this.structures).forEach((data) => {
      if (data.container) {
        data.container.destroy();
      }
    });

    // Reset structure tracking
    this.structures = {};
    this.visibleStructures.clear();
    this.previouslyVisibleStructures.clear();
    this.renderedStructures.clear();

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

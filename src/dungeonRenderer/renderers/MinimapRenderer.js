// src/dungeonRenderer/renderers/MinimapRenderer.js - Fixed implementation
/**
 * MinimapRenderer - Handles rendering of the dungeon minimap
 * Creates a small overview map in the corner of the screen
 */
export class MinimapRenderer {
  constructor(scene) {
    this.scene = scene;
    this.container = null;
    this.background = null;
    this.border = null;
    this.graphics = null;
    this.playerMarker = null;
    this.floorText = null;

    // Minimap settings
    this.size = 200; // Default size in pixels (smaller than original)
    this.scale = 0.01; // Default scale factor
    this.margin = 20; // Margin from screen edge

    // Position offsets for centering
    this.offsetX = 0;
    this.offsetY = 0;

    this.debug = false;
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.size = options.size || this.size;
    this.debug = options.debug || false;

    // Create the minimap container
    this.createContainer();

    if (this.debug) {
      console.log(`MinimapRenderer initialized with size ${this.size}px`);
    }

    return this;
  }

  /**
   * Create minimap container and elements
   */
  createContainer() {
    // Create a container for the minimap
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000); // Ensure it's above other elements
    this.container.setScrollFactor(0); // Fixed to camera

    // Get camera dimensions
    const cameraWidth = this.scene.cameras.main.width;
    const cameraHeight = this.scene.cameras.main.height;

    // Position in top-right corner with margin
    const x = cameraWidth - this.size - this.margin;
    const y = this.margin;

    // Create a background rectangle for the minimap
    this.background = this.scene.add
      .rectangle(0, 0, this.size, this.size, 0x000000, 0.7)
      .setOrigin(0);

    // Add border to minimap
    this.border = this.scene.add.graphics();
    this.border.lineStyle(2, 0xffffff, 0.8);
    this.border.strokeRect(0, 0, this.size, this.size);

    // Create graphics for map elements
    this.graphics = this.scene.add.graphics();

    // Create player marker
    this.playerMarker = this.scene.add.circle(
      0,
      0, // Will be positioned in update
      4, // Radius
      0x00ff00, // Green
      1 // Alpha
    );

    // Add everything to container
    this.container.add([
      this.background,
      this.border,
      this.graphics,
      this.playerMarker,
    ]);

    // Position the entire container
    this.container.setPosition(x, y);

    if (this.debug) {
      console.log(`Minimap container created at (${x}, ${y})`);
    }
  }

  /**
   * Render the minimap
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  render(mapData, tileSize) {
    if (!mapData) {
      console.error("No map data provided to MinimapRenderer.render()");
      return;
    }

    if (this.debug) {
      console.log("Rendering minimap with map data:", {
        size: `${mapData.dungeonTileWidth}x${mapData.dungeonTileHeight}`,
        floorLevel: mapData.floorLevel || 1,
      });
    }

    // Clear existing minimap
    this.graphics.clear();

    // Remove floor text if it exists
    if (this.floorText) {
      this.floorText.destroy();
      this.floorText = null;
    }

    // Calculate scale to fit dungeon in minimap
    const dungeonWidthPx = mapData.dungeonTileWidth * tileSize;
    const dungeonHeightPx = mapData.dungeonTileHeight * tileSize;

    this.scale = Math.min(
      (this.size * 0.9) / dungeonWidthPx,
      (this.size * 0.9) / dungeonHeightPx
    );

    // Add a smaller zoom factor for better overview
    this.scale *= 0.6;

    // Center the map in the minimap
    this.offsetX = (this.size - dungeonWidthPx * this.scale) / 2;
    this.offsetY = (this.size - dungeonHeightPx * this.scale) / 2;

    // Draw the minimap
    this.drawMinimapContents(mapData, tileSize);

    if (this.debug) {
      console.log(`Minimap rendered with scale ${this.scale}`);
    }
  }

  /**
   * Draw the minimap contents
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  drawMinimapContents(mapData, tileSize) {
    // Draw dungeon background first
    this.graphics.fillStyle(0x333333, 0.8);
    this.graphics.fillRect(
      this.offsetX,
      this.offsetY,
      mapData.dungeonTileWidth * tileSize * this.scale,
      mapData.dungeonTileHeight * tileSize * this.scale
    );

    // Draw walls and rooms
    this.drawStructuralElements(mapData, tileSize);

    // Draw spawn points
    this.drawSpawnPoints(mapData);

    // Add floor level text
    this.floorText = this.scene.add
      .text(this.size / 2, this.size - 15, `Floor ${mapData.floorLevel || 1}`, {
        fontSize: "12px",
        fill: "#ffffff",
      })
      .setOrigin(0.5);

    // Add to container
    this.container.add(this.floorText);
  }

  /**
   * Draw structural elements (rooms, corridors) on minimap
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  drawStructuralElements(mapData, tileSize) {
    // Direct tile rendering if no structural data is available
    if (!mapData.structural) {
      this.drawTilesDirectly(mapData, tileSize);
      return;
    }

    // Draw rooms in a darker color
    this.graphics.fillStyle(0x444444, 1);
    if (mapData.structural.rooms && Array.isArray(mapData.structural.rooms)) {
      mapData.structural.rooms.forEach((room) => {
        const x = this.offsetX + room.x * tileSize * this.scale;
        const y = this.offsetY + room.y * tileSize * this.scale;
        const width = room.width * tileSize * this.scale;
        const height = room.height * tileSize * this.scale;

        this.graphics.fillRect(x, y, width, height);
      });
    }

    // Draw corridors in a slightly different color
    this.graphics.fillStyle(0x555555, 1);
    if (
      mapData.structural.corridors &&
      Array.isArray(mapData.structural.corridors)
    ) {
      mapData.structural.corridors.forEach((corridor) => {
        const x = this.offsetX + corridor.x * tileSize * this.scale;
        const y = this.offsetY + corridor.y * tileSize * this.scale;
        const width = corridor.width * tileSize * this.scale;
        const height = corridor.height * tileSize * this.scale;

        this.graphics.fillRect(x, y, width, height);
      });
    }

    // Draw spawn rooms in a highlight color
    this.graphics.fillStyle(0x8800ff, 0.7);
    if (
      mapData.structural.spawnRooms &&
      Array.isArray(mapData.structural.spawnRooms)
    ) {
      mapData.structural.spawnRooms.forEach((room) => {
        const x = this.offsetX + room.x * tileSize * this.scale;
        const y = this.offsetY + room.y * tileSize * this.scale;
        const width = room.width * tileSize * this.scale;
        const height = room.height * tileSize * this.scale;

        this.graphics.fillRect(x, y, width, height);
      });
    }
  }

  /**
   * Draw tile data directly (used when no structural data is available)
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  drawTilesDirectly(mapData, tileSize) {
    if (!mapData.layers || !mapData.layers.tiles) {
      if (this.debug) console.log("No tile data to draw on minimap");
      return;
    }

    // Draw walls with a higher contrast
    this.graphics.fillStyle(0x888888, 1);

    const tiles = mapData.layers.tiles;
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const tile = tiles[y][x];

        // Only draw walls (non-zero values)
        if (tile > 0) {
          const miniX = this.offsetX + x * this.scale * tileSize;
          const miniY = this.offsetY + y * this.scale * tileSize;
          const miniSize = Math.max(1, this.scale * tileSize);

          this.graphics.fillRect(miniX, miniY, miniSize, miniSize);
        }
      }
    }
  }

  /**
   * Draw spawn points on the minimap
   * @param {Object} mapData - Map data from server
   */
  drawSpawnPoints(mapData) {
    if (!mapData.spawnPoints || !Array.isArray(mapData.spawnPoints)) {
      return;
    }

    this.graphics.fillStyle(0x8800ff, 1);

    mapData.spawnPoints.forEach((spawn) => {
      const miniX = this.offsetX + spawn.x * this.scale;
      const miniY = this.offsetY + spawn.y * this.scale;

      this.graphics.fillCircle(miniX, miniY, 3);
    });
  }

  /**
   * Draw camera viewport on minimap
   */
  drawViewport() {
    const camera = this.scene.cameras.main;
    const viewX = this.offsetX + camera.scrollX * this.scale;
    const viewY = this.offsetY + camera.scrollY * this.scale;
    const viewWidth = camera.width * this.scale;
    const viewHeight = camera.height * this.scale;

    // Draw camera viewport rectangle
    this.graphics.lineStyle(1, 0xffff00, 0.8);
    this.graphics.strokeRect(viewX, viewY, viewWidth, viewHeight);
  }

  /**
   * Update player marker position
   * @param {number} x - Player x position in world
   * @param {number} y - Player y position in world
   */
  updatePlayerPosition(x, y) {
    if (!this.playerMarker || !this.scale) {
      return;
    }

    const minimapX = this.offsetX + x * this.scale;
    const minimapY = this.offsetY + y * this.scale;

    this.playerMarker.setPosition(minimapX, minimapY);

    if (this.debug) {
      // Log only occasionally to prevent spam
      if (Math.random() < 0.01) {
        console.log(`Updating player marker to ${minimapX}, ${minimapY}`);
      }
    }
  }

  /**
   * Handle resize event from scene
   * @param {number} width - New screen width
   * @param {number} height - New screen height
   */
  handleResize(width, height) {
    // Reposition minimap in top-right corner with margin
    const x = width - this.size - this.margin;
    const y = this.margin;

    // Update container position
    this.container.setPosition(x, y);

    if (this.debug) {
      console.log(`Minimap repositioned to (${x}, ${y}) after resize`);
    }
  }

  /**
   * Set debug mode
   * @param {boolean} enabled - Whether debug mode is enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
    return this;
  }

  /**
   * Toggle visibility of the minimap
   * @param {boolean} visible - Whether the minimap should be visible
   */
  setVisible(visible) {
    if (this.container) {
      this.container.setVisible(visible);
    }
    return this;
  }

  /**
   * Clear the minimap
   */
  clear() {
    if (this.graphics) {
      this.graphics.clear();
    }

    if (this.floorText) {
      this.floorText.destroy();
      this.floorText = null;
    }
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

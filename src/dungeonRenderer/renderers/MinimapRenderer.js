// src/dungeonRenderer/ui/MinimapRenderer.js
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
    this.size = 400; // Default size in pixels
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
    this.size = options.size || 400;
    this.debug = options.debug || false;

    // Create the minimap container
    this.createContainer();

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
  }

  /**
   * Render the minimap
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  render(mapData, tileSize) {
    if (!mapData) return;

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
    // Draw dungeon structure first
    if (mapData.structural) {
      // First draw floor background
      this.graphics.fillStyle(0x333333, 0.8);
      this.graphics.fillRect(
        this.offsetX,
        this.offsetY,
        mapData.dungeonTileWidth * tileSize * this.scale,
        mapData.dungeonTileHeight * tileSize * this.scale
      );

      // Then draw walls and rooms
      this.drawStructures(mapData, tileSize);
    } else if (mapData.layers && mapData.layers.tiles) {
      // Use tile data directly if structural data isn't available
      this.drawTiles(mapData, tileSize);
    }

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
   * Draw structures (rooms and corridors) on the minimap
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  drawStructures(mapData, tileSize) {
    const structural = mapData.structural;

    // Draw rooms in a different color
    this.graphics.fillStyle(0x444444, 1);
    if (structural.rooms && Array.isArray(structural.rooms)) {
      structural.rooms.forEach((room) => {
        const x = this.offsetX + room.x * tileSize * this.scale;
        const y = this.offsetY + room.y * tileSize * this.scale;
        const width = room.width * tileSize * this.scale;
        const height = room.height * tileSize * this.scale;

        this.graphics.fillRect(x, y, width, height);
      });
    }

    // Draw corridors in a slightly different color
    this.graphics.fillStyle(0x555555, 1);
    if (structural.corridors && Array.isArray(structural.corridors)) {
      structural.corridors.forEach((corridor) => {
        const x = this.offsetX + corridor.x * tileSize * this.scale;
        const y = this.offsetY + corridor.y * tileSize * this.scale;
        const width = corridor.width * tileSize * this.scale;
        const height = corridor.height * tileSize * this.scale;

        this.graphics.fillRect(x, y, width, height);
      });
    }

    // Draw spawn rooms in a highlight color
    this.graphics.fillStyle(0x8800ff, 0.7);
    if (structural.spawnRooms && Array.isArray(structural.spawnRooms)) {
      structural.spawnRooms.forEach((room) => {
        const x = this.offsetX + room.x * tileSize * this.scale;
        const y = this.offsetY + room.y * tileSize * this.scale;
        const width = room.width * tileSize * this.scale;
        const height = room.height * tileSize * this.scale;

        this.graphics.fillRect(x, y, width, height);
      });
    }
  }

  /**
   * Draw tiles directly on the minimap
   * @param {Object} mapData - Map data from server
   * @param {number} tileSize - Size of tiles in pixels
   */
  drawTiles(mapData, tileSize) {
    const tiles = mapData.layers.tiles;

    // First draw floor background
    this.graphics.fillStyle(0x333333, 0.8);
    this.graphics.fillRect(
      this.offsetX,
      this.offsetY,
      mapData.dungeonTileWidth * tileSize * this.scale,
      mapData.dungeonTileHeight * tileSize * this.scale
    );

    // Draw walls
    this.graphics.fillStyle(0x666666, 0.8);

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const tile = tiles[y][x];

        // Only draw walls
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
    if (!mapData.spawnPoints || !Array.isArray(mapData.spawnPoints)) return;

    this.graphics.fillStyle(0x8800ff, 1);

    mapData.spawnPoints.forEach((spawn) => {
      const miniX = this.offsetX + spawn.x * this.scale;
      const miniY = this.offsetY + spawn.y * this.scale;

      this.graphics.fillCircle(miniX, miniY, 3);
    });
  }

  /**
   * Update player marker position
   * @param {number} x - Player x position in world
   * @param {number} y - Player y position in world
   */
  updatePlayerPosition(x, y) {
    if (!this.playerMarker || !this.scale) return;

    const minimapX = this.offsetX + x * this.scale;
    const minimapY = this.offsetY + y * this.scale;

    this.playerMarker.setPosition(minimapX, minimapY);
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

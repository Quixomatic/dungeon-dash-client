// src/managers/DungeonRenderer.js
import {
  getTemplateById,
  registerTemplates,
  getTileColor,
  TILE_TYPES,
  generateBasicLayout,
} from "../data/DungeonTemplates.js";

/**
 * DungeonRenderer - Efficiently renders the dungeon with culling
 */
export class DungeonRenderer {
  constructor(scene) {
    this.scene = scene;
    this.tileSize = 64; // Default tile size

    // Layer organization
    this.layers = {
      background: null,
      floor: null,
      walls: null,
      objects: null,
      overlay: null,
    };

    // Minimap
    this.minimapTexture = null;
    this.playerMarker = null;
    this.minimapSize = 200; // Size of minimap in pixels
    this.minimapScale = 0.01; // Scale factor for minimap

    // Map data
    this.mapData = null;

    // Culling system
    this.visibleTiles = new Map(); // Map of tile IDs to sprites
    this.objectPools = {
      floor: [],
      wall: [],
      object: [],
      corridor: [],
      overlay: [],
    };

    // Visible region tracking
    this.visibleRegion = {
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
    };

    // Culling buffer (in tiles)
    this.cullingBuffer = 3;

    // Spatial index for fast lookups
    this.spatialIndex = new Map();

    // Debug
    this.debug = false;
    this.debugText = null;
    this.renderStats = {
      visibleTiles: 0,
      hiddenTiles: 0,
      poolSize: 0,
      renderTime: 0,
    };
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    this.debug = options.debug || false;
    this.tileSize = options.tileSize || 64;

    console.log(
      `DungeonRenderer initialized with tileSize: ${this.tileSize}px`
    );

    // Create layer groups to organize sprites
    this.layers.background = this.scene.add.group();
    this.layers.floor = this.scene.add.group();
    this.layers.walls = this.scene.add.group();
    this.layers.objects = this.scene.add.group();
    this.layers.overlay = this.scene.add.group();

    // Set depths to ensure correct rendering order
    this.layers.background.setDepth(5);
    this.layers.floor.setDepth(10);
    this.layers.walls.setDepth(20);
    this.layers.objects.setDepth(30);
    this.layers.overlay.setDepth(100);

    // Create minimap
    this.createMinimap();

    // Register resize handler
    this.scene.scale.on("resize", this.handleResize, this);

    // Debug text
    if (this.debug) {
      this.debugText = this.scene.add
        .text(10, 10, "Waiting for map data...", {
          fontSize: "14px",
          fill: "#ffffff",
          backgroundColor: "#00000080",
          padding: { x: 5, y: 5 },
        })
        .setScrollFactor(0)
        .setDepth(1000);
    }

    return this;
  }

  /**
   * Create the minimap
   */
  createMinimap() {
    // Create a container for the minimap
    this.minimapContainer = this.scene.add.container(0, 0);
    this.minimapContainer.setDepth(1000);
    this.minimapContainer.setScrollFactor(0); // Fixed to camera

    // Get camera dimensions
    const cameraWidth = this.scene.cameras.main.width;
    const cameraHeight = this.scene.cameras.main.height;

    // Position in top-right corner with padding
    const padding = 20;
    this.minimapX = cameraWidth - this.minimapSize - padding;
    this.minimapY = padding;

    // Create a background rectangle for the minimap
    this.minimapBackground = this.scene.add.rectangle(
      this.minimapX + this.minimapSize / 2,
      this.minimapY + this.minimapSize / 2,
      this.minimapSize,
      this.minimapSize,
      0x000000,
      0.7
    );

    // Add border to minimap
    this.minimapBorder = this.scene.add.graphics();
    this.minimapBorder.lineStyle(2, 0xffffff, 0.8);
    this.minimapBorder.strokeRect(
      this.minimapX,
      this.minimapY,
      this.minimapSize,
      this.minimapSize
    );

    // Create a container for map elements
    this.minimapElements = this.scene.add.graphics();
    this.minimapElements.setScrollFactor(0);

    // Create player marker
    this.playerMarker = this.scene.add.circle(
      this.minimapX + this.minimapSize / 2, // Center initially
      this.minimapY + this.minimapSize / 2, // Center initially
      4, // Radius
      0x00ff00, // Green
      1 // Alpha
    );
    this.playerMarker.setScrollFactor(0);
    this.playerMarker.setDepth(1002);

    // Add everything to container
    this.minimapContainer.add([
      this.minimapBackground,
      this.minimapBorder,
      this.minimapElements,
      this.playerMarker,
    ]);

    console.log(
      `Minimap created at (${this.minimapX}, ${this.minimapY}) with size ${this.minimapSize}`
    );
  }

  /**
   * Handle resize event to reposition minimap
   * @param {width} width - New screen width
   * @param {height} height - New screen height
   */
  handleResize(width, height) {
    if (!this.minimapContainer) return;

    // Calculate new position
    const padding = 20;
    this.minimapX = width - this.minimapSize - padding;
    this.minimapY = padding;

    // Update minimap position
    this.minimapBackground.setPosition(
      this.minimapX + this.minimapSize / 2,
      this.minimapY + this.minimapSize / 2
    );

    // Update border
    this.minimapBorder.clear();
    this.minimapBorder.lineStyle(2, 0xffffff, 0.8);
    this.minimapBorder.strokeRect(
      this.minimapX,
      this.minimapY,
      this.minimapSize,
      this.minimapSize
    );

    // Redraw map elements with new position
    this.generateMinimap();

    console.log(`Minimap repositioned to (${this.minimapX}, ${this.minimapY})`);
  }

  /**
   * Process and render a new dungeon map
   * @param {Object} mapData - Map data from server
   */
  renderMap(mapData) {
    console.time("mapProcessing");

    // Clear any existing map
    this.clearMap();

    // Store map data
    this.mapData = mapData;

    // Update tile size from map data if provided
    if (mapData.tileSize) {
      this.tileSize = mapData.tileSize;
      console.log(`Updated tile size to ${this.tileSize}px from map data`);
    }

    // Register templates if provided
    if (mapData.templates) {
      registerTemplates(mapData.templates);
    }

    // Process rooms and corridors
    this.processMapData();

    // Create spatial index for fast lookups
    this.createSpatialIndex();

    // Generate minimap
    this.generateMinimap();

    // Set camera bounds - convert tile dimensions to pixels
    if (mapData.worldTileWidth && mapData.worldTileHeight) {
      const worldWidthPx = mapData.worldTileWidth * this.tileSize;
      const worldHeightPx = mapData.worldTileHeight * this.tileSize;
      this.scene.cameras.main.setBounds(0, 0, worldWidthPx, worldHeightPx);

      console.log(
        `Set camera bounds to ${worldWidthPx}x${worldHeightPx}px (${mapData.worldTileWidth}x${mapData.worldTileHeight} tiles)`
      );
    }

    // Initial render based on camera position
    this.updateVisibleArea();

    // Add floor level text to minimap
    if (this.floorText) {
      this.floorText.destroy();
    }

    this.floorText = this.scene.add
      .text(
        this.minimapX + this.minimapSize / 2,
        this.minimapY + this.minimapSize - 15,
        `Floor ${mapData.floorLevel || 1}`,
        { fontSize: "12px", fill: "#ffffff" }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    // Update debug info
    if (this.debug && this.debugText) {
      const dungeonWidthPx = (mapData.dungeonTileWidth || 100) * this.tileSize;
      const dungeonHeightPx =
        (mapData.dungeonTileHeight || 100) * this.tileSize;

      this.debugText.setText(
        `Map: ${mapData.worldTileWidth || 0}x${
          mapData.worldTileHeight || 0
        } tiles (${this.tileSize}px each)\n` +
          `Dungeon: ${mapData.dungeonTileWidth || 0}x${
            mapData.dungeonTileHeight || 0
          } tiles (${dungeonWidthPx}x${dungeonHeightPx}px)\n` +
          `Rooms: ${mapData.rooms?.length || 0}, Corridors: ${
            mapData.corridors?.length || 0
          }`
      );
    }

    console.timeEnd("mapProcessing");
  }

  /**
   * Process map data to prepare for rendering
   */
  processMapData() {
    if (!this.mapData) return;

    // Process rooms
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        // Expand template references
        if (room.t) {
          const template = getTemplateById(room.t);
          if (template) {
            room.template = template;
            room.layout = template.layout;
            room.objects = template.objects;
          }
        }

        // Generate layout if not present
        if (!room.layout) {
          room.layout = generateBasicLayout(room.width, room.height);
        }
      });
    }

    // Standardize corridor properties
    if (this.mapData.corridors) {
      this.mapData.corridors.forEach((corridor) => {
        // Standardize properties
        if (!corridor.start && corridor.s) {
          corridor.start = corridor.s;
        }

        if (!corridor.end && corridor.e) {
          corridor.end = corridor.e;
        }

        if (!corridor.waypoint && corridor.w) {
          corridor.waypoint = corridor.w;
        }

        // Default width
        if (!corridor.width) {
          corridor.width = 3;
        }
      });
    }
  }

  /**
   * Create a spatial index for efficient culling
   */
  createSpatialIndex() {
    // Grid-based spatial index
    this.spatialIndex = new Map();

    // Cell size in tiles (not pixels)
    // We're indexing in tile space, not pixel space
    const cellSize = 10; // 10x10 tiles per cell

    // Index rooms
    if (this.mapData && this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        // Calculate cells this room occupies (in tile coordinates)
        const startCellX = Math.floor(room.x / cellSize);
        const startCellY = Math.floor(room.y / cellSize);
        const endCellX = Math.floor((room.x + room.width) / cellSize);
        const endCellY = Math.floor((room.y + room.height) / cellSize);

        // Register room in all cells it overlaps
        for (let cellX = startCellX; cellX <= endCellX; cellX++) {
          for (let cellY = startCellY; cellY <= endCellY; cellY++) {
            const cellKey = `${cellX},${cellY}`;

            if (!this.spatialIndex.has(cellKey)) {
              this.spatialIndex.set(cellKey, { rooms: [], corridors: [] });
            }

            this.spatialIndex.get(cellKey).rooms.push(room);
          }
        }
      });
    }

    // Index corridors
    if (this.mapData && this.mapData.corridors) {
      this.mapData.corridors.forEach((corridor) => {
        // Calculate bounding box of corridor in tile coordinates
        let minX = Math.min(corridor.start.x, corridor.end.x);
        let minY = Math.min(corridor.start.y, corridor.end.y);
        let maxX = Math.max(corridor.start.x, corridor.end.x);
        let maxY = Math.max(corridor.start.y, corridor.end.y);

        // Adjust for waypoint if present
        if (corridor.waypoint) {
          minX = Math.min(minX, corridor.waypoint.x);
          minY = Math.min(minY, corridor.waypoint.y);
          maxX = Math.max(maxX, corridor.waypoint.x);
          maxY = Math.max(maxY, corridor.waypoint.y);
        }

        // Calculate cells this corridor occupies (in tile coordinates)
        const startCellX = Math.floor(minX / cellSize);
        const startCellY = Math.floor(minY / cellSize);
        const endCellX = Math.floor(maxX / cellSize);
        const endCellY = Math.floor(maxY / cellSize);

        // Register corridor in all cells it overlaps
        for (let cellX = startCellX; cellX <= endCellX; cellX++) {
          for (let cellY = startCellY; cellY <= endCellY; cellY++) {
            const cellKey = `${cellX},${cellY}`;

            if (!this.spatialIndex.has(cellKey)) {
              this.spatialIndex.set(cellKey, { rooms: [], corridors: [] });
            }

            this.spatialIndex.get(cellKey).corridors.push(corridor);
          }
        }
      });
    }

    if (this.debug) {
      console.log(`Spatial index created with ${this.spatialIndex.size} cells`);
    }
  }

  /**
   * Generate minimap graphics based on dungeon layout
   */
  generateMinimap() {
    if (!this.mapData) return;

    // Clear existing minimap elements
    this.minimapElements.clear();

    // Calculate world dimensions in pixels
    const worldWidthPx = (this.mapData.worldTileWidth || 312) * this.tileSize;
    const worldHeightPx = (this.mapData.worldTileHeight || 312) * this.tileSize;

    // Calculate scale to fit dungeon in minimap
    this.minimapScale = Math.min(
      this.minimapSize / worldWidthPx,
      this.minimapSize / worldHeightPx
    );

    console.log(
      `Minimap scale: ${this.minimapScale} (${this.minimapSize}px / ${worldWidthPx}px)`
    );

    // Draw rooms
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        // Convert tile coordinates to pixels for rendering
        const pixelX = room.x * this.tileSize;
        const pixelY = room.y * this.tileSize;
        const pixelWidth = room.width * this.tileSize;
        const pixelHeight = room.height * this.tileSize;

        // Set color based on room type
        if (room.type === "spawn") {
          this.minimapElements.fillStyle(0x8800ff, 0.8); // Purple for spawn rooms
        } else {
          this.minimapElements.fillStyle(0x888888, 0.6); // Gray for normal rooms
        }

        // Draw room rectangle on minimap (scaled)
        this.minimapElements.fillRect(
          this.minimapX + pixelX * this.minimapScale,
          this.minimapY + pixelY * this.minimapScale,
          pixelWidth * this.minimapScale,
          pixelHeight * this.minimapScale
        );
      });
    }

    // Draw corridors
    if (this.mapData.corridors) {
      this.minimapElements.lineStyle(2, 0x666666, 0.5);

      this.mapData.corridors.forEach((corridor) => {
        // Convert tile coordinates to pixels
        const start = {
          x:
            this.minimapX +
            corridor.start.x * this.tileSize * this.minimapScale,
          y:
            this.minimapY +
            corridor.start.y * this.tileSize * this.minimapScale,
        };

        const end = {
          x: this.minimapX + corridor.end.x * this.tileSize * this.minimapScale,
          y: this.minimapY + corridor.end.y * this.tileSize * this.minimapScale,
        };

        if (corridor.waypoint) {
          const waypoint = {
            x:
              this.minimapX +
              corridor.waypoint.x * this.tileSize * this.minimapScale,
            y:
              this.minimapY +
              corridor.waypoint.y * this.tileSize * this.minimapScale,
          };

          // Draw L-shaped corridor with waypoint
          this.minimapElements.beginPath();
          this.minimapElements.moveTo(start.x, start.y);
          this.minimapElements.lineTo(waypoint.x, waypoint.y);
          this.minimapElements.lineTo(end.x, end.y);
          this.minimapElements.strokePath();
        } else {
          // Draw straight corridor
          this.minimapElements.beginPath();
          this.minimapElements.moveTo(start.x, start.y);
          this.minimapElements.lineTo(end.x, end.y);
          this.minimapElements.strokePath();
        }
      });
    }

    // Add floor level text
    if (this.floorText) {
      this.floorText.destroy();
    }

    this.floorText = this.scene.add
      .text(
        this.minimapX + this.minimapSize / 2,
        this.minimapY + this.minimapSize - 15,
        `Floor ${this.mapData.floorLevel || 1}`,
        { fontSize: "12px", fill: "#ffffff" }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.minimapContainer.add(this.floorText);
  }

  /**
   * Update minimap with player position
   * @param {number} x - Player x position in pixels
   * @param {number} y - Player y position in pixels
   */
  update(x, y) {
    // Skip if no map loaded
    if (!this.mapData) return;

    // Update visible area based on camera position
    this.updateVisibleArea();

    // Update minimap player marker
    this.updateMinimapMarker(x, y);
  }

  /**
   * Update minimap with player position
   * @param {number} x - Player x position in pixels
   * @param {number} y - Player y position in pixels
   */
  updateMinimapMarker(x, y) {
    if (!this.playerMarker || !this.minimapScale) return;

    // Calculate position on minimap - using world pixel coordinates
    const minimapX = this.minimapX + x * this.minimapScale;
    const minimapY = this.minimapY + y * this.minimapScale;

    // Update marker position
    this.playerMarker.setPosition(minimapX, minimapY);

    // Debug output the position of minimap and marker
    if (this.debug && Math.random() < 0.01) {
      // Only log occasionally
      console.log(
        `Player at ${x},${y} => Minimap marker at ${minimapX},${minimapY}`
      );
      console.log(
        `Minimap at ${this.minimapX},${this.minimapY}, scale ${this.minimapScale}`
      );
    }
  }

  /**
   * Get entities in the current visible area
   */
  getVisibleEntities() {
    if (!this.mapData || !this.spatialIndex)
      return { rooms: [], corridors: [] };

    // Get camera view bounds in pixels
    const camera = this.scene.cameras.main;

    // Convert screen bounds to world coordinates with buffer in pixels
    const viewportBounds = {
      left: camera.scrollX - this.cullingBuffer * this.tileSize,
      right: camera.scrollX + camera.width + this.cullingBuffer * this.tileSize,
      top: camera.scrollY - this.cullingBuffer * this.tileSize,
      bottom:
        camera.scrollY + camera.height + this.cullingBuffer * this.tileSize,
    };

    // Convert to tile coordinates
    const startTileX = Math.floor(viewportBounds.left / this.tileSize);
    const startTileY = Math.floor(viewportBounds.top / this.tileSize);
    const endTileX = Math.ceil(viewportBounds.right / this.tileSize);
    const endTileY = Math.ceil(viewportBounds.bottom / this.tileSize);

    // Convert to cell coordinates (for spatial index lookup)
    const cellSize = 10; // Same as used in createSpatialIndex
    const startCellX = Math.floor(startTileX / cellSize);
    const startCellY = Math.floor(startTileY / cellSize);
    const endCellX = Math.floor(endTileX / cellSize);
    const endCellY = Math.floor(endTileY / cellSize);

    // Track visible entities
    const visibleRooms = new Set();
    const visibleCorridors = new Set();

    // Collect entities from cells
    for (let cellX = startCellX; cellX <= endCellX; cellX++) {
      for (let cellY = startCellY; cellY <= endCellY; cellY++) {
        const cellKey = `${cellX},${cellY}`;

        // Skip if cell has no entities
        if (!this.spatialIndex.has(cellKey)) continue;

        const cell = this.spatialIndex.get(cellKey);

        // Add rooms from this cell
        cell.rooms.forEach((room) => {
          visibleRooms.add(room);
        });

        // Add corridors from this cell
        cell.corridors.forEach((corridor) => {
          visibleCorridors.add(corridor);
        });
      }
    }

    return {
      rooms: Array.from(visibleRooms),
      corridors: Array.from(visibleCorridors),
    };
  }

  /**
   * Update the visible area based on camera position
   */
  updateVisibleArea() {
    if (!this.mapData) return;

    const startTime = performance.now();

    // Get visible entities
    const { rooms, corridors } = this.getVisibleEntities();

    // Remove entities that are no longer visible
    this.cullInvisibleEntities(rooms, corridors);

    // Render visible entities
    this.renderVisibleRooms(rooms);
    this.renderVisibleCorridors(corridors);

    // Update render stats
    this.renderStats.renderTime = performance.now() - startTime;
    this.renderStats.visibleTiles = this.visibleTiles.size;

    // Update debug text
    if (this.debug && this.debugText) {
      this.debugText.setText(
        `Render: ${Math.round(this.renderStats.renderTime)}ms | ` +
          `Visible: ${this.renderStats.visibleTiles} | ` +
          `Rooms: ${rooms.length} | ` +
          `Corridors: ${corridors.length}`
      );
    }
  }

  /**
   * Render visible rooms
   * @param {Array} rooms - Array of visible room objects
   */
  renderVisibleRooms(rooms) {
    // Process each room
    rooms.forEach((room) => {
      // Skip if room already rendered
      if (this.visibleTiles.has(`room_${room.id}`)) return;

      // Mark room as rendered
      this.visibleTiles.set(`room_${room.id}`, true);

      // Render room layout
      if (room.layout) {
        for (let y = 0; y < room.layout.length; y++) {
          const row = room.layout[y];

          for (let x = 0; x < row.length; x++) {
            const tileChar = row.charAt(x);
            // Convert room position (in tiles) + internal position to tile coordinates
            const tileX = room.x + x;
            const tileY = room.y + y;

            // Create tile based on type
            this.createTile(tileChar, tileX, tileY, room.type);
          }
        }
      }

      // Render room objects if any
      if (room.objects) {
        room.objects.forEach((obj) => {
          const tileX = room.x + obj.x;
          const tileY = room.y + obj.y;

          // Create object
          this.createObject(obj.type, tileX, tileY);
        });
      }
    });
  }

  /**
   * Render visible corridors
   * @param {Array} corridors - Array of visible corridor objects
   */
  renderVisibleCorridors(corridors) {
    // Process each corridor
    corridors.forEach((corridor) => {
      // Skip if corridor already rendered
      if (this.visibleTiles.has(`corridor_${corridor.id}`)) return;

      // Mark corridor as rendered
      this.visibleTiles.set(`corridor_${corridor.id}`, true);

      // Render corridor
      this.renderCorridor(corridor);
    });
  }

  /**
   * Render a corridor
   * @param {Object} corridor - Corridor data
   */
  renderCorridor(corridor) {
    // Convert tile coordinates to pixels
    const start = {
      x: corridor.start.x * this.tileSize,
      y: corridor.start.y * this.tileSize,
    };

    const end = {
      x: corridor.end.x * this.tileSize,
      y: corridor.end.y * this.tileSize,
    };

    const waypoint = corridor.waypoint
      ? {
          x: corridor.waypoint.x * this.tileSize,
          y: corridor.waypoint.y * this.tileSize,
        }
      : null;

    // Corridor color
    const color = corridor.isSpawnCorridor ? 0x8800ff : 0x666666;

    // Create a corridor graphic
    const corridorGraphic = this.scene.add.graphics();

    // Set style
    corridorGraphic.fillStyle(color, 0.8);

    // Draw corridor
    if (waypoint) {
      // Render L-shaped corridor
      this.renderCorridorSegment(
        corridorGraphic,
        start,
        waypoint,
        corridor.width
      );
      this.renderCorridorSegment(
        corridorGraphic,
        waypoint,
        end,
        corridor.width
      );
    } else {
      // Render straight corridor
      this.renderCorridorSegment(corridorGraphic, start, end, corridor.width);
    }

    // Add to layer
    this.layers.floor.add(corridorGraphic);
  }

  /**
   * Render a corridor segment
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object
   * @param {Object} start - Start point {x, y} in pixels
   * @param {Object} end - End point {x, y} in pixels
   * @param {number} width - Corridor width in tiles
   */
  renderCorridorSegment(graphics, start, end, width) {
    // Calculate corridor properties
    const halfWidth = (width * this.tileSize) / 2;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const length = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );

    // Calculate perpendicular offset
    const perpX = Math.sin(angle) * halfWidth;
    const perpY = -Math.cos(angle) * halfWidth;

    // Define corners
    const corners = [
      { x: start.x - perpX, y: start.y - perpY },
      { x: start.x + perpX, y: start.y + perpY },
      { x: end.x + perpX, y: end.y + perpY },
      { x: end.x - perpX, y: end.y - perpY },
    ];

    // Draw corridor polygon
    graphics.beginPath();
    graphics.moveTo(corners[0].x, corners[0].y);

    for (let i = 1; i < corners.length; i++) {
      graphics.lineTo(corners[i].x, corners[i].y);
    }

    graphics.closePath();
    graphics.fillPath();
  }

  /**
   * Create a tile sprite
   * @param {string} tileChar - Tile character from layout
   * @param {number} x - World x position in tile coordinates
   * @param {number} y - World y position in tile coordinates
   * @param {string} roomType - Room type for coloring
   */
  createTile(tileChar, x, y, roomType = "small") {
    // Generate unique ID for this tile
    const tileId = `tile_${x}_${y}_${tileChar}`;

    // Skip if already rendered
    if (this.visibleTiles.has(tileId)) return;

    // Mark as rendered
    this.visibleTiles.set(tileId, true);

    // Color for this tile
    const tileColor = getTileColor(tileChar, roomType);

    // Create different tiles based on type
    switch (tileChar) {
      case TILE_TYPES.WALL:
        this.createWallTile(x, y, tileColor);
        break;
      case TILE_TYPES.FLOOR:
        this.createFloorTile(x, y, tileColor);
        break;
      case TILE_TYPES.DOOR:
        this.createDoorTile(x, y, tileColor);
        break;
      case TILE_TYPES.SPAWN:
        this.createSpawnTile(x, y, tileColor);
        break;
      case TILE_TYPES.CHEST:
      case TILE_TYPES.TORCH:
        // For objects, create a floor tile first
        this.createFloorTile(x, y, getTileColor(TILE_TYPES.FLOOR, roomType));
        // Then add the object on top
        this.createObject(tileChar.toLowerCase(), x, y);
        break;
      default:
        // Default to floor for unknown tile types
        this.createFloorTile(x, y, tileColor);
    }
  }

  /**
   * Create a wall tile
   * @param {number} x - World x position in tile coordinates
   * @param {number} y - World y position in tile coordinates
   * @param {number} color - Tile color
   */
  createWallTile(x, y, color) {
    // Convert tile coordinates to pixel coordinates
    const pixelX = x * this.tileSize;
    const pixelY = y * this.tileSize;

    // Get a wall sprite from the pool or create new
    let wall;

    if (this.objectPools.wall.length > 0) {
      wall = this.objectPools.wall.pop();
      wall.setPosition(pixelX + this.tileSize / 2, pixelY + this.tileSize / 2);
      wall.setSize(this.tileSize, this.tileSize);
      wall.setVisible(true);
    } else {
      wall = this.scene.add.rectangle(
        pixelX + this.tileSize / 2,
        pixelY + this.tileSize / 2,
        this.tileSize,
        this.tileSize,
        color
      );

      // Add to walls layer
      this.layers.walls.add(wall);
    }

    // Set color
    wall.setFillStyle(color);

    // Store in visible tiles
    this.visibleTiles.set(`tile_${x}_${y}_${TILE_TYPES.WALL}`, wall);
  }

  /**
   * Create a floor tile
   * @param {number} x - World x position in tile coordinates
   * @param {number} y - World y position in tile coordinates
   * @param {number} color - Tile color
   */
  createFloorTile(x, y, color) {
    // Convert tile coordinates to pixel coordinates
    const pixelX = x * this.tileSize;
    const pixelY = y * this.tileSize;

    // Get a floor sprite from the pool or create new
    let floor;

    if (this.objectPools.floor.length > 0) {
      floor = this.objectPools.floor.pop();
      floor.setPosition(pixelX + this.tileSize / 2, pixelY + this.tileSize / 2);
      floor.setSize(this.tileSize, this.tileSize);
      floor.setVisible(true);
    } else {
      floor = this.scene.add.rectangle(
        pixelX + this.tileSize / 2,
        pixelY + this.tileSize / 2,
        this.tileSize,
        this.tileSize,
        color
      );

      // Add to floor layer
      this.layers.floor.add(floor);
    }

    // Set color
    floor.setFillStyle(color);

    // Store in visible tiles
    this.visibleTiles.set(`tile_${x}_${y}_${TILE_TYPES.FLOOR}`, floor);
  }

  /**
   * Create a door tile
   * @param {number} x - World x position in tile coordinates
   * @param {number} y - World y position in tile coordinates
   * @param {number} color - Tile color
   */
  createDoorTile(x, y, color) {
    // Create floor tile first (doors are on top of floors)
    this.createFloorTile(x, y, getTileColor(TILE_TYPES.FLOOR, "medium"));

    // Convert tile coordinates to pixel coordinates
    const pixelX = x * this.tileSize;
    const pixelY = y * this.tileSize;

    // Get a door sprite from the pool or create new
    let door;

    if (this.objectPools.object.length > 0) {
      door = this.objectPools.object.pop();
      door.setPosition(pixelX + this.tileSize / 2, pixelY + this.tileSize / 2);
      door.setSize(this.tileSize * 0.8, this.tileSize * 0.8);
      door.setVisible(true);
    } else {
      door = this.scene.add.rectangle(
        pixelX + this.tileSize / 2,
        pixelY + this.tileSize / 2,
        this.tileSize * 0.8,
        this.tileSize * 0.8,
        color
      );

      // Add to objects layer
      this.layers.objects.add(door);
    }

    // Set color
    door.setFillStyle(color);

    // Store in visible tiles
    this.visibleTiles.set(`tile_${x}_${y}_${TILE_TYPES.DOOR}`, door);
  }

  /**
   * Create a spawn tile
   * @param {number} x - World x position in tile coordinates
   * @param {number} y - World y position in tile coordinates
   * @param {number} color - Tile color
   */
  createSpawnTile(x, y, color) {
    // Create floor tile first
    this.createFloorTile(x, y, getTileColor(TILE_TYPES.FLOOR, "spawn"));

    // Convert tile coordinates to pixel coordinates
    const pixelX = x * this.tileSize;
    const pixelY = y * this.tileSize;

    // Get a spawn sprite from the pool or create new
    let spawn;

    if (this.objectPools.object.length > 0) {
      spawn = this.objectPools.object.pop();
      spawn.setPosition(pixelX + this.tileSize / 2, pixelY + this.tileSize / 2);
      spawn.setRadius(this.tileSize / 4);
      spawn.setVisible(true);
    } else {
      spawn = this.scene.add.circle(
        pixelX + this.tileSize / 2,
        pixelY + this.tileSize / 2,
        this.tileSize / 4,
        color
      );

      // Add to objects layer
      this.layers.objects.add(spawn);
    }

    // Set color
    spawn.setFillStyle(color);

    // Store in visible tiles
    this.visibleTiles.set(`tile_${x}_${y}_${TILE_TYPES.SPAWN}`, spawn);
  }

  /**
   * Create an object tile
   * @param {string} type - Object type (chest, torch)
   * @param {number} x - World x position in tile coordinates
   * @param {number} y - World y position in tile coordinates
   */
  createObject(type, x, y) {
    // Convert tile coordinates to pixel coordinates
    const pixelX = x * this.tileSize;
    const pixelY = y * this.tileSize;

    // Get an object sprite from the pool or create new
    let object;

    if (this.objectPools.object.length > 0) {
      object = this.objectPools.object.pop();
      object.setPosition(
        pixelX + this.tileSize / 2,
        pixelY + this.tileSize / 2
      );
      object.setVisible(true);
    } else {
      // Create different objects based on type
      switch (type) {
        case "chest":
          object = this.scene.add.rectangle(
            pixelX + this.tileSize / 2,
            pixelY + this.tileSize / 2,
            this.tileSize * 0.6,
            this.tileSize * 0.4,
            0xffff00
          );
          break;
        case "torch":
          object = this.scene.add.circle(
            pixelX + this.tileSize / 2,
            pixelY + this.tileSize / 2,
            this.tileSize / 6,
            0xffaa00
          );

          // Add light effect
          const light = this.scene.add.circle(
            pixelX + this.tileSize / 2,
            pixelY + this.tileSize / 2,
            this.tileSize,
            0xffaa00,
            0.2
          );

          // Animate light flicker
          this.scene.tweens.add({
            targets: light,
            radius: this.tileSize * 1.2,
            alpha: 0.1,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });

          this.layers.overlay.add(light);
          break;
        case "spawn":
          object = this.scene.add.circle(
            pixelX + this.tileSize / 2,
            pixelY + this.tileSize / 2,
            this.tileSize / 3,
            0x8800ff
          );

          // Add glow effect
          const glow = this.scene.add.circle(
            pixelX + this.tileSize / 2,
            pixelY + this.tileSize / 2,
            this.tileSize * 1.5,
            0x8800ff,
            0.2
          );

          // Animate glow pulse
          this.scene.tweens.add({
            targets: glow,
            radius: this.tileSize * 2,
            alpha: 0.1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });

          this.layers.overlay.add(glow);
          break;
        default:
          object = this.scene.add.circle(
            pixelX + this.tileSize / 2,
            pixelY + this.tileSize / 2,
            this.tileSize / 4,
            0xffffff
          );
      }

      // Add to objects layer
      this.layers.objects.add(object);
    }

    // Store in visible tiles
    this.visibleTiles.set(`object_${x}_${y}_${type}`, object);
  }

  /**
   * Remove invisible entities from rendering
   * @param {Array} visibleRooms - Currently visible rooms
   * @param {Array} visibleCorridors - Currently visible corridors
   */
  cullInvisibleEntities(visibleRooms, visibleCorridors) {
    // Create sets of visible entity IDs
    const visibleRoomIds = new Set(
      visibleRooms.map((room) => `room_${room.id}`)
    );
    const visibleCorridorIds = new Set(
      visibleCorridors.map((corridor) => `corridor_${corridor.id}`)
    );

    // Find tiles to remove
    const tilesToRemove = [];

    this.visibleTiles.forEach((value, key) => {
      if (key.startsWith("room_") && !visibleRoomIds.has(key)) {
        tilesToRemove.push(key);
      } else if (key.startsWith("corridor_") && !visibleCorridorIds.has(key)) {
        tilesToRemove.push(key);
      } else if (key.startsWith("tile_") || key.startsWith("object_")) {
        // Check if the tile's parent room/corridor is still visible
        let isVisible = false;

        // Check rooms
        for (const roomId of visibleRoomIds) {
          if (this.isTileInRoom(key, roomId.replace("room_", ""))) {
            isVisible = true;
            break;
          }
        }

        // Check corridors if not in a room
        if (!isVisible) {
          for (const corridorId of visibleCorridorIds) {
            if (
              this.isTileInCorridor(key, corridorId.replace("corridor_", ""))
            ) {
              isVisible = true;
              break;
            }
          }
        }

        // Remove if not visible
        if (!isVisible) {
          tilesToRemove.push(key);
        }
      }
    });

    // Remove and pool invisible tiles
    tilesToRemove.forEach((key) => {
      const tile = this.visibleTiles.get(key);

      // Only pool actual game objects
      if (tile && typeof tile !== "boolean") {
        // Hide and add to appropriate pool
        tile.setVisible(false);

        if (key.includes(`_${TILE_TYPES.WALL}`)) {
          this.objectPools.wall.push(tile);
        } else if (key.includes(`_${TILE_TYPES.FLOOR}`)) {
          this.objectPools.floor.push(tile);
        } else if (key.startsWith("object_")) {
          this.objectPools.object.push(tile);
        } else if (key.startsWith("corridor_")) {
          this.objectPools.corridor.push(tile);
        }
      }

      // Remove from visible tiles
      this.visibleTiles.delete(key);
    });

    // Update pool size stat
    this.renderStats.poolSize =
      this.objectPools.floor.length +
      this.objectPools.wall.length +
      this.objectPools.object.length +
      this.objectPools.corridor.length;

    // Update hidden tiles stat
    this.renderStats.hiddenTiles = this.renderStats.poolSize;
  }

  /**
   * Check if a tile is in a specific room
   * @param {string} tileKey - Tile identifier
   * @param {string} roomId - Room identifier
   * @returns {boolean} - True if the tile is in the room
   */
  isTileInRoom(tileKey, roomId) {
    if (!this.mapData || !this.mapData.rooms) return false;

    // Find room
    const room = this.mapData.rooms.find((r) => r.id === roomId);
    if (!room) return false;

    // Extract coordinates from key (tile coordinates, not pixels)
    const match = tileKey.match(/tile_(\d+)_(\d+)_/);
    if (!match) return false;

    const tileX = parseInt(match[1]);
    const tileY = parseInt(match[2]);

    // Check if tile is within room bounds
    return (
      tileX >= room.x &&
      tileX < room.x + room.width &&
      tileY >= room.y &&
      tileY < room.y + room.height
    );
  }

  /**
   * Check if a tile is in a specific corridor
   * @param {string} tileKey - Tile identifier
   * @param {string} corridorId - Corridor identifier
   * @returns {boolean} - True if the tile is in the corridor
   */
  isTileInCorridor(tileKey, corridorId) {
    if (!this.mapData || !this.mapData.corridors) return false;

    // Find corridor
    const corridor = this.mapData.corridors.find((c) => c.id === corridorId);
    if (!corridor) return false;

    // Extract tile coordinates from key
    const match = tileKey.match(/tile_(\d+)_(\d+)_/);
    if (!match) return false;

    const tileX = parseInt(match[1]);
    const tileY = parseInt(match[2]);

    // Convert tile to pixel for distance calc (center of tile)
    const pointX = tileX * this.tileSize + this.tileSize / 2;
    const pointY = tileY * this.tileSize + this.tileSize / 2;

    // Convert corridor points to pixels
    const start = {
      x: corridor.start.x * this.tileSize,
      y: corridor.start.y * this.tileSize,
    };

    const end = {
      x: corridor.end.x * this.tileSize,
      y: corridor.end.y * this.tileSize,
    };

    // Check if within corridor segments
    if (corridor.waypoint) {
      const waypoint = {
        x: corridor.waypoint.x * this.tileSize,
        y: corridor.waypoint.y * this.tileSize,
      };

      // Check if within start-waypoint segment
      if (
        this.isPointInSegment(
          { x: pointX, y: pointY },
          start,
          waypoint,
          corridor.width * this.tileSize
        )
      ) {
        return true;
      }

      // Check if within waypoint-end segment
      if (
        this.isPointInSegment(
          { x: pointX, y: pointY },
          waypoint,
          end,
          corridor.width * this.tileSize
        )
      ) {
        return true;
      }
    } else {
      // Check if within start-end segment
      if (
        this.isPointInSegment(
          { x: pointX, y: pointY },
          start,
          end,
          corridor.width * this.tileSize
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a point is within a line segment with thickness
   * @param {Object} point - Point to check {x, y} in pixels
   * @param {Object} segStart - Segment start {x, y} in pixels
   * @param {Object} segEnd - Segment end {x, y} in pixels
   * @param {number} thickness - Segment thickness in pixels
   * @returns {boolean} - True if point is in segment
   */
  isPointInSegment(point, segStart, segEnd, thickness) {
    // Calculate segment length
    const segLength = Math.sqrt(
      Math.pow(segEnd.x - segStart.x, 2) + Math.pow(segEnd.y - segStart.y, 2)
    );

    // Calculate distances
    const d1 = Math.sqrt(
      Math.pow(point.x - segStart.x, 2) + Math.pow(point.y - segStart.y, 2)
    );

    const d2 = Math.sqrt(
      Math.pow(point.x - segEnd.x, 2) + Math.pow(point.y - segEnd.y, 2)
    );

    // Check if point is within segment bounds
    if (d1 + d2 > segLength + 0.5) {
      return false;
    }

    // Calculate distance from point to line
    const dist =
      Math.abs(
        (segEnd.y - segStart.y) * point.x -
          (segEnd.x - segStart.x) * point.y +
          segEnd.x * segStart.y -
          segEnd.y * segStart.x
      ) / segLength;

    // Check if distance is within thickness
    return dist <= thickness / 2;
  }

  /**
   * Clear the current map
   */
  clearMap() {
    // Reset visible tiles
    this.visibleTiles.forEach((tile, key) => {
      if (tile && typeof tile !== "boolean") {
        tile.destroy();
      }
    });

    this.visibleTiles.clear();

    // Clear object pools
    this.objectPools.floor = [];
    this.objectPools.wall = [];
    this.objectPools.object = [];
    this.objectPools.corridor = [];
    this.objectPools.overlay = [];

    // Clear spatial index
    this.spatialIndex.clear();

    // Clear render stats
    this.renderStats = {
      visibleTiles: 0,
      hiddenTiles: 0,
      poolSize: 0,
      renderTime: 0,
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.clearMap();

    // Remove resize handler
    this.scene.scale.off("resize", this.handleResize, this);

    if (this.minimapContainer) {
      this.minimapContainer.destroy();
    }

    if (this.floorText) {
      this.floorText.destroy();
    }

    if (this.debugText) {
      this.debugText.destroy();
    }

    // Destroy layer groups
    Object.values(this.layers).forEach((layer) => {
      if (layer) layer.destroy(true);
    });
  }
}

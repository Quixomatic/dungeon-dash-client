// src/managers/DungeonRenderer.js - New implementation
import Phaser from "phaser";

/**
 * DungeonRenderer - Efficiently renders tile-based dungeons
 */
export class DungeonRenderer {
  constructor(scene) {
    this.scene = scene;
    this.tileSize = 64; // Default tile size

    // Layer management
    this.layers = {
      tiles: this.scene.add.group(),
      props: this.scene.add.group(),
      monsters: this.scene.add.group(),
      overlay: this.scene.add.group(),
    };

    // Set depth levels for layers
    this.layers.tiles.setDepth(10);
    this.layers.props.setDepth(20);
    this.layers.monsters.setDepth(30);
    this.layers.overlay.setDepth(100);

    // Minimap
    this.minimapContainer = null;
    this.minimapGraphics = null;
    this.playerMarker = null;
    this.minimapSize = 400; // Size of minimap in pixels
    this.minimapScale = 0.01; // Scale factor for minimap

    // Map data storage
    this.mapData = null;
    this.dungeonWidth = 0;
    this.dungeonHeight = 0;

    // In the DungeonRenderer constructor:

    // Create a more comprehensive tile definitions mapping
    this.tileDefinitions = {
      // Base types
      "-1": { type: "hole", color: 0x111111 }, // Hole/pit
      0: { type: "floor", color: 0x333333 }, // Floor

      // Wall types based on connections (maskToTileIdMap)
      1: { type: "wall", subtype: "north", color: 0x666666 }, // North wall
      2: { type: "wall", subtype: "west", color: 0x666666 }, // West wall
      3: { type: "wall", subtype: "northwest", color: 0x775555 }, // North-West corner
      4: { type: "wall", subtype: "northwest-inner", color: 0x775555 }, // North-West-NorthWest corner
      5: { type: "wall", subtype: "east", color: 0x666666 }, // East wall
      6: { type: "wall", subtype: "northeast", color: 0x775555 }, // North-East corner
      7: { type: "wall", subtype: "northeast-inner", color: 0x775555 }, // North-East-NorthEast corner
      8: { type: "wall", subtype: "horizontal", color: 0x666666 }, // West-East horizontal wall
      9: { type: "wall", subtype: "north-west-east", color: 0x775555 }, // North-West-East T-junction
      10: { type: "wall", subtype: "north-west-sw", color: 0x775555 }, // North-West-SouthWest
      11: { type: "wall", subtype: "north-west-nw-sw", color: 0x775555 }, // N-W-NW-SW complex corner
      12: { type: "wall", subtype: "north-west-east-nw", color: 0x775555 }, // N-W-E-NW complex T
      13: { type: "wall", subtype: "south", color: 0x666666 }, // South wall
      14: { type: "wall", subtype: "north-south", color: 0x666666 }, // North-South vertical wall
      15: { type: "wall", subtype: "west-south", color: 0x775555 }, // West-South corner
      16: { type: "wall", subtype: "north-west-south", color: 0x775555 }, // North-West-South T-junction
      17: { type: "wall", subtype: "north-west-south-nw", color: 0x775555 }, // N-W-S-NW complex
      18: { type: "wall", subtype: "east-south", color: 0x775555 }, // East-South corner
      19: { type: "wall", subtype: "north-east-south", color: 0x775555 }, // North-East-South T-junction
      20: { type: "wall", subtype: "north-east-south-ne", color: 0x775555 }, // N-E-S-NE complex
      21: { type: "wall", subtype: "west-east-south", color: 0x775555 }, // West-East-South T-junction
      22: { type: "wall", subtype: "north-west-east-south", color: 0x775555 }, // Cross-junction
      // ... and so on for other wall combinations

      // Add all remaining wall types with the same pattern
      // For walls with 4 or more connections, use a darker, sturdier look
      29: { type: "wall", subtype: "complex", color: 0x555555 },
      30: { type: "wall", subtype: "complex", color: 0x555555 },
      31: { type: "wall", subtype: "complex", color: 0x555555 },
      32: { type: "wall", subtype: "complex", color: 0x555555 },
      33: { type: "wall", subtype: "complex", color: 0x555555 },
      // ... and so on

      // Special wall types (for completeness)
      46: { type: "wall", subtype: "full", color: 0x444444 },
      47: { type: "wall", subtype: "isolated", color: 0x666666 },
    };

    // Default for any unmapped tile values
    this.defaultTileDefinition = {
      type: "wall",
      subtype: "generic",
      color: 0x666666,
    };

    // Prop definitions - maps prop values to visual representation
    this.propDefinitions = {
      3: { type: "chest", color: 0xaa8800 },
      12: { type: "torch", color: 0xff9900, light: true },
      // Add more as needed
    };

    // Visible tiles tracking
    this.visibleTiles = new Map();
    this.lastCameraPosition = { x: 0, y: 0 };

    // Object pools for reuse
    this.objectPools = {
      floor: [],
      wall: [],
      prop: [],
      monster: [],
    };

    // Debug
    this.debug = false;
    this.debugText = null;
    this.debugGraphics = null;
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.debug = options.debug || false;

    // Create minimap
    this.createMinimap();

    // Generate wall textures
    this.generateWallTextures();

    // Create debug text if needed
    if (this.debug) {
      this.debugText = this.scene.add
        .text(10, 10, "DungeonRenderer", {
          fontSize: "16px",
          fill: "#ffffff",
          backgroundColor: "#000000",
        })
        .setScrollFactor(0)
        .setDepth(1000);

      this.debugGraphics = this.scene.add.graphics().setDepth(1000);
    }

    // Listen for camera movement to update culling
    this.scene.cameras.main.on("camerascroll", this.onCameraMove, this);

    return this;
  }

  /**
   * Handle camera movement for efficient culling
   */
  onCameraMove(camera) {
    // Reduce the threshold for updating visible tiles
    const cameraDeltaX = Math.abs(camera.scrollX - this.lastCameraPosition.x);
    const cameraDeltaY = Math.abs(camera.scrollY - this.lastCameraPosition.y);

    // Update if camera moved at least 1/8 of the view (reduced from 1/4)
    if (cameraDeltaX > camera.width / 8 || cameraDeltaY > camera.height / 8) {
      this.lastCameraPosition.x = camera.scrollX;
      this.lastCameraPosition.y = camera.scrollY;
      this.updateVisibleTiles();
    }
  }

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
    this.minimapBackground = this.scene.add
      .rectangle(0, 0, this.minimapSize, this.minimapSize, 0x000000, 0.7)
      .setOrigin(0);

    // Add border to minimap
    this.minimapBorder = this.scene.add.graphics();
    this.minimapBorder.lineStyle(2, 0xffffff, 0.8);
    this.minimapBorder.strokeRect(0, 0, this.minimapSize, this.minimapSize);

    // Create graphics for map elements
    this.minimapGraphics = this.scene.add.graphics();

    // Create player marker
    this.playerMarker = this.scene.add.circle(
      0,
      0, // Will be positioned in update
      4, // Radius
      0x00ff00, // Green
      1 // Alpha
    );

    // Position the entire container
    this.minimapContainer.setPosition(this.minimapX, this.minimapY);

    // Add everything to container
    this.minimapContainer.add([
      this.minimapBackground,
      this.minimapBorder,
      this.minimapGraphics,
      this.playerMarker,
    ]);
  }

  /**
   * Render a dungeon map
   * @param {Object} mapData - Map data from server
   */
  renderMap(mapData) {
    console.time("dungeonRender");

    // Clear any existing map
    this.clearMap();

    // Store map data
    this.mapData = mapData;

    // Get tile size from map data or use default
    this.tileSize = mapData.tileSize || this.tileSize;

    // Store dungeon dimensions
    this.dungeonWidth = mapData.dungeonTileWidth;
    this.dungeonHeight = mapData.dungeonTileHeight;

    // Set world bounds (if not already set)
    const worldWidth = mapData.worldTileWidth * this.tileSize;
    const worldHeight = mapData.worldTileHeight * this.tileSize;
    this.scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // Draw the minimap first
    this.drawMinimap();

    // Initial render of visible tiles
    this.lastCameraPosition = {
      x: this.scene.cameras.main.scrollX,
      y: this.scene.cameras.main.scrollY,
    };
    this.updateVisibleTiles();

    console.timeEnd("dungeonRender");

    return this;
  }

  /**
   * Draw the minimap representation of the dungeon
   */
  drawMinimap() {
    if (!this.mapData || !this.minimapGraphics) return;

    // Clear existing minimap
    this.minimapGraphics.clear();

    // Calculate scale to fit dungeon in minimap
    const dungeonWidthPx = this.dungeonWidth * this.tileSize;
    const dungeonHeightPx = this.dungeonHeight * this.tileSize;
    this.minimapScale = Math.min(
      (this.minimapSize * 0.9) / dungeonWidthPx,
      (this.minimapSize * 0.9) / dungeonHeightPx
    );

    // Add a smaller zoom factor for better overview
    this.minimapScale *= 0.6;

    // Center the map in the minimap
    const offsetX = (this.minimapSize - dungeonWidthPx * this.minimapScale) / 2;
    const offsetY =
      (this.minimapSize - dungeonHeightPx * this.minimapScale) / 2;

    // Store these offsets for position calculations
    this.minimapOffsetX = offsetX;
    this.minimapOffsetY = offsetY;

    // Draw walls and floors
    if (this.mapData.layers && this.mapData.layers.tiles) {
      // First draw floor background
      this.minimapGraphics.fillStyle(0x333333, 0.8);
      this.minimapGraphics.fillRect(
        offsetX,
        offsetY,
        dungeonWidthPx * this.minimapScale,
        dungeonHeightPx * this.minimapScale
      );

      // Then draw walls
      this.minimapGraphics.fillStyle(0x666666, 0.8);

      for (let y = 0; y < this.mapData.layers.tiles.length; y++) {
        for (let x = 0; x < this.mapData.layers.tiles[y].length; x++) {
          const tile = this.mapData.layers.tiles[y][x];

          // Only draw walls
          if (tile > 0) {
            const miniX = offsetX + x * this.minimapScale * this.tileSize;
            const miniY = offsetY + y * this.minimapScale * this.tileSize;
            const miniSize = Math.max(1, this.minimapScale * this.tileSize);

            this.minimapGraphics.fillRect(miniX, miniY, miniSize, miniSize);
          }
        }
      }
    }

    // Draw spawn points
    if (this.mapData.spawnPoints) {
      this.minimapGraphics.fillStyle(0x8800ff, 1);

      this.mapData.spawnPoints.forEach((spawn) => {
        const miniX = offsetX + spawn.x * this.minimapScale * this.tileSize;
        const miniY = offsetY + spawn.y * this.minimapScale * this.tileSize;

        this.minimapGraphics.fillCircle(miniX, miniY, 3);
      });
    }

    // Add floor level text
    if (this.floorText) {
      this.floorText.destroy();
    }

    this.floorText = this.scene.add
      .text(
        this.minimapSize / 2,
        this.minimapSize - 15,
        `Floor ${this.mapData.floorLevel || 1}`,
        { fontSize: "12px", fill: "#ffffff" }
      )
      .setOrigin(0.5);

    this.minimapContainer.add(this.floorText);
  }

  /**
   * Update which tiles are visible based on camera position
   */
  updateVisibleTiles() {
    if (!this.mapData || !this.mapData.layers) return;

    // Get camera bounds
    const camera = this.scene.cameras.main;
    const viewportBounds = {
      left: camera.scrollX,
      right: camera.scrollX + camera.width,
      top: camera.scrollY,
      bottom: camera.scrollY + camera.height,
    };

    // Add a buffer zone around the viewport (in tiles)
    const bufferTiles = 5;

    // Convert viewport bounds to tile coordinates
    const startTileX = Math.max(
      0,
      Math.floor(viewportBounds.left / this.tileSize) - bufferTiles
    );
    const endTileX = Math.min(
      this.dungeonWidth - 1,
      Math.ceil(viewportBounds.right / this.tileSize) + bufferTiles
    );
    const startTileY = Math.max(
      0,
      Math.floor(viewportBounds.top / this.tileSize) - bufferTiles
    );
    const endTileY = Math.min(
      this.dungeonHeight - 1,
      Math.ceil(viewportBounds.bottom / this.tileSize) + bufferTiles
    );

    // Track which tiles should be visible
    const shouldBeVisible = new Set();

    // Create tiles that should be visible
    for (let y = startTileY; y <= endTileY; y++) {
      for (let x = startTileX; x <= endTileX; x++) {
        // Skip if outside array bounds
        if (
          !this.mapData.layers.tiles[y] ||
          typeof this.mapData.layers.tiles[y][x] === "undefined"
        ) {
          continue;
        }

        // Generate unique ID for this tile
        const tileId = `tile_${x}_${y}`;
        shouldBeVisible.add(tileId);

        // Create tile if not already visible
        if (!this.visibleTiles.has(tileId)) {
          this.createTile(x, y, this.mapData.layers.tiles[y][x]);
        }

        // Create prop if present
        const propId = `prop_${x}_${y}`;
        if (
          this.mapData.layers.props &&
          this.mapData.layers.props[y] &&
          this.mapData.layers.props[y][x] > 0
        ) {
          shouldBeVisible.add(propId);

          if (!this.visibleTiles.has(propId)) {
            this.createProp(x, y, this.mapData.layers.props[y][x]);
          }
        }

        // Create monster if present
        const monsterId = `monster_${x}_${y}`;
        if (
          this.mapData.layers.monsters &&
          this.mapData.layers.monsters[y] &&
          this.mapData.layers.monsters[y][x] > 0
        ) {
          shouldBeVisible.add(monsterId);

          if (!this.visibleTiles.has(monsterId)) {
            this.createMonster(x, y, this.mapData.layers.monsters[y][x]);
          }
        }
      }
    }

    // Hide tiles that are not in view
    this.visibleTiles.forEach((object, id) => {
      if (!shouldBeVisible.has(id)) {
        this.recycleTile(id, object);
      }
    });

    // Debug info
    if (this.debug && this.debugText) {
      this.debugText.setText(
        `Visible: ${shouldBeVisible.size} | Pool: ${
          this.objectPools.floor.length +
          this.objectPools.wall.length +
          this.objectPools.prop.length +
          this.objectPools.monster.length
        }`
      );

      // Draw debug visualization of culling
      if (this.debugGraphics) {
        this.debugGraphics.clear();
        this.debugGraphics.lineStyle(2, 0xff0000, 0.8);
        this.debugGraphics.strokeRect(
          startTileX * this.tileSize,
          startTileY * this.tileSize,
          (endTileX - startTileX + 1) * this.tileSize,
          (endTileY - startTileY + 1) * this.tileSize
        );
      }
    }
  }

  /**
   * Create a tile at the specified position
   * @param {number} x - Tile x position
   * @param {number} y - Tile y position
   * @param {number} tileValue - Tile value from the map data
   */
  createTile(x, y, tileValue) {
    // Skip empty tiles (value 0 is usually empty/air)
    if (tileValue === 0) return;

    // Get tile definition - use default if not found
    const tileDef =
      this.tileDefinitions[tileValue] || this.defaultTileDefinition;

    // Determine which texture to use based on tile type and value
    let textureName;

    if (tileValue < 0) {
      // Hole
      textureName = "hole";
    } else if (tileValue === 1) {
      // Simple north wall
      textureName = "wall_end_north";
    } else if (tileValue === 2) {
      // Simple west wall
      textureName = "wall_end_west";
    } else if (tileValue === 5) {
      // Simple east wall
      textureName = "wall_end_east";
    } else if (tileValue === 13) {
      // Simple south wall
      textureName = "wall_end_south";
    } else if (tileValue === 8) {
      // Horizontal wall
      textureName = "wall_horizontal";
    } else if (tileValue === 14) {
      // Vertical wall
      textureName = "wall_vertical";
    } else if (tileValue === 3) {
      // Northwest corner
      textureName = "wall_northwest";
    } else if (tileValue === 6) {
      // Northeast corner
      textureName = "wall_northeast";
    } else if (tileValue === 15) {
      // Southwest corner
      textureName = "wall_southwest";
    } else if (tileValue === 18) {
      // Southeast corner
      textureName = "wall_southeast";
    } else if (tileValue === 16) {
      // North-West-South T-junction
      textureName = "wall_t_west";
    } else if (tileValue === 19) {
      // North-East-South T-junction
      textureName = "wall_t_east";
    } else if (tileValue === 9) {
      // North-West-East T-junction
      textureName = "wall_t_north";
    } else if (tileValue === 21) {
      // West-East-South T-junction
      textureName = "wall_t_south";
    } else if (tileValue === 22) {
      // Cross junction
      textureName = "wall_cross";
    } else if (
      tileValue === 4 ||
      tileValue === 7 ||
      tileValue === 11 ||
      tileValue === 12
    ) {
      // Inner corners
      textureName = "wall_inner_northwest";
    } else if (tileValue === 46) {
      // Full wall
      textureName = "wall_full";
    } else if (tileValue === 47) {
      // Isolated wall
      textureName = "wall_isolated";
    } else if (tileValue > 22) {
      // Complex walls
      textureName = "wall_complex";
    } else {
      // Default wall
      textureName = "wall_base";
    }

    // Create world position in pixels
    const worldX = x * this.tileSize + this.tileSize / 2;
    const worldY = y * this.tileSize + this.tileSize / 2;

    // Create or reuse the tile
    let tile;

    // Try to reuse from object pool
    if (
      this.objectPools[textureName] &&
      this.objectPools[textureName].length > 0
    ) {
      tile = this.objectPools[textureName].pop();
      tile.setPosition(worldX, worldY);
      tile.setVisible(true);
    } else if (this.scene.textures.exists(textureName)) {
      // Create new textured tile
      tile = this.scene.add.image(worldX, worldY, textureName);
      tile.setDisplaySize(this.tileSize, this.tileSize);
    } else {
      // Fallback to colored rectangle
      tile = this.scene.add.rectangle(
        worldX,
        worldY,
        this.tileSize,
        this.tileSize,
        tileDef.color
      );
    }

    // Store the tile properties for recycling
    tile.tileType = tileDef.type;
    tile.tileSubtype = tileDef.subtype;
    tile.tileTexture = textureName;

    // Add to appropriate layer
    this.layers.tiles.add(tile);

    // Store in visible tiles map
    this.visibleTiles.set(`tile_${x}_${y}`, tile);
  }

  /**
   * Create a prop at the specified position
   * @param {number} x - Tile x position
   * @param {number} y - Tile y position
   * @param {number} propValue - Prop value from the map data
   */
  createProp(x, y, propValue) {
    // Skip empty props
    if (propValue === 0) return;

    // Get prop definition
    const propDef = this.propDefinitions[propValue] || {
      type: "generic",
      color: 0xffffff,
    };

    // Create the prop
    let prop;

    // World position in pixels
    const worldX = x * this.tileSize + this.tileSize / 2;
    const worldY = y * this.tileSize + this.tileSize / 2;

    // Reuse from object pool if possible
    if (this.objectPools.prop.length > 0) {
      prop = this.objectPools.prop.pop();
      prop.setPosition(worldX, worldY);
      prop.setVisible(true);

      // Adjust appearance based on prop type
      if (prop.type !== propDef.type) {
        // Different prop type, need to update appearance
        this.updatePropAppearance(prop, propDef);
      }
    } else {
      // Create new prop
      prop = this.createPropObject(worldX, worldY, propDef);

      // Add to props layer
      this.layers.props.add(prop);
    }

    // Store in visible tiles map
    this.visibleTiles.set(`prop_${x}_${y}`, prop);
  }

  /**
   * Create a monster at the specified position
   * @param {number} x - Tile x position
   * @param {number} y - Tile y position
   * @param {number} monsterValue - Monster value from the map data
   */
  createMonster(x, y, monsterValue) {
    // Skip empty monsters
    if (monsterValue === 0) return;

    // Create a basic monster representation
    let monster;

    // World position in pixels
    const worldX = x * this.tileSize + this.tileSize / 2;
    const worldY = y * this.tileSize + this.tileSize / 2;

    // Get monster color based on type
    const monsterColors = [
      0xff0000, // 1 - Red
      0x00ff00, // 2 - Green
      0x0000ff, // 3 - Blue
      0xff00ff, // 4 - Purple
      0x00ffff, // 5 - Cyan
      0xffff00, // 6 - Yellow
      0xff8800, // 7 - Orange
      0x88ff00, // 8 - Lime
    ];

    const monsterColor =
      monsterColors[(monsterValue - 1) % monsterColors.length] || 0xff0000;

    // Reuse from object pool if possible
    if (this.objectPools.monster.length > 0) {
      monster = this.objectPools.monster.pop();
      monster.setPosition(worldX, worldY);
      monster.setVisible(true);
      monster.setFillStyle(monsterColor);
    } else {
      // Create new monster
      monster = this.scene.add.circle(
        worldX,
        worldY,
        this.tileSize / 3, // Monster size
        monsterColor
      );

      // Add to monsters layer
      this.layers.monsters.add(monster);
    }

    // Store in visible tiles map
    this.visibleTiles.set(`monster_${x}_${y}`, monster);
  }

  /**
   * Create a prop object based on its definition
   * @param {number} x - World x position
   * @param {number} y - World y position
   * @param {Object} propDef - Prop definition
   * @returns {Object} - Created prop object
   */
  createPropObject(x, y, propDef) {
    let prop;

    switch (propDef.type) {
      case "torch":
        // Create torch with light effect
        prop = this.scene.add.circle(x, y, this.tileSize / 4, propDef.color);

        // Add light effect if enabled
        if (propDef.light) {
          const light = this.scene.add.circle(
            x,
            y,
            this.tileSize * 2,
            propDef.color,
            0.2
          );

          // Animate light
          this.scene.tweens.add({
            targets: light,
            alpha: 0.1,
            radius: this.tileSize * 2.5,
            duration: 1000,
            yoyo: true,
            repeat: -1,
          });

          this.layers.overlay.add(light);
          prop.light = light;
        }
        break;

      case "chest":
        // Create chest as rectangle
        prop = this.scene.add.rectangle(
          x,
          y,
          this.tileSize * 0.7,
          this.tileSize * 0.5,
          propDef.color
        );
        break;

      default:
        // Generic prop as a square
        prop = this.scene.add.rectangle(
          x,
          y,
          this.tileSize * 0.5,
          this.tileSize * 0.5,
          propDef.color
        );
    }

    // Store prop type
    prop.type = propDef.type;

    return prop;
  }

  /**
   * Update prop appearance when reusing from pool
   * @param {Object} prop - Prop object to update
   * @param {Object} propDef - New prop definition
   */
  updatePropAppearance(prop, propDef) {
    // Update color
    prop.setFillStyle(propDef.color);

    // Update type
    prop.type = propDef.type;

    // Update size based on type
    switch (propDef.type) {
      case "torch":
        if (prop.geom && prop.geom.radius) {
          prop.geom.radius = this.tileSize / 4;
        }
        break;

      case "chest":
        if (prop.geom) {
          prop.geom.width = this.tileSize * 0.7;
          prop.geom.height = this.tileSize * 0.5;
        }
        break;

      default:
        if (prop.geom) {
          prop.geom.width = this.tileSize * 0.5;
          prop.geom.height = this.tileSize * 0.5;
        }
    }

    // Add light effect for torches if missing
    if (propDef.type === "torch" && propDef.light && !prop.light) {
      const light = this.scene.add.circle(
        prop.x,
        prop.y,
        this.tileSize * 2,
        propDef.color,
        0.2
      );

      // Animate light
      this.scene.tweens.add({
        targets: light,
        alpha: 0.1,
        radius: this.tileSize * 2.5,
        duration: 1000,
        yoyo: true,
        repeat: -1,
      });

      this.layers.overlay.add(light);
      prop.light = light;
    }
  }

  /**
   * Recycle a tile that is no longer visible
   * @param {string} id - Tile ID
   * @param {Object} object - Tile object
   */
  recycleTile(id, object) {
    // Remove from visible tiles
    this.visibleTiles.delete(id);

    // Hide the object
    if (object && object.setVisible) {
      object.setVisible(false);
    }

    // Add to appropriate object pool
    if (id.startsWith("tile_")) {
      // Check if we have a texture name stored
      if (object.tileTexture) {
        // Store in texture-specific pool
        if (!this.objectPools[object.tileTexture]) {
          this.objectPools[object.tileTexture] = [];
        }
        this.objectPools[object.tileTexture].push(object);
      } else if (object.tileType === "floor") {
        this.objectPools.floor.push(object);
      } else if (object.tileType === "hole") {
        if (!this.objectPools.hole) this.objectPools.hole = [];
        this.objectPools.hole.push(object);
      } else {
        // Default wall
        this.objectPools.wall.push(object);
      }
    } else if (id.startsWith("prop_")) {
      // Handle light effect for torches
      if (object.type === "torch" && object.light) {
        object.light.setVisible(false);
      }

      this.objectPools.prop.push(object);
    } else if (id.startsWith("monster_")) {
      this.objectPools.monster.push(object);
    }
  }

  generateWallTextures() {
    // Generate base wall texture
    if (!this.scene.textures.exists("wall_base")) {
      const baseWall = this.scene.textures.createCanvas("wall_base", 64, 64);
      const ctx = baseWall.getContext();

      // Base fill
      ctx.fillStyle = "#666666";
      ctx.fillRect(0, 0, 64, 64);

      // Add some texture
      ctx.fillStyle = "#777777";
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 3 + Math.random() * 6;
        ctx.fillRect(x, y, size, size);
      }

      // Add border
      ctx.strokeStyle = "#555555";
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 60, 60);

      baseWall.refresh();
    }

    // Generate specific wall types

    // 1. Straight walls (horizontal and vertical)
    this.generateStraightWall("horizontal", 0); // East-West
    this.generateStraightWall("vertical", 90); // North-South

    // 2. Corner walls
    this.generateCornerWall("northwest", 0); // Northwest corner
    this.generateCornerWall("northeast", 90); // Northeast corner
    this.generateCornerWall("southwest", 270); // Southwest corner
    this.generateCornerWall("southeast", 180); // Southeast corner

    // 3. T-junction walls
    this.generateTJunctionWall("north", 0); // North T-junction
    this.generateTJunctionWall("east", 90); // East T-junction
    this.generateTJunctionWall("south", 180); // South T-junction
    this.generateTJunctionWall("west", 270); // West T-junction

    // 4. End walls (single connection)
    this.generateEndWall("north", 0);
    this.generateEndWall("east", 90);
    this.generateEndWall("south", 180);
    this.generateEndWall("west", 270);

    // 5. Cross junction (all four connections)
    this.generateCrossJunctionWall();

    // 6. Inner corner walls
    this.generateInnerCornerWall("northwest", 0);
    this.generateInnerCornerWall("northeast", 90);
    this.generateInnerCornerWall("southwest", 270);
    this.generateInnerCornerWall("southeast", 180);

    // 7. Complex walls
    this.generateComplexWall();

    // 8. Isolated wall
    this.generateIsolatedWall();

    // 9. Full wall
    this.generateFullWall();

    // 10. Generate hole texture
    this.generateHoleTexture();
  }

  // Helper methods for wall texture generation

  generateStraightWall(type, rotation) {
    const textureName = `wall_${type}`;
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Set origin to center for rotation
    ctx.translate(32, 32);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-32, -32);

    // Base fill
    ctx.fillStyle = "#666666";
    ctx.fillRect(0, 0, 64, 64);

    // Wall pattern
    ctx.fillStyle = "#777777";

    if (type === "horizontal") {
      // Horizontal wall pattern
      for (let x = 4; x < 60; x += 16) {
        ctx.fillRect(x, 20, 12, 24);
      }
    } else {
      // Vertical wall pattern
      for (let y = 4; y < 60; y += 16) {
        ctx.fillRect(20, y, 24, 12);
      }
    }

    // Border
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 60);

    wall.refresh();
  }

  generateCornerWall(type, rotation) {
    const textureName = `wall_${type}`;
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Set origin to center for rotation
    ctx.translate(32, 32);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-32, -32);

    // Base fill
    ctx.fillStyle = "#775555";
    ctx.fillRect(0, 0, 64, 64);

    // Corner wall pattern
    ctx.fillStyle = "#886666";
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(62, 2);
    ctx.lineTo(62, 62);
    ctx.lineTo(32, 62);
    ctx.lineTo(32, 32);
    ctx.lineTo(2, 32);
    ctx.closePath();
    ctx.fill();

    // Add stone details
    ctx.fillStyle = "#997777";
    ctx.fillRect(16, 8, 16, 16);
    ctx.fillRect(40, 8, 16, 16);
    ctx.fillRect(40, 40, 16, 16);

    // Border
    ctx.strokeStyle = "#664444";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 60);

    wall.refresh();
  }

  generateTJunctionWall(type, rotation) {
    const textureName = `wall_t_${type}`;
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Set origin to center for rotation
    ctx.translate(32, 32);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-32, -32);

    // Base fill
    ctx.fillStyle = "#775555";
    ctx.fillRect(0, 0, 64, 64);

    // T-junction pattern
    ctx.fillStyle = "#886666";
    ctx.fillRect(2, 2, 60, 30);
    ctx.fillRect(17, 32, 30, 30);

    // Stone details
    ctx.fillStyle = "#997777";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(8 + i * 20, 8, 16, 16);
    }
    ctx.fillRect(24, 38, 16, 16);

    // Border
    ctx.strokeStyle = "#664444";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 60);

    wall.refresh();
  }

  generateEndWall(type, rotation) {
    const textureName = `wall_end_${type}`;
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Set origin to center for rotation
    ctx.translate(32, 32);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-32, -32);

    // Base fill
    ctx.fillStyle = "#666666";
    ctx.fillRect(0, 0, 64, 64);

    // End wall pattern
    ctx.fillStyle = "#777777";
    ctx.fillRect(2, 2, 60, 30);

    // Add a rounded end
    ctx.fillStyle = "#777777";
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI, true);
    ctx.fill();

    // Stone details
    ctx.fillStyle = "#888888";
    ctx.fillRect(16, 8, 12, 12);
    ctx.fillRect(36, 8, 12, 12);
    ctx.fillRect(24, 20, 16, 8);

    // Border
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 30);
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI, true);
    ctx.stroke();

    wall.refresh();
  }

  generateCrossJunctionWall() {
    const textureName = "wall_cross";
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Base fill
    ctx.fillStyle = "#775555";
    ctx.fillRect(0, 0, 64, 64);

    // Cross pattern
    ctx.fillStyle = "#886666";
    ctx.fillRect(2, 17, 60, 30);
    ctx.fillRect(17, 2, 30, 60);

    // Center stone
    ctx.fillStyle = "#997777";
    ctx.fillRect(17, 17, 30, 30);

    // Border
    ctx.strokeStyle = "#664444";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 60);

    wall.refresh();
  }

  generateInnerCornerWall(type, rotation) {
    const textureName = `wall_inner_${type}`;
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Set origin to center for rotation
    ctx.translate(32, 32);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-32, -32);

    // Base fill
    ctx.fillStyle = "#775555";
    ctx.fillRect(0, 0, 64, 64);

    // Inner corner pattern
    ctx.fillStyle = "#886666";
    ctx.fillRect(0, 0, 64, 64);

    // Carve out inner corner
    ctx.fillStyle = "#775555";
    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(64, 32);
    ctx.lineTo(64, 64);
    ctx.lineTo(32, 64);
    ctx.closePath();
    ctx.fill();

    // Stone details
    ctx.fillStyle = "#997777";
    ctx.fillRect(8, 8, 16, 16);
    ctx.fillRect(40, 8, 16, 16);
    ctx.fillRect(8, 40, 16, 16);

    // Border
    ctx.strokeStyle = "#664444";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 60);

    wall.refresh();
  }

  generateComplexWall() {
    const textureName = "wall_complex";
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Base fill
    ctx.fillStyle = "#555555";
    ctx.fillRect(0, 0, 64, 64);

    // Complex pattern - multiple layers of stones
    ctx.fillStyle = "#666666";

    // Layer 1 - large stones
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const offsetX = (row % 2) * 8;
        ctx.fillRect(offsetX + col * 16, row * 16, 14, 14);
      }
    }

    // Layer 2 - highlights
    ctx.fillStyle = "#777777";
    for (let i = 0; i < 8; i++) {
      const x = 4 + Math.random() * 56;
      const y = 4 + Math.random() * 56;
      const size = 2 + Math.random() * 4;
      ctx.fillRect(x, y, size, size);
    }

    // Border
    ctx.strokeStyle = "#444444";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 60, 60);

    wall.refresh();
  }

  generateIsolatedWall() {
    const textureName = "wall_isolated";
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Base fill
    ctx.fillStyle = "#666666";
    ctx.fillRect(0, 0, 64, 64);

    // Isolated wall pattern - a round boulder/pillar
    ctx.fillStyle = "#777777";
    ctx.beginPath();
    ctx.arc(32, 32, 25, 0, Math.PI * 2);
    ctx.fill();

    // Add some highlight
    ctx.fillStyle = "#888888";
    ctx.beginPath();
    ctx.arc(28, 28, 10, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 25, 0, Math.PI * 2);
    ctx.stroke();

    wall.refresh();
  }

  generateFullWall() {
    const textureName = "wall_full";
    if (this.scene.textures.exists(textureName)) return;

    const wall = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = wall.getContext();

    // Base fill
    ctx.fillStyle = "#444444";
    ctx.fillRect(0, 0, 64, 64);

    // Full wall pattern - solid stone blocks
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        // Alternate pattern for stone blocks
        const offsetX = (row % 2) * 8;
        ctx.fillStyle = (row + col) % 2 === 0 ? "#555555" : "#333333";
        ctx.fillRect(offsetX + col * 16, row * 16, 16, 16);
      }
    }

    // Border
    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 60, 60);

    wall.refresh();
  }

  generateHoleTexture() {
    const textureName = "hole";
    if (this.scene.textures.exists(textureName)) return;

    const hole = this.scene.textures.createCanvas(textureName, 64, 64);
    const ctx = hole.getContext();

    // Base fill - dark color
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, 64, 64);

    // Create a dark gradient for depth effect
    const gradient = ctx.createRadialGradient(32, 32, 5, 32, 32, 32);
    gradient.addColorStop(0, "#000000");
    gradient.addColorStop(1, "#222222");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    // Add rim
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.stroke();

    hole.refresh();
  }

  /**
   * Update minimap with player position
   * @param {number} x - Player x position in world
   * @param {number} y - Player y position in world
   */
  update(x, y) {
    // Update minimap player marker
    if (this.playerMarker && this.minimapScale) {
      const minimapX = this.minimapOffsetX + x * this.minimapScale;
      const minimapY = this.minimapOffsetY + y * this.minimapScale;
      
      this.playerMarker.setPosition(minimapX, minimapY);
    }

    // Check if player has moved significantly from last camera position
    const camera = this.scene.cameras.main;
    const cameraDeltaX = Math.abs(camera.scrollX - this.lastCameraPosition.x);
    const cameraDeltaY = Math.abs(camera.scrollY - this.lastCameraPosition.y);

    // Update tiles if camera moved significantly (reduced threshold)
    if (cameraDeltaX > camera.width / 16 || cameraDeltaY > camera.height / 16) {
      this.lastCameraPosition.x = camera.scrollX;
      this.lastCameraPosition.y = camera.scrollY;
      this.updateVisibleTiles();
    }
  }

  /**
   * Clear the current map
   */
  clearMap() {
    // Hide all visible tiles
    this.visibleTiles.forEach((object, id) => {
      this.recycleTile(id, object);
    });

    // Clear visible tiles map
    this.visibleTiles.clear();

    // Clear minimap
    if (this.minimapGraphics) {
      this.minimapGraphics.clear();
    }

    // Reset dungeon dimensions
    this.dungeonWidth = 0;
    this.dungeonHeight = 0;

    // Clear map data
    this.mapData = null;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Remove event listeners
    this.scene.cameras.main.off("camerascroll", this.onCameraMove, this);

    // Clear map
    this.clearMap();

    // Destroy pools
    Object.values(this.objectPools).forEach((pool) => {
      pool.forEach((obj) => {
        if (obj && obj.destroy) obj.destroy();
      });
      pool.length = 0;
    });

    // Destroy layers
    Object.values(this.layers).forEach((layer) => {
      if (layer && layer.destroy) {
        layer.destroy(true);
      }
    });

    // Destroy minimap
    if (this.minimapContainer) {
      this.minimapContainer.destroy();
      this.minimapContainer = null;
    }

    // Destroy debug
    if (this.debugText) {
      this.debugText.destroy();
      this.debugText = null;
    }

    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
  }

  /**
   * Draw debug information for corridors
   */
  drawAllCorridorsDebug() {
    if (!this.debug || !this.mapData) return;

    // Create debug graphics if needed
    if (!this.corridorDebugGraphics) {
      this.corridorDebugGraphics = this.scene.add.graphics();
      this.corridorDebugGraphics.setDepth(1000);
    } else {
      this.corridorDebugGraphics.clear();
    }

    // Get tree structure from map data
    if (!this.mapData.tree) {
      console.warn("No tree structure in map data for debug visualization");
      return;
    }

    // Draw corridors from tree structure
    this.corridorDebugGraphics.lineStyle(2, 0x00ffff, 0.8);
    this.drawCorridorsFromTree(this.mapData.tree);
  }

  /**
   * Recursively draw corridors from tree structure
   * @param {Object} node - Tree node
   */
  drawCorridorsFromTree(node) {
    if (!node) return;

    // Draw corridor in this node
    if (node.leaf && node.leaf.corridor) {
      const corridor = node.leaf.corridor;
      const x = corridor.x * this.tileSize;
      const y = corridor.y * this.tileSize;
      const width = corridor.width * this.tileSize;
      const height = corridor.height * this.tileSize;

      this.corridorDebugGraphics.strokeRect(x, y, width, height);
    }

    // Recursively draw corridors in children
    if (node.left) {
      this.drawCorridorsFromTree(node.left);
    }

    if (node.right) {
      this.drawCorridorsFromTree(node.right);
    }
  }
}

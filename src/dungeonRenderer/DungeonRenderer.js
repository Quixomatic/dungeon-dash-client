// src/dungeonRenderer/DungeonRenderer.js - IMPROVED VERSION
import { StructureRenderer } from "./renderers/StructureRenderer.js";
import { PropRenderer } from "./renderers/PropRenderer.js";
import { MonsterRenderer } from "./renderers/MonsterRenderer.js";
import { BackgroundRenderer } from "./renderers/BackgroundRenderer.js";
import { MinimapRenderer } from "./renderers/MinimapRenderer.js";
import { TextureCache } from "./utils/TextureCache.js";
import { VisibilityCulling } from "./utils/VisibilityCulling.js";

/**
 * DungeonRenderer - Efficiently renders tile-based dungeons using structural data
 * Acts as the main orchestrator for different rendering components
 */
export class DungeonRenderer {
  constructor(scene) {
    this.scene = scene;
    this.tileSize = 64; // Default tile size
    this.mapData = null;
    this.dungeonWidth = 0;
    this.dungeonHeight = 0;

    // Create sub-components
    this.textureCache = new TextureCache(scene);
    this.culling = new VisibilityCulling();

    // Create renderers
    this.backgroundRenderer = new BackgroundRenderer(scene, this.textureCache);
    this.structureRenderer = new StructureRenderer(scene, this.textureCache);
    this.propRenderer = new PropRenderer(scene, this.textureCache);
    this.monsterRenderer = new MonsterRenderer(scene, this.textureCache);
    this.minimapRenderer = new MinimapRenderer(scene);

    // Debug settings
    this.debug = false;
    this.debugText = null;
    this.debugGraphics = null;

    // Last camera position for visibility updates
    this.lastCameraPosition = { x: 0, y: 0 };

    // Track active update timer
    this.updateTimer = null;

    // Performance optimization
    this.updateCount = 0;
    this.lastUpdateTime = 0;
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.debug = options.debug || false;

    // Initialize sub-renderers
    this.structureRenderer.init({
      buffer: options.structureBuffer || 1, // IMPROVED: Increased from 5 to 8
      tileSize: this.tileSize,
      debug: this.debug,
    });

    this.backgroundRenderer.init({
      tileSize: this.tileSize,
      debug: this.debug,
    });

    this.propRenderer.init({
      tileSize: this.tileSize,
      debug: this.debug,
    });

    this.monsterRenderer.init({
      tileSize: this.tileSize,
      debug: this.debug,
    });

    this.minimapRenderer.init({
      size: options.minimapSize || 400,
      debug: this.debug,
    });

    // Initialize culling system
    this.culling.init({
      debug: this.debug,
    });

    // Set up camera movement listener
    this.scene.cameras.main.on("camerascroll", this.onCameraMove, this);

    // Initialize debug graphics if needed
    if (this.debug) {
      this.debugGraphics = this.scene.add
        .graphics()
        .setDepth(1000)
        .setScrollFactor(0);
      this.initDebugUI();
    }

    return this;
  }

  /**
   * Initialize debug UI elements
   */
  initDebugUI() {
    this.debugText = this.scene.add
      .text(10, 10, "DungeonRenderer", {
        fontSize: "16px",
        fill: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 5, y: 2 },
      })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  /**
   * Preload all tile textures needed for rendering
   * This should be called during scene's preload phase
   */
  preloadTileAssets() {
    if (!this.textureCache) return;

    // Access the tile texture mappings from TextureCache
    const tileTextures = this.textureCache.tileTextures;

    // Load all tile textures based on the mapping
    if (tileTextures) {
      Object.entries(tileTextures).forEach(([tileValue, assetPath]) => {
        const key = `tile_${tileValue}`;
        if (!this.scene.textures.exists(key)) {
          this.scene.load.image(key, assetPath);
        }
      });

      // Log the number of textures being loaded
      if (this.debug) {
        console.log(
          `Preloading ${Object.keys(tileTextures).length} tile textures`
        );
      }
    }

    // Also load prop textures
    this.scene.load.image("torch", "assets/props/torch.png");
    this.scene.load.image("chest", "assets/props/chest.png");
    this.scene.load.image("ladder", "assets/props/ladder.png");
  }

  /**
   * Render a dungeon map
   * @param {Object} mapData - Map data from server
   */
  renderMap(mapData) {
    console.time("dungeonRender");

    // Clear existing map
    this.clearMap();

    // Store map data and set tile size
    this.mapData = mapData;
    this.tileSize = mapData.tileSize || this.tileSize;

    // Store dungeon dimensions
    this.dungeonWidth = mapData.dungeonTileWidth;
    this.dungeonHeight = mapData.dungeonTileHeight;

    // Set world bounds
    this.setWorldBounds();

    // NEW: Create all structures near initial camera position first
    const initialCameraBounds = {
      left: this.scene.cameras.main.scrollX,
      right: this.scene.cameras.main.scrollX + this.scene.cameras.main.width,
      top: this.scene.cameras.main.scrollY,
      bottom: this.scene.cameras.main.scrollY + this.scene.cameras.main.height,
    };

    // Apply a large buffer for initial view
    const initBuffer = this.tileSize * 20;
    const initialViewBounds = {
      left: initialCameraBounds.left - initBuffer,
      right: initialCameraBounds.right + initBuffer,
      top: initialCameraBounds.top - initBuffer,
      bottom: initialCameraBounds.bottom + initBuffer,
    };

    // Initialize renderer components
    this.structureRenderer.render(mapData, this.tileSize, initialViewBounds);
    this.minimapRenderer.render(mapData, this.tileSize);

    // Initial update of visible elements
    this.updateVisibility(true);

    // Schedule periodic full visibility updates
    this.startPeriodicUpdates();

    console.timeEnd("dungeonRender");
    return this;
  }

  /**
   * IMPROVED: Start periodic full visibility updates
   * This ensures rooms are rendered even during fast movement
   */
  startPeriodicUpdates() {
    // Clear any existing timer
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    // Set up a periodic update every 1000ms (1 second)
    this.updateTimer = setInterval(() => {
      // Only do the update if it's been more than 200ms since last manual update
      const now = Date.now();
      if (now - this.lastUpdateTime > 200) {
        this.updateVisibility(true);
      }
    }, 1000);
  }

  /**
   * Set world bounds based on map data
   */
  setWorldBounds() {
    if (!this.mapData) return;

    // Calculate world bounds from map data
    const worldWidth = this.mapData.worldTileWidth * this.tileSize;
    const worldHeight = this.mapData.worldTileHeight * this.tileSize;

    // Set physics and camera bounds
    this.scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
  }

  /**
   * Handle camera movement for efficient culling
   */
  onCameraMove = (camera) => {
    if (this.culling.shouldUpdateVisibility(camera, this.lastCameraPosition)) {
      this.lastCameraPosition.x = camera.scrollX;
      this.lastCameraPosition.y = camera.scrollY;
      this.updateVisibility();
    }
  };

  /**
   * Update visibility of all elements based on camera position
   * @param {boolean} forceUpdate - Force a full update of all structures
   */
  updateVisibility(forceUpdate = false) {
    if (!this.mapData) return;

    this.lastUpdateTime = Date.now();
    this.updateCount++;

    // Get camera bounds
    const camera = this.scene.cameras.main;
    const cameraBounds = {
      left: camera.scrollX,
      right: camera.scrollX + camera.width,
      top: camera.scrollY,
      bottom: camera.scrollY + camera.height,
    };

    // IMPROVED: Add visual debug representation of camera bounds
    if (this.debug && this.debugGraphics) {
      this.debugGraphics.clear();
      this.debugGraphics.lineStyle(2, 0xff0000, 0.5);

      // Draw camera bounds
      this.debugGraphics.strokeRect(
        cameraBounds.left - camera.scrollX,
        cameraBounds.top - camera.scrollY,
        camera.width,
        camera.height
      );

      // Draw expanded bounds used for culling
      const buffer = this.tileSize * 10;
      this.debugGraphics.lineStyle(1, 0x00ff00, 0.3);
      this.debugGraphics.strokeRect(
        cameraBounds.left - buffer - camera.scrollX,
        cameraBounds.top - buffer - camera.scrollY,
        camera.width + buffer * 2,
        camera.height + buffer * 2
      );
    }

    // NEW: Check if any rooms within camera bounds aren't created yet and create them
    // Apply a buffer for dynamic structure creation
    const dynBuffer = this.tileSize * 15; // Large buffer to ensure rooms are created before they're needed
    const dynamicBounds = {
      left: cameraBounds.left - dynBuffer,
      right: cameraBounds.right + dynBuffer,
      top: cameraBounds.top - dynBuffer,
      bottom: cameraBounds.bottom + dynBuffer,
    };

    if (this.mapData && this.mapData.structural) {
      // Check and create rooms
      if (
        this.mapData.structural.rooms &&
        Array.isArray(this.mapData.structural.rooms)
      ) {
        this.mapData.structural.rooms.forEach((room) => {
          const roomId = `room_${room.id || room.x + "_" + room.y}`;

          // If this room doesn't exist yet, check if it should be visible
          if (!this.structureRenderer.structures[roomId]) {
            const isInView = this.culling.isStructureVisible(
              { x: room.x, y: room.y, width: room.width, height: room.height },
              dynamicBounds,
              this.tileSize
            );

            // If room should be visible, render it
            if (isInView) {
              if (this.debug) {
                console.log(
                  `Dynamically creating room: ${roomId} at (${room.x},${room.y})`
                );
              }
              this.structureRenderer.renderStructure(
                this.mapData,
                room,
                "room"
              );
            }
          }
        });
      }

      // Similarly check corridors and spawn rooms if needed
      // Only add these if they also have visibility issues
      if (forceUpdate) {
        // For corridors
        if (
          this.mapData.structural.corridors &&
          Array.isArray(this.mapData.structural.corridors)
        ) {
          this.mapData.structural.corridors.forEach((corridor) => {
            const corridorId = `corridor_${
              corridor.id || corridor.x + "_" + corridor.y
            }`;

            if (!this.structureRenderer.structures[corridorId]) {
              const isInView = this.culling.isStructureVisible(
                {
                  x: corridor.x,
                  y: corridor.y,
                  width: corridor.width,
                  height: corridor.height,
                },
                dynamicBounds,
                this.tileSize
              );

              if (isInView) {
                this.structureRenderer.renderStructure(
                  this.mapData,
                  corridor,
                  "corridor"
                );
              }
            }
          });
        }

        // For spawn rooms
        if (
          this.mapData.structural.spawnRooms &&
          Array.isArray(this.mapData.structural.spawnRooms)
        ) {
          this.mapData.structural.spawnRooms.forEach((spawnRoom) => {
            const spawnRoomId = `spawnRoom_${
              spawnRoom.id || spawnRoom.x + "_" + spawnRoom.y
            }`;

            if (!this.structureRenderer.structures[spawnRoomId]) {
              const isInView = this.culling.isStructureVisible(
                {
                  x: spawnRoom.x,
                  y: spawnRoom.y,
                  width: spawnRoom.width,
                  height: spawnRoom.height,
                },
                dynamicBounds,
                this.tileSize
              );

              if (isInView) {
                this.structureRenderer.renderStructure(
                  this.mapData,
                  spawnRoom,
                  "spawnRoom"
                );
              }
            }
          });
        }
      }
    }

    // Update structure visibility for existing structures
    this.structureRenderer.updateVisibility(cameraBounds, this.tileSize);

    // Get visible structures
    const visibleStructures = this.structureRenderer.getVisibleStructures();

    // IMPROVED: If doing a force update, render props/monsters in all structures
    // This ensures nothing is missed
    if (forceUpdate) {
      Object.values(this.structureRenderer.structures).forEach((structure) => {
        this.propRenderer.renderPropsInStructure(
          this.mapData,
          structure,
          this.tileSize
        );
        this.monsterRenderer.renderMonstersInStructure(
          this.mapData,
          structure,
          this.tileSize
        );
      });
    } else {
      // Normal flow - only process newly visible structures
      const newlyVisibleStructures =
        this.structureRenderer.getNewlyVisibleStructures();

      newlyVisibleStructures.forEach((structure) => {
        this.propRenderer.renderPropsInStructure(
          this.mapData,
          structure,
          this.tileSize
        );
        this.monsterRenderer.renderMonstersInStructure(
          this.mapData,
          structure,
          this.tileSize
        );
      });
    }

    // Update prop and monster visibility
    this.propRenderer.updateVisibility(cameraBounds);
    this.monsterRenderer.updateVisibility(cameraBounds);

    // Update debug info
    this.updateDebugInfo();
  }

  /**
   * Update debug info display
   */
  updateDebugInfo() {
    if (!this.debug || !this.debugText) return;

    const stats = {
      structures: this.structureRenderer.getVisibleCount(),
      props: this.propRenderer.getVisibleCount(),
      monsters: this.monsterRenderer.getVisibleCount(),
      camera: `${Math.round(this.lastCameraPosition.x)},${Math.round(
        this.lastCameraPosition.y
      )}`,
      updates: this.updateCount,
    };

    this.debugText.setText(
      `Structures: ${stats.structures}/${
        Object.keys(this.structureRenderer.structures).length
      } | Props: ${stats.props} | Updates: ${stats.updates}`
    );
  }

  /**
   * Update renderer - called from scene's update method
   * @param {number} x - Player x position
   * @param {number} y - Player y position
   */
  update(x, y) {
    // Update minimap player marker
    this.minimapRenderer.updatePlayerPosition(x, y);

    // Check if camera has moved enough to update visibility
    const camera = this.scene.cameras.main;
    if (this.culling.shouldUpdateVisibility(camera, this.lastCameraPosition)) {
      this.lastCameraPosition.x = camera.scrollX;
      this.lastCameraPosition.y = camera.scrollY;
      this.updateVisibility();
    }
  }

  /**
   * Clear the current map
   */
  clearMap() {
    // Clear update timer
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // Reset update counters
    this.updateCount = 0;
    this.lastUpdateTime = 0;

    // Clear all sub-renderers
    this.backgroundRenderer.clear();
    this.structureRenderer.clear();
    this.propRenderer.clear();
    this.monsterRenderer.clear();

    // Clear minimap
    this.minimapRenderer.clear();

    // Reset internal state
    this.mapData = null;
    this.dungeonWidth = 0;
    this.dungeonHeight = 0;
  }

  /**
   * Handle resize event from scene
   * @param {number} width - New screen width
   * @param {number} height - New screen height
   */
  handleResize(width, height) {
    // Update minimap position
    this.minimapRenderer.handleResize(width, height);

    // Update debug text position if needed
    if (this.debugText) {
      this.debugText.setPosition(10, 10);
    }

    // Force a visibility update to account for new view size
    this.updateVisibility(true);
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Clear update timer
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // Remove event listeners
    this.scene.cameras.main.off("camerascroll", this.onCameraMove);

    // Clear map
    this.clearMap();

    // Destroy sub-components
    this.textureCache.clear();
    this.backgroundRenderer.destroy();
    this.structureRenderer.destroy();
    this.propRenderer.destroy();
    this.monsterRenderer.destroy();
    this.minimapRenderer.destroy();

    // Destroy debug resources
    if (this.debugText) {
      this.debugText.destroy();
      this.debugText = null;
    }

    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
  }
}

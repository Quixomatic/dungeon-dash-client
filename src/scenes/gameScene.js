// src/scenes/GameScene.js - Updated for new dungeon renderer
import Phaser from "phaser";
import { PlayerManager } from "../managers/PlayerManager.js";
import { InputHandler } from "../managers/InputHandler.js";
import { NetworkHandler } from "../managers/NetworkHandler.js";
import { ReconciliationManager } from "../managers/ReconciliationManager.js";
import { DungeonRenderer } from "../dungeonRenderer/DungeonRenderer.js"; // Updated import
import { UIManager } from "../managers/UIManager.js";
import { DebugManager } from "../managers/DebugManager.js";
import { CollisionSystem } from "../systems/CollisionSystem.js";
import { createDashUI } from "../ui/DashUI.js";
import gameState from "../systems/GameState.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.room = null;
    this.playerId = null;
    this.playerName = null;

    // Managers
    this.playerManager = null;
    this.inputHandler = null;
    this.networkHandler = null;
    this.reconciliationManager = null;
    this.dungeonRenderer = null;
    this.uiManager = null;
    this.debugManager = null;

    // Dungeon state
    this.currentFloor = 1;
    this.collapseWarning = false;
    this.collapseTime = 0;

    // Performance tracking
    this.perfMetrics = {
      fps: [],
      objects: { sprites: 0, text: 0 },
    };
  }

  preload() {
    // Generate basic textures if not loaded yet
    if (!this.textures.exists("character")) {
      this.textures.generate("character", {
        data: ["8888", "8888", "8888", "8888"],
        pixelWidth: 16,
        pixelHeight: 16,
      });
    }

    // Create the DungeonRenderer instance for preloading assets
    this.dungeonRenderer = new DungeonRenderer(this);
    this.dungeonRenderer.preloadTileAssets();
  }

  create() {
    console.log("GameScene created");

    // Get room from registry
    this.room = this.registry.get("colyseusRoom");
    if (!this.room) {
      this.add
        .text(400, 300, "Error: Not connected to server", {
          fontSize: "24px",
          fill: "#ff0000",
        })
        .setOrigin(0.5);
      return;
    }

    // Get player ID and name
    this.playerId = this.room.sessionId;
    this.playerName = this.registry.get("playerName") || "Player";

    // Initialize managers in the correct order
    this.initializeManagers();

    this.dashUI = createDashUI(this, this.inputHandler);

    // Get map data from gameState
    const mapData = gameState.getMapData();
    if (mapData) {
      console.log("Using map data from gameState");

      // Render the map with the new DungeonRenderer
      if (this.dungeonRenderer) {
        this.dungeonRenderer.renderMap(mapData);
      } else {
        console.error("DungeonRenderer not initialized!");
      }

      // Initialize collision map
      if (this.collisionSystem) {
        this.collisionSystem.initCollisionMap(mapData);

        // Enable debug visualization if needed
        if (this.debugManager && this.debugManager.debug) {
          this.collisionSystem.setDebug(true);
        }
      }
    } else {
      console.warn("No map data in gameState! Requesting from server...");

      // Request map data from server
      if (this.room) {
        this.room.send("requestMapData");

        // Show loading message
        this.loadingText = this.add
          .text(400, 300, "Loading map data...", {
            fontSize: "24px",
            fill: "#ffffff",
            backgroundColor: "#222222",
            padding: { x: 20, y: 10 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(1000);
      }

      // Set default world bounds until we get map data
      this.physics.world.setBounds(0, 0, 32768, 32768);
      this.cameras.main.setBounds(0, 0, 32768, 32768);
    }

    // Configure camera to follow player
    this.cameras.main.startFollow(
      this.playerManager.localPlayer,
      true,
      0.08,
      0.08
    );

    // Set up event listeners
    this.setupEventHandlers();

    // Add resize handler to update when the window changes size
    this.scale.on("resize", this.handleResize, this);

    // Set up performance monitoring
    this.setupPerformanceMonitoring();
  }

  setupEventHandlers() {
    // Map data handler
    this.room.onMessage("mapData", (data) => {
      console.log("Received map data from server");

      // Store in gameState
      gameState.setMapData(data);

      // Render the map with the new DungeonRenderer
      if (this.dungeonRenderer) {
        this.dungeonRenderer.renderMap(data);
      }

      // Initialize collision map
      if (this.collisionSystem) {
        this.collisionSystem.initCollisionMap(data);

        // Enable debug visualization if needed
        if (this.debugManager && this.debugManager.debug) {
          this.collisionSystem.setDebug(true);
        }
      }

      // Remove loading text if it exists
      if (this.loadingText) {
        this.loadingText.destroy();
        this.loadingText = null;
      }

      // Notify server that we've loaded the map
      this.room.send("mapLoaded");

      // Show loaded notification
      this.uiManager.showNotification("Map loaded successfully!");
    });

    // Teleportation handler
    this.room.onMessage("teleported", (data) => {
      console.log("Player teleported", data);

      // Update player position
      if (this.playerManager && data.x !== undefined && data.y !== undefined) {
        this.playerManager.setPlayerPosition(data.x, data.y);
      }

      // Update floor level if provided
      if (data.floorLevel !== undefined) {
        this.currentFloor = data.floorLevel;

        // Show floor notification
        this.uiManager.showAnnouncement(`Floor ${data.floorLevel}`);
      }
    });

    // Phase change handler
    this.room.onMessage("phaseChange", (data) => {
      console.log("Phase changed:", data);

      // Update game state
      gameState.setPhase(data.phase);

      // Show phase notification
      this.uiManager.showNotification(`Phase: ${data.phase.toUpperCase()}`);

      // Handle specific phases
      if (data.phase === "gauntlet") {
        this.uiManager.showAnnouncement("GAUNTLET PHASE", 0xff0000);
      }
    });

    // Floor collapse warning
    this.room.onMessage("floorCollapsing", (data) => {
      console.log("Floor collapsing in:", data.timeLeft);

      this.collapseWarning = true;
      this.collapseTime = data.timeLeft;

      // Show warning
      this.uiManager.showWarning(
        `FLOOR COLLAPSING IN ${data.timeLeft}!`,
        0xff0000
      );
    });

    // Global event handler
    this.room.onMessage("globalEvent", (data) => {
      console.log("Global event:", data);

      this.uiManager.showGlobalEventNotification(data.message);
    });

    // Debug key for toggling debug mode
    this.debugKey = this.input.keyboard.addKey("G");
    this.debugKey.on("down", () => {
      if (this.dungeonRenderer) {
        // Toggle debug mode on all relevant components
        const newDebugState = !this.dungeonRenderer.debug;
        this.dungeonRenderer.debug = newDebugState;

        if (this.debugManager) {
          this.debugManager.debug = newDebugState;
        }

        if (this.collisionSystem) {
          this.collisionSystem.setDebug(newDebugState);
        }

        console.log(`Debug mode: ${newDebugState ? "enabled" : "disabled"}`);
      }
    });
  }

  setupPerformanceMonitoring() {
    // Create FPS display
    this.fpsText = this.add
      .text(10, 300, "FPS: --", {
        fontSize: "16px",
        fill: "#00ff00",
      })
      .setScrollFactor(0)
      .setDepth(1000);

    // Update FPS counter every second
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        const fps = Math.round(this.game.loop.actualFps);
        this.fpsText.setText(`FPS: ${fps}`);

        // Log to console if significant drops
        if (fps < 40) {
          console.warn(`Low FPS detected: ${fps}`);
        }
      },
      callbackScope: this,
      loop: true,
    });
  }

  initializeManagers() {
    // 1. Create collision system first
    this.collisionSystem = new CollisionSystem(this);

    // 2. Initialize the new DungeonRenderer (if not already done in preload)
    if (!this.dungeonRenderer) {
      this.dungeonRenderer = new DungeonRenderer(this);
    }

    // Initialize with options
    this.dungeonRenderer.init({
      debug: false, // Start with debug off
      minimapSize: 400, // Smaller minimap
    });

    this.debugStructureBoundaries();

    // 3. Player Manager (handles rendering)
    this.playerManager = new PlayerManager(
      this,
      this.playerId,
      this.playerName
    );

    // 4. Input Handler (handles player input)
    this.inputHandler = new InputHandler(this);

    // 5. Reconciliation Manager (handles server reconciliation)
    this.reconciliationManager = new ReconciliationManager(this);

    // 6. Network Handler (handles communication with server)
    this.networkHandler = new NetworkHandler(this, this.room, this.playerId);

    // 7. UI Manager
    this.uiManager = new UIManager(this);
    this.uiManager.initialize();

    // 8. Debug Manager
    this.debugManager = new DebugManager(this);
    this.debugManager.initialize();

    // Connect managers
    this.inputHandler.setPlayerManager(this.playerManager);
    this.inputHandler.setNetworkHandler(this.networkHandler);
    this.inputHandler.setCollisionSystem(this.collisionSystem);

    this.networkHandler.setPlayerManager(this.playerManager);
    this.networkHandler.setInputHandler(this.inputHandler);
    this.networkHandler.setReconciliationManager(this.reconciliationManager);

    this.reconciliationManager.setPlayerManager(this.playerManager);
    this.reconciliationManager.setInputHandler(this.inputHandler);

    console.log("All managers initialized");
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    // Update camera
    this.cameras.main.setSize(width, height);

    // Update UI elements that need to stay in correct position
    if (this.uiManager) {
      this.uiManager.handleResize(width, height);
    }

    // Update dungeon renderer for minimap repositioning
    if (this.dungeonRenderer) {
      this.dungeonRenderer.handleResize(width, height);
    }
  }

  update(time, delta) {
    // Skip update if not initialized
    if (!this.playerManager || !this.inputHandler) return;

    // Handle player input
    this.inputHandler.update(delta);

    // Update other players
    this.playerManager.updateOtherPlayers(delta);

    // Update dungeon renderer with player position
    if (this.dungeonRenderer && this.playerManager) {
      const position = this.playerManager.getPlayerPosition();
      this.dungeonRenderer.update(position.x, position.y);
    }

    // Update dash UI
    if (this.dashUI) {
      this.dashUI.update();
    }

    // Update debug info
    if (this.debugManager) {
      this.debugManager.update();
    }

    if (this.structureDebugGraphics && this.structureDebugGraphics.visible) {
      this.updateStructureDebug();
    }

    // Handle collapse warning flashing effect
    if (this.collapseWarning && this.collapseTime <= 10) {
      if (Math.floor(time / 500) % 2 === 0) {
        this.uiManager.showWarning(
          `FLOOR COLLAPSING IN ${this.collapseTime}!`,
          0xff0000
        );
      }
    }
  }

  shutdown() {
    // Remove event listeners
    this.scale.off("resize", this.handleResize);

    if (this.debugKey) {
      this.debugKey.off("down");
    }

    // Destroy managers that need manual cleanup
    if (this.debugManager) {
      this.debugManager.destroy();
    }

    // Clean up the dungeon renderer
    if (this.dungeonRenderer) {
      this.dungeonRenderer.destroy();
    }

    // Clear any running timers
    this.time.removeAllEvents();

    // Clear any running tweens
    this.tweens.killAll();

    // Clear message listeners from room
    if (this.room) {
      // In Colyseus, the room handles removing listeners when disconnected
      // So no explicit cleanup needed here
    }

    console.log("GameScene properly cleaned up");
  }

  debugStructureBoundaries() {
    // Remove any existing debug graphics first
    if (this.structureDebugGraphics) {
      this.structureDebugGraphics.destroy();
    }

    // Create a new graphics object for structure boundaries
    this.structureDebugGraphics = this.add.graphics();
    this.structureDebugGraphics.setDepth(1000); // Above everything else

    // Make sure we have the dungeonRenderer and structureRenderer
    if (!this.dungeonRenderer || !this.dungeonRenderer.structureRenderer) {
      console.error("DungeonRenderer not available for structure debugging");
      return;
    }

    const sr = this.dungeonRenderer.structureRenderer;
    const tileSize = this.dungeonRenderer.tileSize;

    // Draw boundaries for all structures
    Object.entries(sr.structures).forEach(([id, structure]) => {
      const bounds = structure.bounds;
      const isVisible = sr.visibleStructures.has(id);

      // Convert tile coordinates to pixel coordinates
      const x = bounds.x * tileSize;
      const y = bounds.y * tileSize;
      const width = bounds.width * tileSize;
      const height = bounds.height * tileSize;

      // Use different colors for different structure types and visibility
      let color, alpha;

      if (isVisible) {
        // Visible structures
        switch (structure.type) {
          case "room":
            color = 0x00ff00; // Green for visible rooms
            break;
          case "corridor":
            color = 0x0000ff; // Blue for visible corridors
            break;
          case "spawnRoom":
            color = 0xff00ff; // Purple for visible spawn rooms
            break;
          default:
            color = 0xffffff; // White for other visible structures
        }
        alpha = 0.3;
      } else {
        // Invisible structures
        switch (structure.type) {
          case "room":
            color = 0x880000; // Dark red for invisible rooms
            break;
          case "corridor":
            color = 0x000088; // Dark blue for invisible corridors
            break;
          case "spawnRoom":
            color = 0x880088; // Dark purple for invisible spawn rooms
            break;
          default:
            color = 0x444444; // Dark gray for other invisible structures
        }
        alpha = 0.15;
      }

      // Draw filled rectangle with lower alpha
      this.structureDebugGraphics.fillStyle(color, alpha);
      this.structureDebugGraphics.fillRect(x, y, width, height);

      // Draw outline with higher alpha
      this.structureDebugGraphics.lineStyle(2, color, 0.8);
      this.structureDebugGraphics.strokeRect(x, y, width, height);

      // Add structure ID text if it's visible or close to visible
      const camera = this.cameras.main;
      const inScreenBounds = !(
        x > camera.scrollX + camera.width + 100 ||
        x + width < camera.scrollX - 100 ||
        y > camera.scrollY + camera.height + 100 ||
        y + height < camera.scrollY - 100
      );

      if (inScreenBounds) {
        // Add ID text that stays fixed relative to the structure
        const textX = x + 10;
        const textY = y + 10;

        // Create unique ID for this text
        const textId = `struct_${id}_text`;

        // Check if text already exists
        let structText = this.children.getByName(textId);
        if (!structText) {
          structText = this.add.text(
            textX,
            textY,
            `${structure.type}\n${id.substring(0, 12)}${
              id.length > 12 ? "..." : ""
            }\n${bounds.width}x${bounds.height}`,
            {
              fontSize: "12px",
              backgroundColor: "#00000080",
              padding: { x: 3, y: 2 },
              color: isVisible ? "#ffffff" : "#888888",
            }
          );
          structText.setName(textId);
          structText.setDepth(1001);
        } else {
          // Update existing text
          structText.setText(
            `${structure.type}\n${id.substring(0, 12)}${
              id.length > 12 ? "..." : ""
            }\n${bounds.width}x${bounds.height}`
          );
          structText.setPosition(textX, textY);
          structText.setColor(isVisible ? "#ffffff" : "#888888");
        }
      }
    });

    // Draw camera bounds
    const camera = this.cameras.main;
    this.structureDebugGraphics.lineStyle(2, 0xff0000, 1);
    this.structureDebugGraphics.strokeRect(
      camera.scrollX,
      camera.scrollY,
      camera.width,
      camera.height
    );

    // Add a toggle key for the debug overlay
    if (!this.boundaryDebugKey) {
      this.boundaryDebugKey = this.input.keyboard.addKey("B");
      this.boundaryDebugKey.on("down", () => {
        if (this.structureDebugGraphics) {
          this.structureDebugGraphics.visible =
            !this.structureDebugGraphics.visible;
          console.log(
            `Structure boundary debug: ${
              this.structureDebugGraphics.visible ? "shown" : "hidden"
            }`
          );
        }
      });
    }

    console.log(`Structure boundary debug initialized. Press B to toggle.`);
    return this.structureDebugGraphics;
  }

  // Add this to update method to keep debug visualization updated
  updateStructureDebug() {
    if (this.structureDebugGraphics && this.structureDebugGraphics.visible) {
      // Clear and redraw
      this.structureDebugGraphics.clear();
      this.debugStructureBoundaries();
    }
  }
}

// src/scenes/GameScene.js
import Phaser from "phaser";
import { PlayerManager } from "../managers/PlayerManager.js";
import { InputHandler } from "../managers/InputHandler.js";
import { NetworkHandler } from "../managers/NetworkHandler.js";
import { ReconciliationManager } from "../managers/ReconciliationManager.js";
import { DungeonRenderer } from "../managers/DungeonRenderer.js";
import { UIManager } from "../managers/UIManager.js";
import { DebugManager } from "../managers/DebugManager.js";
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

    // Generate tile textures
    if (!this.textures.exists("tiles")) {
      this.createTileTextures();
    }
  }

  /**
   * Create tile textures for dungeon
   */
  createTileTextures() {
    const canvasTexture = this.textures.createCanvas("tiles", 128, 128);
    const ctx = canvasTexture.getContext();

    // Floor tiles
    ctx.fillStyle = "#555555";
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = "#444444";
    ctx.strokeRect(0, 0, 32, 32);

    // Wall tiles
    ctx.fillStyle = "#777777";
    ctx.fillRect(32, 0, 32, 32);
    ctx.strokeStyle = "#666666";
    ctx.strokeRect(32, 0, 32, 32);

    // Special tiles
    ctx.fillStyle = "#888800";
    ctx.fillRect(64, 0, 32, 32); // Treasure
    ctx.fillStyle = "#880000";
    ctx.fillRect(96, 0, 32, 32); // Monster

    // More tile types...

    canvasTexture.refresh();
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
  
    // Create a background that extends beyond the viewport
    this.createBackground();
  
    // Initialize managers
    this.initializeManagers();
  
    // Get map data from gameState
    const mapData = gameState.getMapData();
    if (mapData) {
      console.log("Using map data from gameState");
  
      // Get tile size from map data
      const tileSize = mapData.tileSize || 64;
  
      // Calculate world bounds in pixels
      const worldWidth = mapData.worldTileWidth * tileSize;
      const worldHeight = mapData.worldTileHeight * tileSize;
  
      // Update world bounds
      this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
  
      console.log(
        `Set world bounds to ${worldWidth}x${worldHeight} pixels (${mapData.worldTileWidth}x${mapData.worldTileHeight} tiles)`
      );
  
      // Render the map with the received data
      if (this.dungeonRenderer) {
        this.dungeonRenderer.renderMap(mapData);
      } else {
        console.error("DungeonRenderer not initialized!");
      }
    } else {
      console.warn("No map data in gameState! Game may not function properly.");
      
      // Show error message to player
      this.add.text(400, 300, "Error: Map data not loaded!", {
        fontSize: "24px",
        fill: "#ff0000",
        backgroundColor: "#222222",
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
      
      // Set default world bounds
      this.physics.world.setBounds(0, 0, 20000, 20000);
      this.cameras.main.setBounds(0, 0, 20000, 20000);
    }
  
    // Configure camera to follow player
    this.cameras.main.startFollow(this.playerManager.localPlayer, true, 0.08, 0.08);
  
    // Add resize handler to update when the window changes size
    this.scale.on("resize", this.handleResize, this);
  
    this.setupPerformanceMonitoring();

    this.debugKey = this.input.keyboard.addKey('G');
    this.debugKey.on('down', () => {
      if (this.dungeonRenderer) {
        // Toggle debug mode
        this.dungeonRenderer.debug = !this.dungeonRenderer.debug;
        console.log(`Dungeon renderer debug mode: ${this.dungeonRenderer.debug}`);
        
        if (this.dungeonRenderer.debug) {
          // Update debug info and draw debug visualizations
          this.dungeonRenderer.drawAllCorridorsDebug();
        } else {
          // Clean up debug graphics
          if (this.dungeonRenderer.corridorDebugGraphics) {
            this.dungeonRenderer.corridorDebugGraphics.clear();
          }
        }
      }
    });
  }

  setupPerformanceMonitoring() {
    // Create FPS display
    this.fpsText = this.add
      .text(10, 10, "FPS: --", {
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

  updatePerformanceMetrics() {
    // Record FPS
    const fps = this.game.loop.actualFps.toFixed(1);
    this.perfMetrics.fps.push(fps);

    // Count game objects
    const sprites = this.children.list.filter(
      (obj) => obj.type === "Sprite"
    ).length;
    const texts = this.children.list.filter(
      (obj) => obj.type === "Text"
    ).length;

    this.perfMetrics.objects.sprites = sprites;
    this.perfMetrics.objects.text = texts;

    // Display current metrics
    this.fpsText.setText(`FPS: ${fps} | Sprites: ${sprites} | Texts: ${texts}`);

    // Keep only the last 60 measurements
    if (this.perfMetrics.fps.length > 60) {
      this.perfMetrics.fps.shift();
    }

    // Log to console if significant drops
    if (fps < 30) {
      console.warn(`Low FPS detected: ${fps}`);
      console.log(`Game objects: ${this.children.list.length}`);
    }
  }

  // Add to GameScene.js
  createBackground() {
    // Create a simple grid background
    const gridSize = 64;
    const worldSize = 20000;

    // Create a graphics object for the grid
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x333333, 0.8);

    // Draw horizontal lines
    for (let y = 0; y < worldSize; y += gridSize) {
      gridGraphics.moveTo(0, y);
      gridGraphics.lineTo(worldSize, y);
    }

    // Draw vertical lines
    for (let x = 0; x < worldSize; x += gridSize) {
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, worldSize);
    }

    gridGraphics.strokePath();
    gridGraphics.setDepth(-10);

    // Add some reference markers every 512 pixels
    for (let x = 0; x < worldSize; x += 512) {
      for (let y = 0; y < worldSize; y += 512) {
        this.add
          .text(x + 4, y + 4, `${x},${y}`, {
            fontSize: "12px",
            fill: "#666666",
          })
          .setDepth(-5);
      }
    }
  }

  initializeManagers() {
    // 1. Create dungeon renderer first (so it can create the map)
    this.dungeonRenderer = new DungeonRenderer(this);
    this.dungeonRenderer.init({ debug: true });

    // 2. Player Manager (handles rendering)
    this.playerManager = new PlayerManager(
      this,
      this.playerId,
      this.playerName
    );

    // 3. Input Handler (handles player input)
    this.inputHandler = new InputHandler(this);

    // 4. Reconciliation Manager (handles server reconciliation)
    this.reconciliationManager = new ReconciliationManager(this);

    // 5. Network Handler (handles communication with server)
    this.networkHandler = new NetworkHandler(this, this.room, this.playerId);

    // 6. UI Manager
    this.uiManager = new UIManager(this);
    this.uiManager.initialize();

    // 7. Debug Manager
    this.debugManager = new DebugManager(this);
    this.debugManager.initialize();

    // Connect managers
    this.inputHandler.setPlayerManager(this.playerManager);
    this.inputHandler.setNetworkHandler(this.networkHandler);

    this.networkHandler.setPlayerManager(this.playerManager);
    this.networkHandler.setInputHandler(this.inputHandler);
    this.networkHandler.setReconciliationManager(this.reconciliationManager);

    this.reconciliationManager.setPlayerManager(this.playerManager);
    this.reconciliationManager.setInputHandler(this.inputHandler);

    console.log("All managers initialized");
  }

  // src/scenes/GameScene.js - add this to your setupDungeonEvents method
  setupDungeonEvents() {
    // Handle map data from server
    this.room.onMessage("mapData", (data) => {
      console.log("Received map data:", data);

      // Get tile size from map data
      const tileSize = data.tileSize || 64;

      // Calculate world bounds in pixels
      const worldWidth = data.worldTileWidth * tileSize;
      const worldHeight = data.worldTileHeight * tileSize;

      // Update world bounds
      this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

      console.log(
        `Updated world bounds to ${worldWidth}x${worldHeight} pixels (${data.worldTileWidth}x${data.worldTileHeight} tiles)`
      );

      // Render the map with the received data
      if (this.dungeonRenderer) {
        this.dungeonRenderer.renderMap(data);
      } else {
        console.error("DungeonRenderer not initialized!");
      }
    });

    // For testing - manually generate map if we don't receive it within 5 seconds
    /*this.time.delayedCall(5000, () => {
      if (!this.dungeonRenderer.mapData) {
        console.log("No map data received, generating test map...");
        this.generateTestMap();
      }
    });*/
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

    // Update minimap position
    if (this.dungeonRenderer && this.dungeonRenderer.minimapGraphics) {
      this.dungeonRenderer.minimapGraphics.x = width - 210;
      this.dungeonRenderer.minimapGraphics.y = 10;
    }
  }

  // Add this test function
  generateTestMap() {
    const testMapData = {
      width: 30,
      height: 30,
      floorLevel: 1,
      // Test rooms
      rooms: [
        { id: 1, x: 5, y: 5, width: 8, height: 6, type: "spawn" },
        { id: 2, x: 15, y: 5, width: 7, height: 8, type: "normal" },
        { id: 3, x: 5, y: 15, width: 6, height: 6, type: "treasure" },
        { id: 4, x: 15, y: 18, width: 8, height: 7, type: "monster" },
      ],
      // Test corridors
      corridors: [
        {
          start: { x: 13, y: 8 },
          end: { x: 15, y: 8 },
          waypoint: { x: 14, y: 8 },
        },
        {
          start: { x: 8, y: 11 },
          end: { x: 8, y: 15 },
          waypoint: { x: 8, y: 13 },
        },
        {
          start: { x: 18, y: 13 },
          end: { x: 18, y: 18 },
          waypoint: { x: 18, y: 15 },
        },
      ],
      // Test spawn points
      spawnPoints: [{ roomId: 1, x: 9, y: 8 }],
    };

    // Render test map
    this.dungeonRenderer.renderMap(testMapData);
  }

  setWorldBounds(width, height) {
    // Set physics world bounds
    this.physics.world.setBounds(0, 0, width, height);

    // Set camera bounds
    this.cameras.main.setBounds(0, 0, width, height);

    console.log(`World bounds set to ${width}x${height}`);
  }

  update(time, delta) {
    // Skip update if not initialized
    if (!this.playerManager || !this.inputHandler) return;

    // Handle player input
    this.inputHandler.update(delta);

    // Update other players
    this.playerManager.updateOtherPlayers(delta);

    // Update minimap player position
    if (this.dungeonRenderer && this.playerManager) {
      const position = this.playerManager.getPlayerPosition();
      this.dungeonRenderer.update(position.x, position.y);
    }

    // Update debug info
    if (this.debugManager) {
      this.debugManager.update();
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

    // Destroy managers that need manual cleanup
    if (this.debugManager) {
      this.debugManager.destroy();
    }

    // Clear any running timers
    this.time.removeAllEvents();

    // Clear any running tweens
    this.tweens.killAll();

    // Stop listening to room events
    if (this.room) {
      // Clear message listeners (may need custom implementation depending on Colyseus)
    }

    console.log("GameScene properly cleaned up");
  }
}

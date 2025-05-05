// src/scenes/GameScene.js - Updated for new dungeon renderer
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
    
    // Performance tracking
    this.perfMetrics = {
      fps: [],
      objects: { sprites: 0, text: 0 }
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

    // Pre-generate tile textures
    this.generateTileTextures();
  }

  /**
   * Generate textures for various tile and prop types
   */
  generateTileTextures() {
    // Floor texture
    if (!this.textures.exists("floor")) {
      const floor = this.textures.createCanvas("floor", 64, 64);
      const ctx = floor.getContext();
      ctx.fillStyle = "#333333";
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "#222222";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 64, 64);
      
      // Add some noise/texture
      ctx.fillStyle = "#2a2a2a";
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const size = 1 + Math.random() * 3;
        ctx.fillRect(x, y, size, size);
      }
      
      floor.refresh();
    }
    
    // Wall texture
    if (!this.textures.exists("wall")) {
      const wall = this.textures.createCanvas("wall", 64, 64);
      const ctx = wall.getContext();
      ctx.fillStyle = "#666666";
      ctx.fillRect(0, 0, 64, 64);
      
      // Add some texture to walls
      ctx.fillStyle = "#555555";
      ctx.fillRect(4, 4, 56, 56);
      ctx.strokeStyle = "#777777";
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 60, 60);
      
      wall.refresh();
    }
    
    // Torch texture
    if (!this.textures.exists("torch")) {
      const torch = this.textures.createCanvas("torch", 32, 32);
      const ctx = torch.getContext();
      
      // Torch base
      ctx.fillStyle = "#553300";
      ctx.fillRect(12, 16, 8, 16);
      
      // Flame
      ctx.fillStyle = "#ff9900";
      ctx.beginPath();
      ctx.moveTo(12, 16);
      ctx.quadraticCurveTo(16, 0, 20, 16);
      ctx.closePath();
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath();
      ctx.moveTo(14, 16);
      ctx.quadraticCurveTo(16, 4, 18, 16);
      ctx.closePath();
      ctx.fill();
      
      torch.refresh();
    }
    
    // Spawn point texture
    if (!this.textures.exists("spawn")) {
      const spawn = this.textures.createCanvas("spawn", 64, 64);
      const ctx = spawn.getContext();
      
      // Circle with glow
      const gradient = ctx.createRadialGradient(32, 32, 5, 32, 32, 32);
      gradient.addColorStop(0, "#8800ff");
      gradient.addColorStop(0.5, "rgba(136, 0, 255, 0.5)");
      gradient.addColorStop(1, "rgba(136, 0, 255, 0)");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      
      // Center marker
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(32, 32, 5, 0, Math.PI * 2);
      ctx.fill();
      
      spawn.refresh();
    }
    
    // Chest texture
    if (!this.textures.exists("chest")) {
      const chest = this.textures.createCanvas("chest", 48, 32);
      const ctx = chest.getContext();
      
      // Chest base
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(4, 8, 40, 24);
      
      // Chest top
      ctx.fillStyle = "#A0522D";
      ctx.fillRect(8, 4, 32, 8);
      
      // Metal details
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(20, 14, 8, 6);
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 10, 36, 20);
      
      chest.refresh();
    }
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
  
    // Get map data from gameState
    const mapData = gameState.getMapData();
    if (mapData) {
      console.log("Using map data from gameState");
  
      // Render the map with the received data
      if (this.dungeonRenderer) {
        this.dungeonRenderer.renderMap(mapData);
      } else {
        console.error("DungeonRenderer not initialized!");
      }
    } else {
      console.warn("No map data in gameState! Requesting from server...");
      
      // Request map data from server
      if (this.room) {
        this.room.send("requestMapData");
        
        // Show loading message
        this.loadingText = this.add.text(400, 300, "Loading map data...", {
          fontSize: "24px",
          fill: "#ffffff",
          backgroundColor: "#222222",
          padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
      }
      
      // Set default world bounds until we get map data
      this.physics.world.setBounds(0, 0, 20000, 20000);
      this.cameras.main.setBounds(0, 0, 20000, 20000);
    }
  
    // Configure camera to follow player
    this.cameras.main.startFollow(this.playerManager.localPlayer, true, 0.08, 0.08);
  
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
      
      // Render the map
      if (this.dungeonRenderer) {
        this.dungeonRenderer.renderMap(data);
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
      this.uiManager.showWarning(`FLOOR COLLAPSING IN ${data.timeLeft}!`, 0xff0000);
    });
    
    // Global event handler
    this.room.onMessage("globalEvent", (data) => {
      console.log("Global event:", data);
      
      this.uiManager.showGlobalEventNotification(data.message);
    });
    
    // Debug key for toggling debug mode
    this.debugKey = this.input.keyboard.addKey('G');
    this.debugKey.on('down', () => {
      if (this.dungeonRenderer) {
        this.dungeonRenderer.debug = !this.dungeonRenderer.debug;
        console.log(`Dungeon renderer debug mode: ${this.dungeonRenderer.debug}`);
        
        if (this.debugManager) {
          this.debugManager.debug = this.dungeonRenderer.debug;
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
    if (this.dungeonRenderer) {
      // DungeonRenderer has its own resize handler
      this.dungeonRenderer.handleResize && this.dungeonRenderer.handleResize(width, height);
    }
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
    
    if (this.debugKey) {
      this.debugKey.off('down');
    }

    // Destroy managers that need manual cleanup
    if (this.debugManager) {
      this.debugManager.destroy();
    }
    
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
}
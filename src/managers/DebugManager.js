// src/managers/DebugManager.js - Updated for new dungeon format
import { createDebugHelper } from '../utils/debug.js';
import gameState from '../systems/GameState.js';
import networkManager from '../systems/NetworkManager.js';

export class DebugManager {
  constructor(scene) {
    this.scene = scene;
    this.debug = null;
    this.debugGraphics = null;
    this.showDebug = false;
    this.tileGridEnabled = false;
  }
  
  initialize() {
    console.log("Initializing DebugManager");
    
    // Create debug helper
    this.debug = createDebugHelper(this.scene, {
      sceneName: 'GAME SCENE',
      sceneLabelColor: '#00ff99'
    });
    
    // Add debug toggle button
    this.createDebugToggle();
    
    // Add extra debug keys
    this.setupDebugKeys();
  }
  
  createDebugToggle() {
    const debugButton = this.scene.add.text(700, 550, 'Debug', {
      fontSize: '16px',
      backgroundColor: '#555555',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .setScrollFactor(0).setDepth(1000);

    debugButton.on('pointerdown', () => {
      this.showDebug = !this.showDebug;
      debugButton.setBackgroundColor(this.showDebug ? '#55aa55' : '#555555');
      if (this.debug) this.debug.setVisible(this.showDebug);
      if (this.debugGraphics) this.debugGraphics.setVisible(this.showDebug);
      
      // Also toggle debug mode on dungeon renderer
      if (this.scene.dungeonRenderer) {
        this.scene.dungeonRenderer.debug = this.showDebug;
      }
    });
  }
  
  setupDebugKeys() {
    // Toggle tile grid overlay with T key
    this.scene.input.keyboard.addKey('T').on('down', () => {
      this.tileGridEnabled = !this.tileGridEnabled;
      console.log(`Tile grid: ${this.tileGridEnabled ? 'Enabled' : 'Disabled'}`);
      this.updateDebugVisuals();
    });
    
    // Dump map data to console with M key
    this.scene.input.keyboard.addKey('M').on('down', () => {
      const mapData = gameState.getMapData();
      console.log('Current Map Data:', mapData);
      
      // Show notification
      if (this.scene.uiManager) {
        this.scene.uiManager.showNotification('Map data dumped to console');
      }
    });
  }
  
  update() {
    if (!this.showDebug) return;
    
    // Update debug info
    this.updateDebugInfo();
    
    // Update debug visualizations
    this.updateDebugVisuals();
  }
  
  updateDebugInfo() {
    // Get map data
    const mapData = gameState.getMapData();
    
    // Format map dimensions
    const mapDimensions = mapData ? 
      `${mapData.dungeonTileWidth || 0}x${mapData.dungeonTileHeight || 0} tiles` : 
      'No map data';
    
    // Get player position
    const playerPos = this.scene.playerManager?.getPlayerPosition() || { x: 0, y: 0 };
    
    // Calculate tile position
    const tileX = Math.floor(playerPos.x / (mapData?.tileSize || 64));
    const tileY = Math.floor(playerPos.y / (mapData?.tileSize || 64));
    
    // Update debug text
    this.debug.displayObject({
      'Room ID': this.scene.room?.id || 'Not connected',
      'Player ID': this.scene.playerId || 'Unknown',
      'Players': gameState.getPlayerCount(),
      'Phase': gameState.getPhase(),
      'FPS': Math.round(this.scene.game.loop.actualFps),
      'Map': mapDimensions,
      'Floor': mapData?.floorLevel || 1,
      'Position': `${Math.round(playerPos.x)}, ${Math.round(playerPos.y)}`,
      'Tile': `${tileX}, ${tileY}`,
      'Inputs': this.scene.inputHandler?.pendingInputs?.length || 0
    });
  }
  
  updateDebugVisuals() {
    // Create graphics object if needed
    if (!this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics();
      this.debugGraphics.setDepth(999);
    }
    
    // Clear existing graphics
    this.debugGraphics.clear();
    
    // Draw tile grid if enabled
    if (this.tileGridEnabled) {
      this.drawTileGrid();
    }
  }
  
  drawTileGrid() {
    if (!this.debugGraphics) return;
    
    // Get camera view bounds
    const camera = this.scene.cameras.main;
    const bounds = {
      left: camera.scrollX,
      right: camera.scrollX + camera.width,
      top: camera.scrollY,
      bottom: camera.scrollY + camera.height
    };
    
    // Get tile size
    const tileSize = gameState.getMapData()?.tileSize || 64;
    
    // Calculate visible tile range
    const startTileX = Math.floor(bounds.left / tileSize);
    const endTileX = Math.ceil(bounds.right / tileSize);
    const startTileY = Math.floor(bounds.top / tileSize);
    const endTileY = Math.ceil(bounds.bottom / tileSize);
    
    // Draw grid lines
    this.debugGraphics.lineStyle(1, 0xffffff, 0.3);
    
    // Vertical lines
    for (let x = startTileX; x <= endTileX; x++) {
      this.debugGraphics.beginPath();
      this.debugGraphics.moveTo(x * tileSize, bounds.top);
      this.debugGraphics.lineTo(x * tileSize, bounds.bottom);
      this.debugGraphics.strokePath();
    }
    
    // Horizontal lines
    for (let y = startTileY; y <= endTileY; y++) {
      this.debugGraphics.beginPath();
      this.debugGraphics.moveTo(bounds.left, y * tileSize);
      this.debugGraphics.lineTo(bounds.right, y * tileSize);
      this.debugGraphics.strokePath();
    }
    
    // Add tile coordinates at intersections
    this.debugGraphics.lineStyle(1, 0xffffff, 0);
    const step = 4; // Only show coordinates every 4 tiles
    for (let x = startTileX; x <= endTileX; x += step) {
      for (let y = startTileY; y <= endTileY; y += step) {
        // Skip if text would be off-screen
        if (x * tileSize < bounds.left || x * tileSize > bounds.right ||
            y * tileSize < bounds.top || y * tileSize > bounds.bottom) {
          continue;
        }
        
        // Add text if it doesn't exist yet
        const coordKey = `tile_${x}_${y}`;
        if (!this.scene.children.getByName(coordKey)) {
          const text = this.scene.add.text(
            x * tileSize + 4, 
            y * tileSize + 4, 
            `${x},${y}`, 
            { 
              fontSize: '10px',
              fill: '#ffffff',
              backgroundColor: '#00000077'
            }
          ).setDepth(1000).setName(coordKey);
          
          // Destroy text when it goes out of view
          this.scene.time.delayedCall(5000, () => {
            text.destroy();
          });
        }
      }
    }
  }

  destroy() {
    if (this.debugGraphics) {
      this.debugGraphics.clear();
      this.debugGraphics.destroy();
    }
    
    if (this.debug && this.debug.debugText) {
      this.debug.debugText.destroy();
    }
    
    if (this.debug && this.debug.sceneLabel) {
      this.debug.sceneLabel.destroy();
    }
    
    // Clean up any debug text elements
    this.scene.children.list.forEach(child => {
      if (child.name && child.name.startsWith('tile_') && child.type === 'Text') {
        child.destroy();
      }
    });
  }
}
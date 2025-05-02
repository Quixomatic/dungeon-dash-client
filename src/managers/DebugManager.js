// src/managers/DebugManager.js
import { createDebugHelper } from '../utils/debug.js';
import gameState from '../systems/GameState.js';
import networkManager from '../systems/NetworkManager.js';

export class DebugManager {
  constructor(scene) {
    this.scene = scene;
    this.debug = null;
    this.debugGraphics = null;
    this.showDebug = true;
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
  }
  
  createDebugToggle() {
    const debugButton = this.scene.add.text(700, 550, 'Debug', {
      fontSize: '16px',
      backgroundColor: '#555555',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    debugButton.on('pointerdown', () => {
      this.showDebug = !this.showDebug;
      debugButton.setBackgroundColor(this.showDebug ? '#555555' : '#333333');
      if (this.debug) this.debug.setVisible(this.showDebug);
      if (this.debugGraphics) this.debugGraphics.setVisible(this.showDebug);
    });
  }
  
  update() {
    if (!this.showDebug) return;
    
    // Update debug info
    this.updateDebugInfo();
    
    // Show visible players for debugging
    this.showVisiblePlayers();
  }
  
  updateDebugInfo() {
    try {
      // Get player count
      const count = this.scene.room.state.players.size;
      
      // Update debug info
      this.debug.displayObject({
        'Room ID': this.scene.room.id,
        'Your ID': this.scene.playerId,
        'Total players': count,
        'Other players': this.scene.playerManager.otherPlayers.length,
        'Phase': gameState.getPhase(),
        'FPS': Math.round(this.scene.game.loop.actualFps),
        'Pending inputs': networkManager.pendingInputs.length
      });
    } catch (error) {
      console.error("Error updating debug info:", error);
    }
  }
  
  showVisiblePlayers() {
    // Clear any existing debug graphics
    if (this.debugGraphics) {
      this.debugGraphics.clear();
    } else {
      this.debugGraphics = this.scene.add.graphics();
    }
    
    // Draw current player position (green circle)
    this.debugGraphics.fillStyle(0x00ff00, 0.5);
    this.debugGraphics.fillCircle(
      this.scene.playerManager.localPlayer.x, 
      this.scene.playerManager.localPlayer.y, 
      20
    );
    
    // Draw other players (blue circles)
    this.debugGraphics.fillStyle(0x0000ff, 0.5);
    Object.entries(this.scene.playerManager.otherPlayers).forEach(([id, sprite]) => {
      this.debugGraphics.fillCircle(sprite.x, sprite.y, 20);
      
      // Draw line from text to sprite
      const label = this.scene.playerManager.playerNameLabels[id];
      if (label) {
        this.debugGraphics.lineStyle(1, 0xffffff, 0.5);
        this.debugGraphics.lineBetween(sprite.x, sprite.y, label.x, label.y);
      }
    });
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
  }
}
// src/scenes/GameScene.js
import Phaser from 'phaser';
import { PlayerManager } from '../managers/PlayerManager.js';
import { InputHandler } from '../managers/InputHandler.js';
import { NetworkHandler } from '../managers/NetworkHandler.js';
import { ReconciliationManager } from '../managers/ReconciliationManager.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.room = null;
    this.playerId = null;
    this.playerName = null;
    
    // Managers
    this.playerManager = null;
    this.inputHandler = null;
    this.networkHandler = null;
    this.reconciliationManager = null;
  }

  preload() {
    // Create a simple square for the character
    this.textures.generate('character', {
      data: ['8888', '8888', '8888', '8888'],
      pixelWidth: 16,
      pixelHeight: 16
    });
  }

  create() {
    console.log("GameScene created");
    
    // Get room from registry
    this.room = this.registry.get('colyseusRoom');
    if (!this.room) {
      this.add.text(400, 300, 'Error: Not connected to server', {
        fontSize: '24px', fill: '#ff0000'
      }).setOrigin(0.5);
      return;
    }

    // Get player ID and name
    this.playerId = this.room.sessionId;
    this.playerName = this.registry.get('playerName') || 'Player';
    
    console.log("Current player ID:", this.playerId);
    console.log("Current player name:", this.playerName);

    // Create a simple background
    this.add.rectangle(400, 300, 800, 600, 0x222222);
    
    // Draw grid lines for reference
    this.createGrid();
    
    // Initialize managers
    this.initializeManagers();
    
    // Basic UI
    this.createUI();
  }
  
  createGrid() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x444444, 0.5);
    
    // Draw grid
    for (let x = 0; x < 800; x += 50) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, 600);
    }
    for (let y = 0; y < 600; y += 50) {
      graphics.moveTo(0, y);
      graphics.lineTo(800, y);
    }
    graphics.strokePath();
  }
  
  initializeManagers() {
    // Create managers in the right order
    
    // 1. Player Manager (handles rendering)
    this.playerManager = new PlayerManager(this, this.playerId, this.playerName);
    
    // 2. Input Handler (handles player input)
    this.inputHandler = new InputHandler(this);
    
    // 3. Reconciliation Manager (handles server reconciliation)
    this.reconciliationManager = new ReconciliationManager(this);
    
    // 4. Network Handler (handles communication with server)
    this.networkHandler = new NetworkHandler(this, this.room, this.playerId);
    
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
  
  createUI() {
    // Instructions
    this.add.text(20, 20, 'Use WASD or arrow keys to move', {
      fontSize: '18px', fill: '#ffffff'
    });
    
    // Debug info
    this.debugText = this.add.text(20, 550, '', {
      fontSize: '14px', fill: '#aaaaaa'
    });
  }
  
  updateDebugInfo() {
    if (!this.debugText) return;
    
    const position = this.playerManager ? this.playerManager.getPlayerPosition() : { x: 0, y: 0 };
    const pendingInputs = this.inputHandler ? this.inputHandler.pendingInputs.length : 0;
    const reconciliations = this.reconciliationManager ? this.reconciliationManager.getReconciliationCount() : 0;
    
    this.debugText.setText(
      `Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) | ` +
      `Pending inputs: ${pendingInputs} | ` +
      `Reconciliations: ${reconciliations} | ` +
      `Other players: ${Object.keys(this.playerManager.otherPlayers).length}`
    );
  }
  
  update(time, delta) {
    // Skip update if not initialized
    if (!this.playerManager || !this.inputHandler) return;
    
    // Handle player input
    this.inputHandler.update(delta);
    
    // Update other players
    this.playerManager.updateOtherPlayers(delta);
    
    // Update debug info
    this.updateDebugInfo();
  }
}
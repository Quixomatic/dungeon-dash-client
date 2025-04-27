// src/scenes/LobbyScene.js
import Phaser from 'phaser';
import networkManager from '../systems/NetworkManager.js';
import gameState from '../systems/GameState.js';
import { createDebugHelper } from '../utils/debug.js';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
    this.playerName = 'Player_' + Math.floor(Math.random() * 1000) + '_' + Date.now() % 10000;
    this.eventNotification = null;
    this.debug = null;
  }

  preload() {
    // Create textures instead of loading images
    this.textures.generate('character', {
      data: ['8888', '8888', '8888', '8888'],
      pixelWidth: 16,
      pixelHeight: 16
    });
    
    this.textures.generate('button', {
      data: ['2222222222', '2222222222', '2222222222', '2222222222'],
      pixelWidth: 20,
      pixelHeight: 10
    });
  }

  create() {
    // Reset game state to lobby phase
    gameState.reset();
    gameState.setPhase('lobby');
    
    // UI elements
    this.add.text(400, 100, 'Dungeon Dash Royale', {
      fontSize: '32px',
      fill: '#fff'
    }).setOrigin(0.5);

    this.add.text(400, 150, 'Lobby', {
      fontSize: '24px',
      fill: '#fff'
    }).setOrigin(0.5);

    // Name display
    this.add.text(400, 200, `Your name: ${this.playerName}`, {
      fontSize: '18px',
      fill: '#fff'
    }).setOrigin(0.5);

    // Connect button
    const connectButton = this.add.text(400, 300, 'Join Game', {
      fontSize: '24px',
      backgroundColor: '#4a4',
      padding: { x: 20, y: 10 },
      fixedWidth: 200,
      align: 'center'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => connectButton.setBackgroundColor('#6c6'))
      .on('pointerout', () => connectButton.setBackgroundColor('#4a4'))
      .on('pointerdown', () => this.connectToServer());

    // Status text
    this.statusText = this.add.text(400, 350, 'Waiting to connect...', {
      fontSize: '18px',
      fill: '#fff'
    }).setOrigin(0.5);

    // Player count
    this.playerCountText = this.add.text(400, 400, 'Players: 0', {
      fontSize: '18px',
      fill: '#fff'
    }).setOrigin(0.5);

    // Countdown text (hidden initially)
    this.countdownText = this.add.text(400, 450, '', {
      fontSize: '24px',
      fill: '#ff0',
      fontStyle: 'bold'
    }).setOrigin(0.5).setVisible(false);
    
    // Create debug helper
    this.debug = createDebugHelper(this, {
      sceneName: 'LOBBY SCENE',
      sceneLabelColor: '#ff9900',
      y: 480
    });
    
    // Set up phase change listener
    gameState.addEventListener('phaseChange', data => {
      if (data.newPhase === 'playing') {
        this.startGame();
      }
    });
    
    // Update debug info periodically
    this.time.addEvent({
      delay: 500,
      callback: this.updateDebugInfo,
      callbackScope: this,
      loop: true
    });
  }
  
  updateDebugInfo() {
    this.debug.displayObject({
      'Phase': gameState.getPhase(),
      'Players': gameState.getPlayerCount(),
      'Connected': networkManager.isConnected() ? 'Yes' : 'No',
      'Your ID': networkManager.getPlayerId() || 'Not connected'
    });
    
    // Update player count
    this.playerCountText.setText(`Players: ${gameState.getPlayerCount()} / 100`);
  }

  async connectToServer() {
    try {
      this.statusText.setText('Connecting to server...');
      
      // Initialize network manager
      networkManager.init();
      
      // Connect to server
      const room = await networkManager.connect({ name: this.playerName });
      
      this.statusText.setText('Connected! Room: ' + room.id);
      
      // Store room and player info in registry for access from other scenes
      this.registry.set('colyseusRoom', room);
      this.registry.set('playerName', this.playerName);
      
      // Add message handlers
      networkManager.addMessageHandler('countdownStarted', message => {
        this.countdownText.setText(`Game starting in ${message.seconds}s`);
        this.countdownText.setVisible(true);
      });
      
      networkManager.addMessageHandler('countdownUpdate', message => {
        this.countdownText.setText(`Game starting in ${message.seconds}s`);
      });
      
      networkManager.addMessageHandler('globalEvent', message => {
        this.showGlobalEventNotification(message.message);
      });
      
      // Update DOM elements
      const playerCountElement = document.getElementById('player-count');
      if (playerCountElement) {
        playerCountElement.innerText = `Players: ${gameState.getPlayerCount()}`;
      }

    } catch (error) {
      console.error("Connection error:", error);
      this.statusText.setText('Connection error: ' + error.message);
    }
  }

  showGlobalEventNotification(message) {
    // Create or update notification text
    if (this.eventNotification) {
      this.eventNotification.setText(message);
      this.eventNotification.setVisible(true);
    } else {
      this.eventNotification = this.add.text(400, 500, message, {
        fontSize: '18px',
        fill: '#ffff00',
        backgroundColor: '#333333',
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5);
    }
    
    // Hide after a few seconds
    this.time.delayedCall(5000, () => {
      if (this.eventNotification) {
        this.eventNotification.setVisible(false);
      }
    });
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
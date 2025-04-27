// src/scenes/LobbyScene.js
import Phaser from 'phaser';
import { Client } from 'colyseus.js';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
    this.client = null;
    this.playerName = 'Player_' + Math.floor(Math.random() * 1000);
  }

  preload() {
    this.load.image('character', 'assets/character.png');
    this.load.image('button', 'assets/button.png');
  }

  create() {
    this.add.text(400, 100, 'Dungeon Dash Royale', {
      fontSize: '32px',
      fill: '#fff'
    }).setOrigin(0.5);

    this.add.text(400, 150, 'Lobby', {
      fontSize: '24px',
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
  }

  async connectToServer() {
    try {
      this.statusText.setText('Connecting to server...');
      
      // Create Colyseus client
      this.client = new Client('ws://localhost:2567');
      
      // Join or create "normal" room
      const room = await this.client.joinOrCreate('normal', { 
        name: this.playerName 
      });
      
      this.statusText.setText('Connected! Room: ' + room.roomId);
      
      // Store room in the registry to access it from other scenes
      this.registry.set('colyseusRoom', room);
      this.registry.set('playerName', this.playerName);
      
      // Handle room state changes
      room.onStateChange((state) => {
        // Update player count
        const playerCount = Object.keys(state.players).length;
        this.playerCountText.setText(`Players: ${playerCount} / 100`);
        document.getElementById('player-count').innerText = `Players: ${playerCount}`;
        
        // Check if game is starting
        if (state.gameStarted) {
          this.startGame();
        }
      });
      
      // Handle countdown
      room.onMessage('countdownStarted', (message) => {
        this.countdownText.setText(`Game starting in ${message.seconds}s`);
        this.countdownText.setVisible(true);
      });
      
      room.onMessage('countdownUpdate', (message) => {
        this.countdownText.setText(`Game starting in ${message.seconds}s`);
      });
      
      room.onMessage('gameStarted', () => {
        this.startGame();
      });
      
      // Handle game start
      room.onMessage('dungeonGenerated', (message) => {
        // Store dungeon data in registry
        this.registry.set('dungeonData', message);
        this.startGame();
      });

    } catch (error) {
      console.error("Connection error:", error);
      this.statusText.setText('Connection error: ' + error.message);
    }
  }

  startGame() {
    this.scene.start('GameScene');
  }
}
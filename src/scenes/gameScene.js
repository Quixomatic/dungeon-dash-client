// src/scenes/GameScene.js
import Phaser from 'phaser';
import { setupPlayerControls } from '../utils/controls.js';
import { createDebugHelper } from '../utils/debug.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.room = null;
    this.playerId = null;
    this.playerEntity = null;
    this.otherPlayers = {};
    this.controls = null;
    this.playerNameLabels = {};
    this.debug = null;
    this.playersListenersSet = false;
    this.debugGraphics = null;
    this.debugPlayerText = null;
  }

  preload() {
    // Create a green square for character 
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
        fontSize: '24px',
        fill: '#ff0000'
      }).setOrigin(0.5);
      return;
    }

    console.log("GameScene started - Room:", this.room ? this.room.id : "none");
    if (this.room && this.room.state && this.room.state.players) {
      console.log("Initial players in room:", Object.keys(this.room.state.players));
    }

    // Create a simple background
    this.add.rectangle(400, 300, 800, 600, 0x222222);
    
    // Add some grid lines for reference
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

    // Get player ID and name
    this.playerId = this.room.sessionId;
    this.playerName = this.registry.get('playerName') || 'Player';
    
    console.log("Current player ID:", this.playerId);
    console.log("Current player name:", this.playerName);

    // Set up debug helper
    this.debug = createDebugHelper(this, {
      sceneName: 'GAME SCENE',
      sceneLabelColor: '#00ff99'
    });
    
    // Create local player
    this.createLocalPlayer();
    
    // Set up player controls
    this.controls = setupPlayerControls(this, this.playerEntity, (x, y) => {
      // Update name label position
      if (this.playerNameLabels[this.playerId]) {
        this.playerNameLabels[this.playerId].x = x;
        this.playerNameLabels[this.playerId].y = y - 40;
      }
      
      // Send position to server
      this.sendPositionToServer(x, y);
    });
    
    // Set up state listeners
    this.setupStateListeners();
    
    // Info text
    this.infoText = this.add.text(20, 20, 'Use WASD or arrow keys to move', {
      fontSize: '18px',
      fill: '#ffffff'
    });
    
    // Player count text
    this.playerCountText = this.add.text(20, 50, 'Players: 0', {
      fontSize: '18px',
      fill: '#ffffff'
    });
    
    // Update player count and debug info periodically
    this.time.addEvent({
      delay: 500,
      callback: this.updateDebugInfo,
      callbackScope: this,
      loop: true
    });

    // Add this to the create() method
    const debugButton = this.add.text(700, 550, 'Debug Players', {
      fontSize: '16px',
      backgroundColor: '#555555',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    debugButton.on('pointerdown', () => {
      console.log('--- DEBUG PLAYERS ---');
      console.log('Current room ID:', this.room.id);
      console.log('Your player ID:', this.playerId);
      
      // Log room state players
      if (this.room && this.room.state && this.room.state.players) {
        console.log('Players in room state:', Object.keys(this.room.state.players).length);
        for (const id in this.room.state.players) {
          const player = this.room.state.players[id];
          console.log(`Player ${id}:`, {
            name: player.name,
            position: player.position ? `(${player.position.x}, ${player.position.y})` : 'unknown',
            isCurrentPlayer: id === this.playerId
          });
        }
      } else {
        console.log('No players in room state');
      }
      
      // Log locally tracked players
      console.log('Locally tracked players:', Object.keys(this.otherPlayers).length);
      for (const id in this.otherPlayers) {
        const sprite = this.otherPlayers[id];
        console.log(`Player sprite ${id}:`, {
          position: sprite ? `(${sprite.x}, ${sprite.y})` : 'unknown',
          hasLabel: !!this.playerNameLabels[id]
        });
      }
    });
  }

  updateDebugInfo() {
    try {
      // Update player count
      if (this.room && this.room.state && this.room.state.players) {
        const count = Object.keys(this.room.state.players).length;
        this.playerCountText.setText(`Players: ${count}`);
        
        // Update debug info
        this.debug.displayObject({
          'Room ID': this.room.id,
          'Your ID': this.playerId,
          'Total players': count,
          'Other players': Object.keys(this.otherPlayers).length,
          'Other IDs': Object.keys(this.otherPlayers).join(', ')
        });
      }
    } catch (error) {
      console.error("Error updating debug info:", error);
    }
  }

  createLocalPlayer() {
    console.log("Creating local player");
    
    // Create player sprite
    this.playerEntity = this.add.sprite(400, 300, 'character');
    this.playerEntity.setTint(0x00ff00); // Green for current player
    
    // Add physics
    this.physics.add.existing(this.playerEntity);
    
    // Add name label
    this.playerNameLabels[this.playerId] = this.add.text(
      400, 260, this.playerName, 
      { fontSize: '14px', fill: '#ffff00' }
    ).setOrigin(0.5);
    
    // Camera follows player
    this.cameras.main.startFollow(this.playerEntity);
    
    // Send initial position to server
    this.sendPositionToServer(400, 300);
  }

  setupStateListeners() {
    console.log("Setting up state listeners");
    
    if (this.room && this.room.state) {
      console.log("Room state available:", this.room.state);
      console.log("Players collection:", this.room.state.players);
      
      if (this.room.state.players) {
        console.log("Players collection available");
        
        // Set up direct position change listeners for existing players
        for (const sessionId in this.room.state.players) {
          if (sessionId !== this.playerId) {
            const player = this.room.state.players[sessionId];
            console.log(`Setting up position listener for player ${sessionId}`);
            
            // Listen for position changes
            if (player.position && typeof player.position.onChange === 'function') {
              player.position.onChange = () => {
                console.log(`Player ${sessionId} position changed: ${player.position.x}, ${player.position.y}`);
                
                // Make sure the player sprite exists
                if (!this.otherPlayers[sessionId]) {
                  console.log(`Creating missing player sprite for ${sessionId}`);
                  this.createOtherPlayerSprite(sessionId, player);
                }
                
                // Update the sprite position
                if (this.otherPlayers[sessionId]) {
                  this.otherPlayers[sessionId].x = player.position.x;
                  this.otherPlayers[sessionId].y = player.position.y;
                  
                  // Update the name label position
                  if (this.playerNameLabels[sessionId]) {
                    this.playerNameLabels[sessionId].x = player.position.x;
                    this.playerNameLabels[sessionId].y = player.position.y - 40;
                  }
                }
              };
            }
          }
        }
        
        // Set up onAdd handler for new players
        this.room.state.players.onAdd((player, sessionId) => {
          console.log(`Player added: ${sessionId}`, player);
          
          // Don't add the current player
          if (sessionId !== this.playerId) {
            this.createOtherPlayerSprite(sessionId, player);
            
            // Set up position change listener
            if (player.position && typeof player.position.onChange === 'function') {
              player.position.onChange = () => {
                if (this.otherPlayers[sessionId]) {
                  this.otherPlayers[sessionId].x = player.position.x;
                  this.otherPlayers[sessionId].y = player.position.y;
                  this.playerNameLabels[sessionId].x = player.position.x;
                  this.playerNameLabels[sessionId].y = player.position.y - 40;
                }
              };
            }
            
            // Also try the listen method for position changes
            if (typeof player.listen === 'function') {
              player.listen("position", (position) => {
                console.log(`Player ${sessionId} position updated to ${position.x}, ${position.y}`);
                if (this.otherPlayers[sessionId]) {
                  this.otherPlayers[sessionId].x = position.x;
                  this.otherPlayers[sessionId].y = position.y;
                  this.playerNameLabels[sessionId].x = position.x;
                  this.playerNameLabels[sessionId].y = position.y - 40;
                }
              });
            }
          }
        });
        
        // Set up onRemove handler for players leaving
        this.room.state.players.onRemove((player, sessionId) => {
          console.log(`Player removed: ${sessionId}`);
          this.removeOtherPlayer(sessionId);
        });
        
        this.playersListenersSet = true;
      } else {
        console.log("Players collection not available yet");
        
        // Listen for state changes to detect when players collection becomes available
        this.room.onStateChange((state) => {
          console.log("State changed:", state);
          
          if (!this.playersListenersSet && state && state.players) {
            console.log("Players collection now available, setting up listeners");
            
            // Set up onAdd handler
            state.players.onAdd((player, sessionId) => {
              console.log(`Player added (from state change): ${sessionId}`);
              if (sessionId !== this.playerId) {
                this.createOtherPlayerSprite(sessionId, player);
              }
            });
            
            // Set up onRemove handler
            state.players.onRemove((player, sessionId) => {
              console.log(`Player removed (from state change): ${sessionId}`);
              this.removeOtherPlayer(sessionId);
            });
            
            // Process existing players
            for (const sessionId in state.players) {
              if (sessionId !== this.playerId) {
                console.log(`Processing existing player (from state change): ${sessionId}`);
                this.createOtherPlayerSprite(sessionId, state.players[sessionId]);
              }
            }
            
            this.playersListenersSet = true;
          }
        });
      }
    } else {
      console.log("Room state not available yet");
    }
    
    // Handle player joined message
    this.room.onMessage("playerJoined", (message) => {
      console.log(`Player joined message received:`, message);
      
      // Skip if it's the current player
      if (message.id === this.playerId) return;
      
      // Check if we already have this player
      if (this.otherPlayers[message.id]) {
        console.log(`Already tracking player ${message.id}`);
        return;
      }
      
      console.log(`New player joined: ${message.id} (${message.name})`);
      
      // Create a new player at a default position
      // We'll rely on position updates to move them to the correct location
      const newPlayer = {
        name: message.name,
        position: { x: 400, y: 300 }
      };
      
      // Create sprite for the player
      this.createOtherPlayerSprite(message.id, newPlayer);
    });
    
    // Handle player left message
    this.room.onMessage("playerLeft", (message) => {
      console.log(`Player left message received:`, message);
      
      // Remove the player sprite
      this.removeOtherPlayer(message.id);
    });
    
    // Handle explicit player movement messages
    this.room.onMessage("playerMoved", (message) => {
      console.log(`Player ${message.id} moved to (${message.x}, ${message.y})`);
      
      // Skip if it's the current player
      if (message.id === this.playerId) return;
      
      // If we don't have this player yet, create them
      if (!this.otherPlayers[message.id]) {
        console.log(`Creating player ${message.id} from movement message`);
        const newPlayer = {
          name: `Player_${message.id.substring(0, 4)}`,
          position: { x: message.x, y: message.y }
        };
        this.createOtherPlayerSprite(message.id, newPlayer);
      } else {
        // Update existing player position
        this.otherPlayers[message.id].x = message.x;
        this.otherPlayers[message.id].y = message.y;
        
        // Update name label position
        if (this.playerNameLabels[message.id]) {
          this.playerNameLabels[message.id].x = message.x;
          this.playerNameLabels[message.id].y = message.y - 40;
        }
      }
    });
    
    // Message handlers
    this.room.onMessage("leaderboardUpdate", (message) => {
      console.log("Leaderboard update:", message);
    });
    
    this.room.onMessage("globalEvent", (message) => {
      console.log("Global event:", message);
      this.showGlobalEventNotification(message.message);
    });
    
    // Add a periodic check for active players
    this.time.addEvent({
      delay: 2000, // Check every 2 seconds
      callback: () => {
        if (this.room && this.room.state && this.room.state.players) {
          console.log("Active players:", Object.keys(this.room.state.players).length);
          
          // Process any players that might have been missed
          for (const sessionId in this.room.state.players) {
            const player = this.room.state.players[sessionId];
            
            if (sessionId !== this.playerId && !this.otherPlayers[sessionId]) {
              console.log(`Adding previously missed player: ${sessionId}`);
              this.createOtherPlayerSprite(sessionId, player);
            }
          }
        }
      },
      loop: true
    });
  }

  createOtherPlayerSprite(sessionId, player) {
    console.log(`Creating sprite for player ${sessionId}`);
    
    // Skip if already added or it's the current player
    if (this.otherPlayers[sessionId] || sessionId === this.playerId) {
      console.log(`Skipping player creation for ${sessionId} - already exists or is current player`);
      return;
    }
    
    // Get initial position
    let startX = 400 + (Math.random() * 200 - 100);
    let startY = 300 + (Math.random() * 200 - 100);
    
    // Use player's position if available
    if (player.position) {
      startX = player.position.x || startX;
      startY = player.position.y || startY;
    }
    
    // Create sprite for other player
    const playerSprite = this.add.sprite(startX, startY, 'character');
    playerSprite.setTint(0x00aaff); // Blue for other players
    
    // Add physics
    this.physics.add.existing(playerSprite);
    
    // Add name label
    const nameLabel = this.add.text(
      startX,
      startY - 40,
      player.name || 'Unknown',
      { fontSize: '14px', fill: '#ffffff' }
    ).setOrigin(0.5);
    
    // Store references
    this.otherPlayers[sessionId] = playerSprite;
    this.playerNameLabels[sessionId] = nameLabel;
    
    console.log(`Added player ${sessionId} at position ${startX}, ${startY}`);
  }
  
  removeOtherPlayer(sessionId) {
    // Skip if this is the current player
    if (sessionId === this.playerId) return;
    
    console.log(`Removing player: ${sessionId}`);
    
    // Remove sprite if exists
    if (this.otherPlayers[sessionId]) {
      this.otherPlayers[sessionId].destroy();
      delete this.otherPlayers[sessionId];
    }
    
    // Remove name label if exists
    if (this.playerNameLabels[sessionId]) {
      this.playerNameLabels[sessionId].destroy();
      delete this.playerNameLabels[sessionId];
    }
  }
  
  showGlobalEventNotification(message) {
    // Create notification at the top of the screen
    const notification = this.add.text(400, 100, message, {
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#ffff00',
      backgroundColor: '#333333',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setDepth(100);
    
    // Fade out after a few seconds
    this.tweens.add({
      targets: notification,
      alpha: 0,
      duration: 2000,
      delay: 3000,
      onComplete: () => {
        notification.destroy();
      }
    });
  }

  showVisiblePlayers() {
    // Clear any existing debug graphics
    if (this.debugGraphics) {
      this.debugGraphics.clear();
    } else {
      this.debugGraphics = this.add.graphics();
    }
    
    // Draw current player position (green circle)
    this.debugGraphics.fillStyle(0x00ff00, 0.5);
    this.debugGraphics.fillCircle(this.playerEntity.x, this.playerEntity.y, 20);
    
    // Draw other players (blue circles)
    this.debugGraphics.fillStyle(0x0000ff, 0.5);
    Object.entries(this.otherPlayers).forEach(([id, sprite]) => {
      this.debugGraphics.fillCircle(sprite.x, sprite.y, 20);
      
      // Draw line from text to sprite
      const label = this.playerNameLabels[id];
      if (label) {
        this.debugGraphics.lineStyle(1, 0xffffff, 0.5);
        this.debugGraphics.lineBetween(sprite.x, sprite.y, label.x, label.y);
      }
    });
    
    // Add text showing player count
    if (this.debugPlayerText) {
      this.debugPlayerText.destroy();
    }
    
    const otherCount = Object.keys(this.otherPlayers).length;
    this.debugPlayerText = this.add.text(400, 550, 
      `Your position: (${Math.floor(this.playerEntity.x)}, ${Math.floor(this.playerEntity.y)}) | Other players: ${otherCount}`, 
      { fontSize: '14px', fill: '#ffffff', backgroundColor: '#333333', padding: { x: 5, y: 5 } }
    ).setOrigin(0.5);
  }

  update() {
    if (!this.playerEntity || !this.room || !this.controls) return;

    // Handle player movement using the controls utility
    this.controls.update();
    
    // Update debug visualization
    this.showVisiblePlayers();
  }
  
  sendPositionToServer(x, y) {
    if (!this.room) return;
    
    console.log(`Sending position: (${x || this.playerEntity.x}, ${y || this.playerEntity.y})`);
    
    this.room.send("playerAction", {
      type: "move",
      x: x || this.playerEntity.x,
      y: y || this.playerEntity.y
    });
  }
}
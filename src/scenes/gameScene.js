// src/scenes/GameScene.js
import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.room = null;
    this.playerId = null;
    this.playerEntity = null;
    this.otherPlayers = {};
    this.cursors = null;
    this.playerNameLabels = {};
  }

  create() {
    // Get room from registry
    this.room = this.registry.get('colyseusRoom');
    if (!this.room) {
      this.add.text(400, 300, 'Error: Not connected to server', {
        fontSize: '24px',
        fill: '#ff0000'
      }).setOrigin(0.5);
      return;
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

    // Setup input
    this.cursors = this.input.keyboard.createCursorKeys();

    // Listen for state changes
    this.room.state.players.onAdd((player, sessionId) => {
      const isCurrentPlayer = sessionId === this.playerId;

      // Create player sprite
      const playerSprite = this.add.sprite(
        player.position.x || 400, 
        player.position.y || 300, 
        'character'
      );
      
      // Add physics
      this.physics.add.existing(playerSprite);
      
      // Add player name label
      const nameLabel = this.add.text(
        player.position.x || 400,
        (player.position.y || 300) - 40,
        player.name || 'Unknown',
        { fontSize: '14px', fill: isCurrentPlayer ? '#ffff00' : '#ffffff' }
      ).setOrigin(0.5);

      if (isCurrentPlayer) {
        // Store current player
        this.playerEntity = playerSprite;
        this.playerEntity.setTint(0x00ff00); // Green tint for current player
        this.cameras.main.startFollow(this.playerEntity);
      } else {
        // Store other players
        this.otherPlayers[sessionId] = playerSprite;
      }
      
      // Store name label
      this.playerNameLabels[sessionId] = nameLabel;

      // Listen for changes to this player's position
      player.listen("position", (position) => {
        if (sessionId !== this.playerId) {
          // Update other players
          playerSprite.x = position.x;
          playerSprite.y = position.y;
          nameLabel.x = position.x;
          nameLabel.y = position.y - 40;
        }
      });

      // Listen for player removal
      this.room.state.players.onRemove((player, sessionId) => {
        if (this.otherPlayers[sessionId]) {
          this.otherPlayers[sessionId].destroy();
          delete this.otherPlayers[sessionId];
        }
        
        if (this.playerNameLabels[sessionId]) {
          this.playerNameLabels[sessionId].destroy();
          delete this.playerNameLabels[sessionId];
        }
      });
    });

    // Info text
    this.add.text(20, 20, 'Use arrow keys to move', {
      fontSize: '18px',
      fill: '#ffffff'
    });
  }

  update() {
    if (!this.playerEntity || !this.room) return;

    // Handle movement
    let moved = false;
    const speed = 5;
    
    if (this.cursors.left.isDown) {
      this.playerEntity.x -= speed;
      moved = true;
    } else if (this.cursors.right.isDown) {
      this.playerEntity.x += speed;
      moved = true;
    }
    
    if (this.cursors.up.isDown) {
      this.playerEntity.y -= speed;
      moved = true;
    } else if (this.cursors.down.isDown) {
      this.playerEntity.y += speed;
      moved = true;
    }
    
    // Keep player in bounds
    this.playerEntity.x = Phaser.Math.Clamp(this.playerEntity.x, 0, 800);
    this.playerEntity.y = Phaser.Math.Clamp(this.playerEntity.y, 0, 600);
    
    // Update name label position
    if (this.playerNameLabels[this.playerId]) {
      this.playerNameLabels[this.playerId].x = this.playerEntity.x;
      this.playerNameLabels[this.playerId].y = this.playerEntity.y - 40;
    }
    
    // Send position to server if moved
    if (moved) {
      this.room.send("playerAction", {
        type: "move",
        x: this.playerEntity.x,
        y: this.playerEntity.y
      });
    }
  }
}
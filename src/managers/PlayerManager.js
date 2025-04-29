// src/managers/PlayerManager.js

export class PlayerManager {
  constructor(scene, playerId, playerName) {
    this.scene = scene;
    this.playerId = playerId;
    this.playerName = playerName;
    
    // Player entities
    this.player = null;
    this.nameLabel = null;
    
    // Other players
    this.otherPlayers = {};
    this.otherPlayerLabels = {};
    
    // Initialize player
    this.createLocalPlayer();
  }
  
  /**
   * Create the local player entity
   */
  createLocalPlayer() {
    // Create player sprite
    this.player = this.scene.add.sprite(400, 300, 'character');
    this.player.setTint(0x00ff00); // Green for local player
    this.player.setDepth(10);
    
    // Add physics
    this.scene.physics.add.existing(this.player);
    
    // Add name label
    this.nameLabel = this.scene.add.text(400, 260, this.playerName, {
      fontSize: '14px',
      fill: '#ffff00'
    }).setOrigin(0.5).setDepth(10);
    
    // Make camera follow player
    this.scene.cameras.main.startFollow(this.player);
    
    console.log(`Local player created at (${this.player.x}, ${this.player.y})`);
  }
  
  /**
   * Get current player position
   * @returns {Object} - Player position {x, y}
   */
  getPlayerPosition() {
    if (!this.player) return { x: 0, y: 0 };
    return { x: this.player.x, y: this.player.y };
  }
  
  /**
   * Set player position
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  setPlayerPosition(x, y) {
    if (!this.player) return;
    
    this.player.x = x;
    this.player.y = y;
    
    // Update name label position
    if (this.nameLabel) {
      this.nameLabel.x = x;
      this.nameLabel.y = y - 40;
    }
  }
  
  /**
   * Update or create other player
   * @param {string} id - Player ID
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} name - Player name
   */
  updateOtherPlayer(id, x, y, name) {
    // Skip if it's the local player
    if (id === this.playerId) return;
    
    // Create if doesn't exist
    if (!this.otherPlayers[id]) {
      this.otherPlayers[id] = this.scene.add.sprite(x, y, 'character');
      this.otherPlayers[id].setTint(0x00aaff); // Blue for other players
      
      // Add name label
      this.otherPlayerLabels[id] = this.scene.add.text(x, y - 40, 
        name || `Player_${id.substring(0, 4)}`, {
        fontSize: '14px',
        fill: '#ffffff'
      }).setOrigin(0.5);
      
      console.log(`Created other player ${id} at (${x}, ${y})`);
    }
    
    // Update target position (will be interpolated in update)
    this.otherPlayers[id].targetX = x;
    this.otherPlayers[id].targetY = y;
  }
  
  /**
   * Remove other player
   * @param {string} id - Player ID
   */
  removeOtherPlayer(id) {
    // Skip if it's the local player
    if (id === this.playerId) return;
    
    // Remove sprite
    if (this.otherPlayers[id]) {
      this.otherPlayers[id].destroy();
      delete this.otherPlayers[id];
    }
    
    // Remove name label
    if (this.otherPlayerLabels[id]) {
      this.otherPlayerLabels[id].destroy();
      delete this.otherPlayerLabels[id];
    }
    
    console.log(`Removed player ${id}`);
  }
  
  /**
   * Update other players with interpolation
   * @param {number} delta - Time since last update in ms
   */
  updateOtherPlayers(delta) {
    const lerpFactor = 0.3; // Adjust for smoother/faster interpolation
    
    for (const id in this.otherPlayers) {
      const player = this.otherPlayers[id];
      
      // Skip if no target position
      if (player.targetX === undefined || player.targetY === undefined) continue;
      
      // Apply interpolation
      player.x = Phaser.Math.Linear(player.x, player.targetX, lerpFactor);
      player.y = Phaser.Math.Linear(player.y, player.targetY, lerpFactor);
      
      // Update name label
      if (this.otherPlayerLabels[id]) {
        this.otherPlayerLabels[id].x = player.x;
        this.otherPlayerLabels[id].y = player.y - 40;
      }
    }
  }
}
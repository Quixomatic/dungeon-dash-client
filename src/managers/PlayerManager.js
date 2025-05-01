import gameState from "../systems/GameState";

// src/managers/PlayerManager.js
export class PlayerManager {
  constructor(scene, playerId, playerName) {
    this.scene = scene;
    this.playerId = playerId;
    this.playerName = playerName;
    
    // Player entities
    this.localPlayer = null;
    this.nameLabel = null;
    
    // Other players
    this.otherPlayers = {};
    this.playerNameLabels = {};
    
    // Get player data from room state if available
    let initialX = 400;
    let initialY = 300;

    console.log('Hello???', gameState);
    
    // Try to get position from server
    if (this.scene.room && this.scene.room.state && 
        this.scene.room.state.players && this.scene.room.state.players.get(playerId)) {
      const serverPlayer = this.scene.room.state.players.get(playerId);
      initialX = serverPlayer.position.x;
      initialY = serverPlayer.position.y;
      console.log(`Using server position for player: (${initialX}, ${initialY})`);
    } else {
      console.log("No server position available, using default");
    }
    
    // Initialize player with the determined position
    this.createLocalPlayer(initialX, initialY);
  }
  
  /**
   * Create the local player entity
   * @param {number} x - Initial X position
   * @param {number} y - Initial Y position
   */
  createLocalPlayer(x, y) {
    // Create player sprite
    this.localPlayer = this.scene.add.sprite(x, y, 'character');
    this.localPlayer.setTint(0x00ff00); // Green for local player
    this.localPlayer.setDepth(10);
    
    // Add physics
    this.scene.physics.add.existing(this.localPlayer);
    
    // Add name label
    this.nameLabel = this.scene.add.text(x, y - 40, this.playerName + '_' + this.playerId, {
      fontSize: '14px',
      fill: '#ffff00',
      backgroundColor: '#00000080',
      padding: { x: 3, y: 2 }
    }).setOrigin(0.5).setDepth(10);
    
    // Make camera follow player
    this.scene.cameras.main.startFollow(this.localPlayer, true, 0.08, 0.08);
    
    console.log(`Local player created at (${this.localPlayer.x}, ${this.localPlayer.y})`);
  }
  
  /**
   * Get current player position
   * @returns {Object} - Player position {x, y}
   */
  getPlayerPosition() {
    if (!this.localPlayer) return { x: 0, y: 0 };
    return { x: this.localPlayer.x, y: this.localPlayer.y };
  }
  
  /**
   * Set player position
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  setPlayerPosition(x, y) {
    if (!this.localPlayer) return;
    
    this.localPlayer.x = x;
    this.localPlayer.y = y;
    
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
      this.otherPlayers[id].setDepth(10);
      
      // Add name label
      this.playerNameLabels[id] = this.scene.add.text(x, y - 40, 
        name || `Player_${id.substring(0, 4)}`, {
        fontSize: '14px',
        fill: '#ffffff',
        backgroundColor: '#00000080',
        padding: { x: 3, y: 2 }
      }).setOrigin(0.5).setDepth(10);
      
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
    if (this.playerNameLabels[id]) {
      this.playerNameLabels[id].destroy();
      delete this.playerNameLabels[id];
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
      if (this.playerNameLabels[id]) {
        this.playerNameLabels[id].x = player.x;
        this.playerNameLabels[id].y = player.y - 40;
      }
    }
  }
  
  /**
   * Get player count
   * @returns {number} - Number of players
   */
  getPlayerCount() {
    return Object.keys(this.otherPlayers).length + 1; // +1 for local player
  }
}
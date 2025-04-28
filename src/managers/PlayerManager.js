// src/managers/PlayerManager.js
import networkManager from '../systems/NetworkManager.js';

export class PlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.localPlayer = null;
    this.otherPlayers = {};
    this.playerNameLabels = {};
  }
  
  initialize() {
    console.log("Initializing PlayerManager");
    this.createLocalPlayer();
  }
  
  createLocalPlayer() {
    console.log("Creating local player");
    
    // Create player sprite
    this.localPlayer = this.scene.add.sprite(400, 300, 'character');
    this.localPlayer.setTint(0x00ff00); // Green for current player
    
    // Add physics
    this.scene.physics.add.existing(this.localPlayer);
    
    // Add name label
    this.playerNameLabels[this.scene.playerId] = this.scene.add.text(
      400, 260, this.scene.playerName, 
      { fontSize: '14px', fill: '#ffff00' }
    ).setOrigin(0.5);
    
    // Camera follows player
    this.scene.cameras.main.startFollow(this.localPlayer);
  }
  
  createOtherPlayerSprite(sessionId, player) {
    console.log(`Creating sprite for player ${sessionId}`);
    
    // Skip if already added or it's the current player
    if (this.otherPlayers[sessionId] || sessionId === this.scene.playerId) {
      console.log(`Skipping player creation for ${sessionId}`);
      return;
    }
    
    // Get initial position
    let startX = 400;
    let startY = 300;
    
    // Use player's position if available
    if (player.position) {
      startX = player.position.x || startX;
      startY = player.position.y || startY;
    }
    
    // Create sprite for other player
    const playerSprite = this.scene.add.sprite(startX, startY, 'character');
    playerSprite.setTint(0x00aaff); // Blue for other players
    
    // Add physics
    this.scene.physics.add.existing(playerSprite);
    
    // Add name label
    const nameLabel = this.scene.add.text(
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
    if (sessionId === this.scene.playerId) return;
    
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
  
  updateOtherPlayers(delta) {
    for (const id in this.otherPlayers) {
      // Skip if this is the current player
      if (id === this.scene.playerId) continue;
      
      const sprite = this.otherPlayers[id];
      const serverPlayer = this.scene.room.state.players[id];
      
      // Skip if server player doesn't exist or has no position
      if (!serverPlayer || !serverPlayer.position) continue;
      
      // Apply interpolation to smooth updates
      sprite.x = Phaser.Math.Linear(sprite.x, serverPlayer.position.x, 0.3);
      sprite.y = Phaser.Math.Linear(sprite.y, serverPlayer.position.y, 0.3);
      
      // Update name label position
      if (this.playerNameLabels[id]) {
        this.playerNameLabels[id].x = sprite.x;
        this.playerNameLabels[id].y = sprite.y - 40;
      }
    }
  }
  
  checkMissingPlayers() {
    if (!this.scene.room || !this.scene.room.state || !this.scene.room.state.players) return;
    
    // Check for players in room state that we don't have locally
    for (const id in this.scene.room.state.players) {
      if (id !== this.scene.playerId && !this.otherPlayers[id]) {
        console.log(`Adding previously missed player: ${id}`);
        this.createOtherPlayerSprite(id, this.scene.room.state.players[id]);
      }
    }
  }
  
  getPlayerCount() {
    return Object.keys(this.otherPlayers).length + 1; // +1 for local player
  }
}
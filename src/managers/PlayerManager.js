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

    console.log(this.scene.room.state);
    
    // Try to get position from server
    if (this.scene.room && this.scene.room.state && 
        this.scene.room.state.players && this.scene.room.state.players[playerId]) {
      const serverPlayer = this.scene.room.state.players[playerId];
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
   * Spawn a monster in the world
   * @param {Object} monsterData - Monster data from server
   */
  spawnMonster(monsterData) {
    // Skip if already exists
    if (this.monsters[monsterData.id]) return;
    
    // Create monster sprite
    const monster = this.scene.add.sprite(
      monsterData.x,
      monsterData.y,
      'character' // Placeholder, replace with actual monster sprites
    );
    
    // Set color based on monster type
    let tint;
    switch (monsterData.name) {
      case 'Slime':
        tint = 0x00ff00; // Green
        break;
      case 'Goblin':
        tint = 0xaaff00; // Yellow-green
        break;
      case 'Skeleton':
        tint = 0xffffff; // White
        break;
      case 'Zombie':
        tint = 0x00ffaa; // Cyan-green
        break;
      case 'Orc':
        tint = 0xaaaa00; // Yellow
        break;
      default:
        if (monsterData.isBoss) {
          tint = 0xff00ff; // Purple for bosses
        } else {
          tint = 0xff0000; // Red default
        }
    }
    
    monster.setTint(tint);
    monster.setDepth(5);
    
    // Add name label if boss
    if (monsterData.isBoss) {
      const nameLabel = this.scene.add.text(
        monsterData.x,
        monsterData.y - 40,
        monsterData.name,
        {
          fontSize: '16px',
          fontStyle: 'bold',
          fill: '#ff00ff',
          backgroundColor: '#00000080',
          padding: { x: 4, y: 2 }
        }
      ).setOrigin(0.5).setDepth(5);
      
      monster.nameLabel = nameLabel;
      
      // Add health bar for boss
      const healthBarBg = this.scene.add.rectangle(
        monsterData.x,
        monsterData.y - 25,
        50,
        6,
        0x000000
      ).setOrigin(0.5).setDepth(5);
      
      const healthBar = this.scene.add.rectangle(
        monsterData.x,
        monsterData.y - 25,
        50,
        6,
        0xff00ff
      ).setOrigin(0, 0.5).setDepth(5);
      
      monster.healthBar = healthBar;
      monster.healthBarBg = healthBarBg;
    }
    
    // Store monster data
    monster.data = monsterData;
    this.monsters[monsterData.id] = monster;
  }
  
  /**
   * Spawn an item in the world
   * @param {Object} itemData - Item data from server
   */
  spawnItem(itemData) {
    // Skip if already exists
    if (this.items[itemData.id]) return;
    
    // Create item sprite
    const item = this.scene.add.sprite(
      itemData.x,
      itemData.y,
      'character' // Placeholder, replace with actual item sprites
    );
    
    // Set color based on item rarity
    let tint;
    switch (itemData.rarity) {
      case 'common':
        tint = 0xffffff; // White
        break;
      case 'uncommon':
        tint = 0x00ff00; // Green
        break;
      case 'rare':
        tint = 0x0000ff; // Blue
        break;
      case 'epic':
        tint = 0xff00ff; // Purple
        break;
      case 'legendary':
        tint = 0xffaa00; // Orange
        break;
      default:
        tint = 0xaaaaaa; // Gray default
    }
    
    item.setTint(tint);
    item.setDepth(4);
    
    // Add floating effect
    this.scene.tweens.add({
      targets: item,
      y: item.y - 5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Store item data
    item.data = itemData;
    this.items[itemData.id] = item;
  }
  
  /**
   * Remove a monster from the world
   * @param {string} id - Monster ID
   */
  removeMonster(id) {
    const monster = this.monsters[id];
    if (!monster) return;
    
    // Remove name label if exists
    if (monster.nameLabel) {
      monster.nameLabel.destroy();
    }
    
    // Remove health bar if exists
    if (monster.healthBar) {
      monster.healthBar.destroy();
    }
    
    if (monster.healthBarBg) {
      monster.healthBarBg.destroy();
    }
    
    // Remove monster sprite
    monster.destroy();
    delete this.monsters[id];
  }
  
  /**
   * Remove an item from the world
   * @param {string} id - Item ID
   */
  removeItem(id) {
    const item = this.items[id];
    if (!item) return;
    
    // Remove item sprite
    item.destroy();
    delete this.items[id];
  }
  
  /**
   * Get player count
   * @returns {number} - Number of players
   */
  getPlayerCount() {
    return Object.keys(this.otherPlayers).length + 1; // +1 for local player
  }
}
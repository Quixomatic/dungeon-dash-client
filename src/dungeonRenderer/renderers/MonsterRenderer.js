// src/dungeonRenderer/renderers/MonsterRenderer.js
/**
 * MonsterRenderer - Handles rendering of monsters and NPCs
 * Creates individual sprite objects for monsters
 */
export class MonsterRenderer {
  constructor(scene, textureCache) {
    this.scene = scene;
    this.textureCache = textureCache;
    this.group = scene.add.group();
    this.monsters = new Map(); // Map of monster ID to sprite
    this.visibleMonsters = new Set(); // Set of visible monster IDs
    this.tileSize = 64;
    this.debug = false;

    // Monster colors for different types
    this.monsterColors = [
      0xff0000, // 1 - Red
      0x00ff00, // 2 - Green
      0x0000ff, // 3 - Blue
      0xff00ff, // 4 - Purple
      0x00ffff, // 5 - Cyan
      0xffff00, // 6 - Yellow
      0xff8800, // 7 - Orange
      0x88ff00, // 8 - Lime
    ];

    // Object pool for monster reuse
    this.monsterPool = [];
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.tileSize = options.tileSize || 64;
    this.debug = options.debug || false;
    this.group.setDepth(30);
    return this;
  }

  /**
   * Render monsters within a specific structure's bounds
   * @param {Object} mapData - Map data from server
   * @param {Object} structureData - Structure data containing bounds
   * @param {number} tileSize - Size of tiles in pixels
   */
  renderMonstersInStructure(mapData, structureData, tileSize) {
    if (!mapData || !mapData.layers || !mapData.layers.monsters) return;

    this.tileSize = tileSize || this.tileSize;
    const bounds = structureData.bounds;

    // Process all tiles within the structure bounds
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        // Check if there's a monster at this position
        if (
          y >= 0 &&
          y < mapData.layers.monsters.length &&
          x >= 0 &&
          mapData.layers.monsters[y] &&
          mapData.layers.monsters[y][x] > 0
        ) {
          // Create monster if it doesn't exist
          const monsterId = `monster_${x}_${y}`;
          if (!this.monsters.has(monsterId)) {
            this.createMonster(x, y, mapData.layers.monsters[y][x]);
          }
        }
      }
    }
  }

  /**
   * Create a monster at the specified position
   * @param {number} x - Tile x position
   * @param {number} y - Tile y position
   * @param {number} monsterValue - Monster value from the map data
   */
  createMonster(x, y, monsterValue) {
    // Skip empty monsters
    if (monsterValue === 0) return;

    // Generate unique ID for this monster
    const monsterId = `monster_${x}_${y}`;

    // Return if monster already exists
    if (this.monsters.has(monsterId)) return;

    // World position in pixels
    const worldX = x * this.tileSize + this.tileSize / 2;
    const worldY = y * this.tileSize + this.tileSize / 2;

    // Get monster color based on type
    const monsterColor =
      this.monsterColors[(monsterValue - 1) % this.monsterColors.length] ||
      0xff0000;

    // Try to reuse from pool
    let monster = null;

    if (this.monsterPool.length > 0) {
      // Reuse monster from pool
      monster = this.monsterPool.pop();
      monster.setPosition(worldX, worldY);
      monster.setVisible(true);

      // Update color if it's a circle
      if (monster.geom && monster.geom.type === Phaser.Geom.Circle) {
        monster.fillColor = monsterColor;
      }
    } else {
      // Create new monster
      // Check if we have a monster texture for this type
      if (this.scene.textures.exists(`monster_${monsterValue}`)) {
        monster = this.scene.add.image(
          worldX,
          worldY,
          `monster_${monsterValue}`
        );
        monster.setDisplaySize(this.tileSize * 0.8, this.tileSize * 0.8);
      } else {
        // Fallback to circle
        monster = this.scene.add.circle(
          worldX,
          worldY,
          this.tileSize / 3,
          monsterColor
        );
      }

      // Add simple animation
      this.scene.tweens.add({
        targets: monster,
        y: worldY + 4,
        duration: 1000 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
      });

      // Add interactive capabilities if needed
      monster.setInteractive();

      // Add hover effect
      monster.on("pointerover", function () {
        this.setScale(1.1);
      });

      monster.on("pointerout", function () {
        this.setScale(1);
      });
    }

    // Store monster metadata
    monster.monsterId = monsterId;
    monster.monsterType = monsterValue;
    monster.tileX = x;
    monster.tileY = y;

    // Store the monster
    this.monsters.set(monsterId, monster);

    // Add to group
    this.group.add(monster);

    // Initially visible
    monster.setVisible(true);

    if (this.debug) {
      console.log(`Created monster type ${monsterValue} at (${x},${y})`);
    }

    return monster;
  }

  /**
   * Update visibility of monsters based on camera bounds
   * @param {Object} cameraBounds - Camera bounds in pixels
   */
  updateVisibility(cameraBounds) {
    // Clear visible monsters set
    this.visibleMonsters.clear();

    // Check each monster
    this.monsters.forEach((monster, id) => {
      // Check if monster is in view
      const isVisible = !(
        monster.x + monster.width / 2 < cameraBounds.left ||
        monster.x - monster.width / 2 > cameraBounds.right ||
        monster.y + monster.height / 2 < cameraBounds.top ||
        monster.y - monster.height / 2 > cameraBounds.bottom
      );

      // Update visibility
      monster.setVisible(isVisible);

      // Track visible monsters
      if (isVisible) {
        this.visibleMonsters.add(id);
      }
    });

    if (this.debug) {
      console.log(
        `Visible monsters: ${this.visibleMonsters.size}/${this.monsters.size}`
      );
    }
  }

  /**
   * Get the count of visible monsters
   * @returns {number} - Number of visible monsters
   */
  getVisibleCount() {
    return this.visibleMonsters.size;
  }

  /**
   * Recycle a monster into the object pool
   * @param {string} monsterId - Monster ID
   */
  recycleMonster(monsterId) {
    const monster = this.monsters.get(monsterId);
    if (!monster) return;

    // Hide the monster
    monster.setVisible(false);

    // Add to pool
    this.monsterPool.push(monster);

    // Remove from tracked monsters
    this.monsters.delete(monsterId);
    this.visibleMonsters.delete(monsterId);
  }

  /**
   * Clear all monsters
   */
  clear() {
    // Destroy all monsters
    this.monsters.forEach((monster) => {
      monster.destroy();
    });

    // Clear the collections
    this.monsters.clear();
    this.visibleMonsters.clear();

    // Clear object pool
    this.monsterPool.forEach((monster) => {
      monster.destroy();
    });
    this.monsterPool.length = 0;

    // Clear the group
    this.group.clear(true, true);
  }

  /**
   * Destroy the renderer and clean up resources
   */
  destroy() {
    this.clear();

    if (this.group) {
      this.group.destroy(true);
      this.group = null;
    }
  }
}

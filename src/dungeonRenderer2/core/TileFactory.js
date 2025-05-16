// src/dungeonRenderer/core/TileFactory.js
import { SpritePool } from '../utils/SpritePool';

/**
 * TileFactory - Creates and manages tile sprites with efficient pooling
 * Handles sprite creation, reuse, and texture mapping
 */
export class TileFactory {
  /**
   * Create a new TileFactory
   * @param {Phaser.Scene} scene - The Phaser scene to render in
   * @param {TextureRegistry} textureRegistry - Texture registry for tile textures
   */
  constructor(scene, textureRegistry) {
    this.scene = scene;
    this.textureRegistry = textureRegistry;
    
    // Sprite pools for different tile types
    this.spritePools = {
      floor: null,   // Floor tiles (0)
      wall: null,    // Wall tiles (> 0)
      hole: null,    // Hole tiles (< 0)
      generic: null  // Backup pool
    };
    
    // Stats tracking
    this.stats = {
      active: 0,
      created: 0,
      reused: 0,
      released: 0
    };
    
    this.tileSize = 64;
    this.debug = false;
    this.initialized = false;
  }
  
  /**
   * Initialize the factory
   * @param {Object} options - Configuration options
   * @returns {TileFactory} - This instance for chaining
   */
  init(options = {}) {
    if (this.initialized) return this;
    
    this.tileSize = options.tileSize || this.tileSize;
    this.debug = options.debug || false;
    
    // Initial pool sizes
    const initialSize = options.poolInitialSize || 100;
    
    // Create sprite pools
    this.spritePools.floor = new SpritePool(this.scene, 'floor', initialSize);
    this.spritePools.wall = new SpritePool(this.scene, 'wall', initialSize);
    this.spritePools.hole = new SpritePool(this.scene, 'hole', Math.ceil(initialSize / 4));
    this.spritePools.generic = new SpritePool(this.scene, 'generic', Math.ceil(initialSize / 2));
    
    // Initialize pools with sprite creation functions
    this.spritePools.floor.setCreateFunction(() => this.createFloorSprite());
    this.spritePools.wall.setCreateFunction(() => this.createWallSprite());
    this.spritePools.hole.setCreateFunction(() => this.createHoleSprite());
    this.spritePools.generic.setCreateFunction(() => this.createGenericSprite());
    
    this.initialized = true;
    return this;
  }
  
  /**
   * Create a tile sprite based on tile value
   * @param {number} tileValue - The tile value from map data
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @returns {Phaser.GameObjects.Sprite} - The created or reused sprite
   */
  createTileSprite(tileValue, x, y) {
    // Determine which pool to use based on tile value
    let pool;
    if (tileValue === 0) {
      pool = this.spritePools.floor;
    } else if (tileValue > 0) {
      pool = this.spritePools.wall;
    } else if (tileValue < 0) {
      pool = this.spritePools.hole;
    } else {
      pool = this.spritePools.generic;
    }
    
    // Get sprite from pool
    const sprite = pool.get();
    
    // Configure sprite
    this.configureTileSprite(sprite, tileValue, x, y);
    
    // Update stats
    this.stats.active++;
    if (sprite.isNewlyCreated) {
      this.stats.created++;
      delete sprite.isNewlyCreated;
    } else {
      this.stats.reused++;
    }
    
    return sprite;
  }
  
  /**
   * Configure a tile sprite with proper texture and position
   * @param {Phaser.GameObjects.Sprite} sprite - The sprite to configure
   * @param {number} tileValue - The tile value from map data
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @private
   */
  configureTileSprite(sprite, tileValue, x, y) {
    // Position the sprite
    sprite.setPosition(x, y);
    
    // Determine texture key based on tile value
    const textureKey = this.getTileTextureKey(tileValue);
    
    // Set texture if it exists
    if (this.scene.textures.exists(textureKey)) {
      // Use existing texture
      sprite.setTexture(textureKey);
      sprite.setDisplaySize(this.tileSize, this.tileSize);
    } else {
      // Update appearance based on tile value
      this.updateTileAppearance(sprite, tileValue);
    }
    
    // Make visible 
    sprite.setVisible(true);
    
    // Store tile value for reference
    sprite.tileValue = tileValue;
  }
  
  /**
   * Get texture key for a tile value
   * @param {number} tileValue - The tile value from map data
   * @returns {string} - Texture key
   * @private
   */
  getTileTextureKey(tileValue) {
    return `tile_${tileValue}`;
  }
  
  /**
   * Update tile appearance with color and shape if texture not available
   * @param {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle} sprite - The sprite/shape to update
   * @param {number} tileValue - The tile value from map data
   * @private 
   */
  updateTileAppearance(sprite, tileValue) {
    // Skip if sprite isn't a game object with setFillStyle
    if (!sprite.setFillStyle) return;
    
    // Determine color based on tile value
    let color;
    if (tileValue === 0) {
      // Floor
      color = 0x333333;
    } else if (tileValue > 0) {
      // Wall - vary slightly based on tile value for visual interest
      const baseColor = 0x666666;
      const variance = tileValue % 10;
      color = baseColor + (variance * 0x111111);
    } else {
      // Hole/pit
      color = 0x111111;
    }
    
    // Update fill color
    sprite.setFillStyle(color);
    
    // Ensure correct size
    sprite.width = this.tileSize;
    sprite.height = this.tileSize;
  }
  
  /**
   * Create a new floor sprite
   * @returns {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle} - New sprite
   * @private
   */
  createFloorSprite() {
    let sprite;
    
    // Try to use texture if it exists
    if (this.scene.textures.exists('tile_0') || this.scene.textures.exists('floor')) {
      const textureKey = this.scene.textures.exists('tile_0') ? 'tile_0' : 'floor';
      sprite = this.scene.add.sprite(0, 0, textureKey);
      sprite.setDisplaySize(this.tileSize, this.tileSize);
    } else {
      // Fallback to colored rectangle
      sprite = this.scene.add.rectangle(0, 0, this.tileSize, this.tileSize, 0x333333);
    }
    
    sprite.isNewlyCreated = true;
    return sprite;
  }
  
  /**
   * Create a new wall sprite
   * @returns {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle} - New sprite
   * @private
   */
  createWallSprite() {
    let sprite;
    
    // Try to use texture if it exists
    if (this.scene.textures.exists('tile_1') || this.scene.textures.exists('wall')) {
      const textureKey = this.scene.textures.exists('tile_1') ? 'tile_1' : 'wall';
      sprite = this.scene.add.sprite(0, 0, textureKey);
      sprite.setDisplaySize(this.tileSize, this.tileSize);
    } else {
      // Fallback to colored rectangle
      sprite = this.scene.add.rectangle(0, 0, this.tileSize, this.tileSize, 0x666666);
    }
    
    sprite.isNewlyCreated = true;
    return sprite;
  }
  
  /**
   * Create a new hole sprite
   * @returns {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle} - New sprite
   * @private
   */
  createHoleSprite() {
    let sprite;
    
    // Try to use texture if it exists
    if (this.scene.textures.exists('tile_-1') || this.scene.textures.exists('hole')) {
      const textureKey = this.scene.textures.exists('tile_-1') ? 'tile_-1' : 'hole';
      sprite = this.scene.add.sprite(0, 0, textureKey);
      sprite.setDisplaySize(this.tileSize, this.tileSize);
    } else {
      // Fallback to colored rectangle
      sprite = this.scene.add.rectangle(0, 0, this.tileSize, this.tileSize, 0x111111);
    }
    
    sprite.isNewlyCreated = true;
    return sprite;
  }
  
  /**
   * Create a generic sprite for any other tile type
   * @returns {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle} - New sprite
   * @private
   */
  createGenericSprite() {
    // Fallback to colored rectangle
    const sprite = this.scene.add.rectangle(0, 0, this.tileSize, this.tileSize, 0x555555);
    sprite.isNewlyCreated = true;
    return sprite;
  }
  
  /**
   * Release a sprite back to the pool
   * @param {Phaser.GameObjects.Sprite} sprite - Sprite to release
   */
  releaseSprite(sprite) {
    // Skip if sprite is already released
    if (!sprite || !sprite.visible) return;
    
    // Determine which pool to return to
    let pool;
    const tileValue = sprite.tileValue;
    
    if (tileValue === 0) {
      pool = this.spritePools.floor;
    } else if (tileValue > 0) {
      pool = this.spritePools.wall;
    } else if (tileValue < 0) {
      pool = this.spritePools.hole;
    } else {
      pool = this.spritePools.generic;
    }
    
    // Hide the sprite
    sprite.setVisible(false);
    
    // Return to pool
    pool.release(sprite);
    
    // Update stats
    this.stats.active--;
    this.stats.released++;
  }
  
  /**
   * Bulk release multiple sprites
   * @param {Array} sprites - Array of sprites to release
   */
  releaseSprites(sprites) {
    if (!sprites || !Array.isArray(sprites)) return;
    
    sprites.forEach(sprite => this.releaseSprite(sprite));
  }
  
  /**
   * Get the number of active sprites
   * @returns {number} - Count of active sprites
   */
  getActiveSpriteCount() {
    return this.stats.active;
  }
  
  /**
   * Get sprite usage statistics
   * @returns {Object} - Stats object
   */
  getStats() {
    // Get pool stats
    const poolStats = {
      floor: this.spritePools.floor ? this.spritePools.floor.getStats() : null,
      wall: this.spritePools.wall ? this.spritePools.wall.getStats() : null,
      hole: this.spritePools.hole ? this.spritePools.hole.getStats() : null,
      generic: this.spritePools.generic ? this.spritePools.generic.getStats() : null
    };
    
    return {
      ...this.stats,
      pools: poolStats
    };
  }
  
  /**
   * Destroy the factory and release all resources
   */
  destroy() {
    // Destroy all sprite pools
    for (const poolName in this.spritePools) {
      if (this.spritePools[poolName]) {
        this.spritePools[poolName].destroy();
        this.spritePools[poolName] = null;
      }
    }
    
    // Reset stats
    this.stats = {
      active: 0,
      created: 0,
      reused: 0,
      released: 0
    };
    
    this.initialized = false;
  }
}
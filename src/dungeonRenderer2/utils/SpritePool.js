// src/dungeonRenderer/utils/SpritePool.js

/**
 * SpritePool - Manages a pool of reusable sprite objects
 * Reduces garbage collection by reusing sprites instead of creating new ones
 */
export class SpritePool {
    /**
     * Create a new sprite pool
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {string} type - Type of sprites in this pool
     * @param {number} initialSize - Initial size of the pool
     */
    constructor(scene, type, initialSize = 0) {
      this.scene = scene;
      this.type = type;
      this.pool = [];
      this.createFunction = null;
      
      // Stats tracking
      this.stats = {
        created: 0,
        released: 0,
        active: 0
      };
      
      // Pre-populate if initial size is specified
      if (initialSize > 0) {
        // Defer creation until createFunction is set
        this.initialSize = initialSize;
      }
    }
    
    /**
     * Set the function used to create new sprites
     * @param {Function} createFunction - Function that returns a new sprite
     */
    setCreateFunction(createFunction) {
      this.createFunction = createFunction;
      
      // If we have a deferred initial size, create sprites now
      if (this.initialSize && this.initialSize > 0) {
        this.populate(this.initialSize);
        delete this.initialSize;
      }
    }
    
    /**
     * Populate the pool with a number of sprites
     * @param {number} count - Number of sprites to create
     */
    populate(count) {
      if (!this.createFunction) {
        console.error('Cannot populate pool: createFunction not set');
        return;
      }
      
      for (let i = 0; i < count; i++) {
        const sprite = this.createFunction();
        sprite.setVisible(false);
        this.pool.push(sprite);
        this.stats.created++;
      }
      
      if (this.debug) {
        console.log(`Populated ${this.type} pool with ${count} sprites`);
      }
    }
    
    /**
     * Get a sprite from the pool
     * @returns {Phaser.GameObjects.Sprite} - A sprite from the pool or a new one
     */
    get() {
      // Get from pool if available
      if (this.pool.length > 0) {
        const sprite = this.pool.pop();
        this.stats.active++;
        return sprite;
      }
      
      // Create new sprite if pool is empty
      if (this.createFunction) {
        const sprite = this.createFunction();
        this.stats.created++;
        this.stats.active++;
        return sprite;
      }
      
      // Fallback if no create function
      console.error(`Cannot get sprite from ${this.type} pool: createFunction not set`);
      return null;
    }
    
    /**
     * Release a sprite back to the pool
     * @param {Phaser.GameObjects.Sprite} sprite - The sprite to release
     */
    release(sprite) {
      if (!sprite) return;
      
      // Return to pool
      this.pool.push(sprite);
      this.stats.released++;
      this.stats.active--;
      
      // Make sure sprite is not visible
      sprite.setVisible(false);
      
      // Reset any properties or animations if needed
      if (sprite.anims && sprite.anims.isPlaying) {
        sprite.anims.stop();
      }
    }
    
    /**
     * Get the available count
     * @returns {number} - Number of sprites available in the pool
     */
    getAvailableCount() {
      return this.pool.length;
    }
    
    /**
     * Get usage statistics
     * @returns {Object} - Stats object
     */
    getStats() {
      return {
        ...this.stats,
        available: this.pool.length
      };
    }
    
    /**
     * Clear the pool and destroy all sprites
     */
    clear() {
      // Destroy all sprites in the pool
      this.pool.forEach(sprite => {
        if (sprite && sprite.destroy) {
          sprite.destroy();
        }
      });
      
      // Clear the pool
      this.pool = [];
      
      // Reset stats
      this.stats.created = 0;
      this.stats.released = 0;
      this.stats.active = 0;
    }
    
    /**
     * Destroy the pool and all resources
     */
    destroy() {
      this.clear();
      this.createFunction = null;
    }
  }
// src/dungeonRenderer/textures/TextureRegistry.js

/**
 * TextureRegistry - Maps tile values to textures and manages texture loading
 * Provides a central registry for all tile textures
 */
export class TextureRegistry {
    /**
     * Create a new TextureRegistry
     * @param {Phaser.Scene} scene - The Phaser scene to use for textures
     */
    constructor(scene) {
      this.scene = scene;
      this.textures = new Map();
      this.isLoaded = false;
      this.tileSize = 64;
      this.debug = false;
      
      // Define default texture mappings based on tile values
      this.textureMapping = {
        // Basic types
        "-2": { key: "tile_hole_deep", file: "assets/tiles/hole_deep.png" },
        "-1": { key: "tile_hole", file: "assets/tiles/hole.png" },
        "0": { key: "tile_floor", file: "assets/tiles/floor.png" },
        
        // Wall variations (numeric keys must be strings)
        "1": { key: "tile_wall_n", file: "assets/tiles/wall_n.png" },
        "2": { key: "tile_wall_w", file: "assets/tiles/wall_w.png" },
        "3": { key: "tile_wall_nw", file: "assets/tiles/wall_nw.png" },
        
        // Add more mappings as needed
        "46": { key: "tile_wall_full", file: "assets/tiles/wall_full.png" },
        "47": { key: "tile_wall_isolated", file: "assets/tiles/wall_isolated.png" }
      };
      
      // Define fallback colors for when textures aren't available
      this.fallbackColors = {
        "floor": 0x333333,
        "wall": 0x666666,
        "hole": 0x111111,
        "special": 0x444444
      };
    }
    
    /**
     * Initialize the texture registry
     * @param {Object} options - Configuration options
     * @returns {TextureRegistry} - This instance for chaining
     */
    init(options = {}) {
      this.tileSize = options.tileSize || this.tileSize;
      this.debug = options.debug || false;
      
      // Load texture mappings from options if provided
      if (options.textureMapping) {
        this.textureMapping = { ...this.textureMapping, ...options.textureMapping };
      }
      
      // Load fallback colors from options if provided
      if (options.fallbackColors) {
        this.fallbackColors = { ...this.fallbackColors, ...options.fallbackColors };
      }
      
      // Generate procedural textures on first load
      this.generateProceduralTextures();
      
      return this;
    }
    
    /**
     * Generate procedural textures for basic tile types
     * These are used as fallbacks when texture files aren't available
     */
    generateProceduralTextures() {
      // Only generate if not already loaded
      if (this.isLoaded) return;
      
      this.generateFloorTexture();
      this.generateWallTexture();
      this.generateHoleTexture();
      
      this.isLoaded = true;
      
      if (this.debug) {
        console.log('Generated procedural textures for tiles');
      }
    }
    
    /**
     * Generate a procedural floor texture
     * @private
     */
    generateFloorTexture() {
      // Skip if texture already exists
      if (this.scene.textures.exists('tile_floor')) return;
      
      // Create a canvas for the floor texture
      const key = 'tile_floor';
      const size = this.tileSize;
      
      const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
      
      // Draw floor background
      graphics.fillStyle(this.fallbackColors.floor);
      graphics.fillRect(0, 0, size, size);
      
      // Add some noise/texture to floor
      graphics.fillStyle(0x2a2a2a);
      const noiseCount = Math.floor(size / 8);
      for (let i = 0; i < noiseCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const dotSize = 1 + Math.random() * 2;
        graphics.fillRect(x, y, dotSize, dotSize);
      }
      
      // Add subtle grid lines
      graphics.lineStyle(1, 0x222222, 0.3);
      graphics.strokeRect(0, 0, size, size);
      
      // Generate texture
      graphics.generateTexture(key, size, size);
      graphics.destroy();
      
      // Register in our mapping
      this.textures.set('0', key);
    }
    
    /**
     * Generate a procedural wall texture
     * @private
     */
    generateWallTexture() {
      // Skip if texture already exists
      if (this.scene.textures.exists('tile_wall')) return;
      
      // Create a canvas for the wall texture
      const key = 'tile_wall';
      const size = this.tileSize;
      
      const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
      
      // Draw wall background
      graphics.fillStyle(this.fallbackColors.wall);
      graphics.fillRect(0, 0, size, size);
      
      // Add some texture to wall
      graphics.fillStyle(0x777777);
      
      // Draw brick pattern
      const brickWidth = size / 4;
      const brickHeight = size / 6;
      const mortar = 2; // Mortar thickness
      
      // First row is offset
      for (let x = 0; x < size; x += brickWidth) {
        for (let y = 0; y < size; y += brickHeight) {
          // Offset every other row
          const offset = (Math.floor(y / brickHeight) % 2) ? brickWidth / 2 : 0;
          
          graphics.fillStyle(0x555555);
          graphics.fillRect(
            x + offset + mortar/2, 
            y + mortar/2, 
            brickWidth - mortar, 
            brickHeight - mortar
          );
        }
      }
      
      // Add highlight
      graphics.lineStyle(2, 0x777777, 0.5);
      graphics.strokeRect(2, 2, size - 4, size - 4);
      
      // Generate texture
      graphics.generateTexture(key, size, size);
      graphics.destroy();
      
      // Register in our mapping
      this.textures.set('1', key); // Default wall texture
      this.textures.set('wall', key); // General wall texture
    }
    
    /**
     * Generate a procedural hole texture
     * @private
     */
    generateHoleTexture() {
      // Skip if texture already exists
      if (this.scene.textures.exists('tile_hole')) return;
      
      // Create a canvas for the hole texture
      const key = 'tile_hole';
      const size = this.tileSize;
      
      const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
      
      // Draw hole background
      graphics.fillStyle(this.fallbackColors.hole);
      graphics.fillRect(0, 0, size, size);
      
      // Add some depth to hole
      const gradient = graphics.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, 0x000000);
      gradient.addColorStop(1, 0x222222);
      
      graphics.fillStyle(gradient);
      graphics.fillRect(2, 2, size - 4, size - 4);
      
      // Generate texture
      graphics.generateTexture(key, size, size);
      graphics.destroy();
      
      // Register in our mapping
      this.textures.set('-1', key);
    }
    
    /**
     * Preload all textures defined in the mapping
     * @returns {Promise} - Resolves when all textures are loaded
     */
    async preloadTextures() {
      if (!this.scene.textures) {
        console.error('Scene textures system not available');
        return;
      }
      
      // Create a list of textures to load
      const texturesToLoad = [];
      
      for (const [tileValue, mapping] of Object.entries(this.textureMapping)) {
        // Skip if texture already exists
        if (this.scene.textures.exists(mapping.key)) continue;
        
        texturesToLoad.push({
          key: mapping.key,
          file: mapping.file
        });
      }
      
      // Skip if no textures to load
      if (texturesToLoad.length === 0) {
        if (this.debug) {
          console.log('No textures to preload');
        }
        return;
      }
      
      if (this.debug) {
        console.log(`Preloading ${texturesToLoad.length} textures`);
      }
      
      // Create a promise to track loading
      return new Promise((resolve, reject) => {
        // Add all textures to load queue
        texturesToLoad.forEach(texture => {
          this.scene.load.image(texture.key, texture.file);
        });
        
        // Set up load complete handler
        this.scene.load.once('complete', () => {
          // Update our mapping now that textures are loaded
          for (const [tileValue, mapping] of Object.entries(this.textureMapping)) {
            this.textures.set(tileValue, mapping.key);
          }
          
          if (this.debug) {
            console.log(`Loaded ${texturesToLoad.length} textures`);
          }
          
          resolve();
        });
        
        // Set up error handler
        this.scene.load.once('loaderror', (fileObj) => {
          console.error(`Error loading texture: ${fileObj.src}`);
          reject(new Error(`Failed to load texture: ${fileObj.src}`));
        });
        
        // Start loading
        this.scene.load.start();
      });
    }
    
    /**
     * Get texture key for a specific tile value
     * @param {number} tileValue - Tile value from map data
     * @returns {string|null} - Texture key or null if not found
     */
    getTextureKey(tileValue) {
      // Convert to string for map lookup
      const tileValueStr = String(tileValue);
      
      // Check if we have a direct mapping
      if (this.textures.has(tileValueStr)) {
        return this.textures.get(tileValueStr);
      }
      
      // Determine texture type based on tile value
      let textureType;
      if (tileValue === 0) {
        textureType = 'floor';
      } else if (tileValue > 0) {
        textureType = 'wall';
      } else {
        textureType = 'hole';
      }
      
      // Check if we have a generic texture for this type
      if (this.textures.has(textureType)) {
        return this.textures.get(textureType);
      }
      
      // Generate a texture key based on tile value
      return `tile_${tileValue}`;
    }
    
    /**
     * Get fallback color for a specific tile value
     * @param {number} tileValue - Tile value from map data
     * @returns {number} - Color value
     */
    getFallbackColor(tileValue) {
      if (tileValue === 0) {
        return this.fallbackColors.floor;
      } else if (tileValue > 0) {
        return this.fallbackColors.wall;
      } else if (tileValue < 0) {
        return this.fallbackColors.hole;
      }
      return this.fallbackColors.special;
    }
    
    /**
     * Check if a texture exists for a specific tile value
     * @param {number} tileValue - Tile value from map data
     * @returns {boolean} - True if texture exists
     */
    hasTexture(tileValue) {
      const key = this.getTextureKey(tileValue);
      return this.scene.textures.exists(key);
    }
    
    /**
     * Get a list of all registered textures
     * @returns {Array} - Array of texture keys
     */
    getTextureList() {
      return Array.from(this.textures.values());
    }
    
    /**
     * Destroy the texture registry and clean up resources
     */
    destroy() {
      this.textures.clear();
      this.isLoaded = false;
    }
  }
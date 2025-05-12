// src/dungeonRenderer/utils/TextureCache.js
/**
 * TextureCache - Manages creation and reuse of textures
 * Optimizes performance by avoiding duplicate texture creation
 */
export class TextureCache {
  constructor(scene) {
    this.scene = scene;
    this.cache = new Map();

    // Define tile textures mapping - connects tile values to asset paths
    this.tileTextureKeys = {
      // Basic types
      "-2": "tile_hole", // Deep hole
      "-1": "tile_edge", // Edge
      0: "tile_floor", // Floor

      // Wall types
      1: "tile_wall",
      46: "tile_wall_full", // Full solid wall
    };

    // Define prop texture mapping
    this.propTextureKeys = {
      3: "chest",
      12: "torch",
      21: "ladder",
    };
  }

  /**
   * Get a texture for a tile value
   * @param {number} tileValue - Tile value from map data
   * @param {number} tileSize - Size of tiles in pixels
   * @returns {Object} - Texture object
   */
  getTileTexture(tileValue, tileSize) {
    // Generate cache key
    const cacheKey = `tile_${tileValue}_${tileSize}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Get the texture key for this tile value
    let textureKey = this.tileTextureKeys[tileValue];

    // If no specific mapping, use generic wall/floor
    if (!textureKey) {
      if (tileValue > 0) {
        textureKey = "tile_wall"; // Default wall texture
      } else if (tileValue < 0) {
        textureKey = "tile_hole"; // Default hole texture
      } else {
        textureKey = "tile_floor"; // Default floor texture
      }
    }

    let texture;

    // Try to use the texture if it exists
    if (this.scene.textures.exists(textureKey)) {
      texture = this.scene.make.image({
        x: 0,
        y: 0,
        key: textureKey,
        add: false,
      });
      texture.displayWidth = tileSize;
      texture.displayHeight = tileSize;
    } else {
      // Create a colored rectangle as fallback
      let color;

      if (tileValue > 0) {
        // Wall color based on type
        if (tileValue === 46) {
          color = 0x444444; // Full wall
        } else {
          color = 0x666666; // Regular wall
        }
      } else if (tileValue < 0) {
        color = 0x111111; // Hole
      } else {
        color = 0x333333; // Floor
      }

      // Create a graphics texture
      const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(color);
      graphics.fillRect(0, 0, tileSize, tileSize);

      // Add some texture to walls and floors
      if (tileValue > 0) {
        // Wall texture
        graphics.fillStyle(color - 0x111111);
        graphics.fillRect(2, 2, tileSize - 4, tileSize - 4);
        graphics.lineStyle(1, color + 0x111111);
        graphics.strokeRect(1, 1, tileSize - 2, tileSize - 2);
      } else if (tileValue === 0) {
        // Floor texture - add some noise
        graphics.fillStyle(0x222222);

        // Random dots
        for (let i = 0; i < 5; i++) {
          const x = Math.random() * tileSize;
          const y = Math.random() * tileSize;
          const size = 1 + Math.random() * 3;
          graphics.fillRect(x, y, size, size);
        }
      }

      texture = graphics;
    }

    // Cache for reuse
    this.cache.set(cacheKey, texture);

    return texture;
  }

  /**
   * Get a texture for a prop
   * @param {number} propValue - Prop value from map data
   * @param {number} tileSize - Size of tiles in pixels
   * @returns {Object} - Texture object
   */
  getPropTexture(propValue, tileSize) {
    // Generate cache key
    const cacheKey = `prop_${propValue}_${tileSize}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Get the texture key for this prop value
    let textureKey = this.propTextureKeys[propValue];
    let texture;

    // Try to use the texture if it exists
    if (textureKey && this.scene.textures.exists(textureKey)) {
      texture = this.scene.make.image({
        x: 0,
        y: 0,
        key: textureKey,
        add: false,
      });

      // Size depends on prop type
      switch (textureKey) {
        case "torch":
          texture.displayWidth = tileSize * 0.8;
          texture.displayHeight = tileSize * 0.8;
          break;
        case "chest":
          texture.displayWidth = tileSize * 0.7;
          texture.displayHeight = tileSize * 0.5;
          break;
        case "ladder":
          texture.displayWidth = tileSize * 0.8;
          texture.displayHeight = tileSize * 0.8;
          break;
        default:
          texture.displayWidth = tileSize * 0.5;
          texture.displayHeight = tileSize * 0.5;
      }
    } else {
      // Create a prop graphic as fallback
      texture = this.createPropGraphic(propValue, tileSize);
    }

    // Cache for reuse
    this.cache.set(cacheKey, texture);

    return texture;
  }

  /**
   * Create a graphics object for a prop
   * @param {number} propValue - Prop value from map data
   * @param {number} tileSize - Size of tiles in pixels
   * @returns {Phaser.GameObjects.Graphics} - Graphics object
   */
  createPropGraphic(propValue, tileSize) {
    const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });

    // Determine color based on prop value
    let color = 0xffffff;

    switch (propValue) {
      case 3: // Chest
        color = 0xaa8800;
        graphics.fillStyle(color);
        graphics.fillRect(
          -tileSize * 0.35,
          -tileSize * 0.25,
          tileSize * 0.7,
          tileSize * 0.5
        );
        graphics.lineStyle(2, 0xddaa00);
        graphics.strokeRect(
          -tileSize * 0.35,
          -tileSize * 0.25,
          tileSize * 0.7,
          tileSize * 0.5
        );
        graphics.fillStyle(0xffcc00);
        graphics.fillRect(
          -tileSize * 0.1,
          -tileSize * 0.25,
          tileSize * 0.2,
          tileSize * 0.15
        );
        break;

      case 12: // Torch
        color = 0xff9900;
        // Torch base
        graphics.fillStyle(0x553300);
        graphics.fillRect(-tileSize * 0.1, 0, tileSize * 0.2, tileSize * 0.4);

        // Flame
        graphics.fillStyle(color);
        graphics.beginPath();
        graphics.moveTo(-tileSize * 0.2, 0);
        graphics.lineTo(0, -tileSize * 0.4);
        graphics.lineTo(tileSize * 0.2, 0);
        graphics.closePath();
        graphics.fill();

        // Highlight
        graphics.fillStyle(0xffcc00);
        graphics.beginPath();
        graphics.moveTo(-tileSize * 0.1, 0);
        graphics.lineTo(0, -tileSize * 0.3);
        graphics.lineTo(tileSize * 0.1, 0);
        graphics.closePath();
        graphics.fill();
        break;

      case 21: // Ladder
        color = 0xdddddd;
        // Sides
        graphics.fillStyle(color);
        graphics.fillRect(
          -tileSize * 0.25,
          -tileSize * 0.4,
          tileSize * 0.1,
          tileSize * 0.8
        );
        graphics.fillRect(
          tileSize * 0.15,
          -tileSize * 0.4,
          tileSize * 0.1,
          tileSize * 0.8
        );

        // Rungs
        for (let i = 0; i < 5; i++) {
          graphics.fillRect(
            -tileSize * 0.25,
            -tileSize * 0.4 + i * ((tileSize * 0.8) / 4),
            tileSize * 0.5,
            tileSize * 0.05
          );
        }
        break;

      default:
        // Generic prop as a square
        color = 0xaaaaaa;
        graphics.fillStyle(color);
        graphics.fillRect(
          -tileSize * 0.25,
          -tileSize * 0.25,
          tileSize * 0.5,
          tileSize * 0.5
        );
    }

    return graphics;
  }

  /**
   * Get a texture for a monster
   * @param {number} monsterValue - Monster value from map data
   * @param {number} tileSize - Size of tiles in pixels
   * @returns {Object} - Texture object
   */
  getMonsterTexture(monsterValue, tileSize) {
    // Generate cache key
    const cacheKey = `monster_${monsterValue}_${tileSize}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Generate texture key
    const textureKey = `monster_${monsterValue}`;
    let texture;

    // Try to use a texture if it exists
    if (this.scene.textures.exists(textureKey)) {
      texture = this.scene.make.image({
        x: 0,
        y: 0,
        key: textureKey,
        add: false,
      });
      texture.displayWidth = tileSize * 0.8;
      texture.displayHeight = tileSize * 0.8;
    } else {
      // Monster colors for different types
      const monsterColors = [
        0xff0000, // 1 - Red
        0x00ff00, // 2 - Green
        0x0000ff, // 3 - Blue
        0xff00ff, // 4 - Purple
        0x00ffff, // 5 - Cyan
        0xffff00, // 6 - Yellow
        0xff8800, // 7 - Orange
        0x88ff00, // 8 - Lime
      ];

      // Get color based on monster type
      const monsterColor =
        monsterColors[(monsterValue - 1) % monsterColors.length] || 0xff0000;

      // Create monster graphic
      const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });

      // Draw different shapes based on monster type
      switch (monsterValue) {
        case 1: // Simple circle monster
          graphics.fillStyle(monsterColor);
          graphics.fillCircle(0, 0, tileSize / 3);
          graphics.lineStyle(2, 0xffffff, 0.5);
          graphics.strokeCircle(0, 0, tileSize / 3);
          break;

        case 2: // Square monster
          graphics.fillStyle(monsterColor);
          graphics.fillRect(
            -tileSize / 3,
            -tileSize / 3,
            (tileSize * 2) / 3,
            (tileSize * 2) / 3
          );
          graphics.lineStyle(2, 0xffffff, 0.5);
          graphics.strokeRect(
            -tileSize / 3,
            -tileSize / 3,
            (tileSize * 2) / 3,
            (tileSize * 2) / 3
          );
          break;

        case 3: // Triangle monster
          graphics.fillStyle(monsterColor);
          graphics.beginPath();
          graphics.moveTo(0, -tileSize / 3);
          graphics.lineTo(-tileSize / 3, tileSize / 3);
          graphics.lineTo(tileSize / 3, tileSize / 3);
          graphics.closePath();
          graphics.fill();
          graphics.lineStyle(2, 0xffffff, 0.5);
          graphics.strokePath();
          break;

        default: // Default circle with different size
          graphics.fillStyle(monsterColor);
          graphics.fillCircle(0, 0, tileSize / 3);

          // Add some decoration based on type
          if (monsterValue % 3 === 0) {
            // Eyes
            graphics.fillStyle(0xffffff);
            graphics.fillCircle(-tileSize / 8, -tileSize / 8, tileSize / 12);
            graphics.fillCircle(tileSize / 8, -tileSize / 8, tileSize / 12);

            graphics.fillStyle(0x000000);
            graphics.fillCircle(-tileSize / 8, -tileSize / 8, tileSize / 20);
            graphics.fillCircle(tileSize / 8, -tileSize / 8, tileSize / 20);
          } else {
            // Simple outline
            graphics.lineStyle(2, 0xffffff, 0.5);
            graphics.strokeCircle(0, 0, tileSize / 3);
          }
      }

      texture = graphics;
    }

    // Cache for reuse
    this.cache.set(cacheKey, texture);

    return texture;
  }

  /**
   * Create and cache background texture
   * @param {number} width - Width of background
   * @param {number} height - Height of background
   * @returns {Phaser.GameObjects.Graphics} - Graphics object for background
   */
  getBackgroundTexture(width, height) {
    const cacheKey = `background_${width}_${height}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Create background
    const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x444444);
    graphics.fillRect(0, 0, width, height);

    // Add some texture to the background
    graphics.fillStyle(0x333333);

    // Add a subtle grid pattern
    const gridSize = 64;
    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        if ((x / gridSize + y / gridSize) % 2 === 0) {
          graphics.fillRect(x, y, gridSize, gridSize);
        }
      }
    }

    // Cache for reuse
    this.cache.set(cacheKey, graphics);

    return graphics;
  }

  /**
   * Generate custom textures if they don't exist
   * Should be called during preload
   * @param {number} tileSize - Size of tiles in pixels
   */
  generateTextures(tileSize) {
    // Generate floor texture
    if (!this.scene.textures.exists("tile_floor")) {
      const floor = this.scene.make.graphics({ x: 0, y: 0, add: false });
      floor.fillStyle(0x333333);
      floor.fillRect(0, 0, tileSize, tileSize);
      floor.strokeStyle(0x222222);
      floor.lineStyle(1, 0x222222);
      floor.strokeRect(0, 0, tileSize, tileSize);

      // Add some noise
      floor.fillStyle(0x2a2a2a);
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * tileSize;
        const y = Math.random() * tileSize;
        const size = 1 + Math.random() * 3;
        floor.fillRect(x, y, size, size);
      }

      floor.generateTexture("tile_floor", tileSize, tileSize);
      floor.destroy();
    }

    // Generate wall texture
    if (!this.scene.textures.exists("tile_wall")) {
      const wall = this.scene.make.graphics({ x: 0, y: 0, add: false });
      wall.fillStyle(0x666666);
      wall.fillRect(0, 0, tileSize, tileSize);

      // Add some texture to walls
      wall.fillStyle(0x555555);
      wall.fillRect(4, 4, tileSize - 8, tileSize - 8);
      wall.lineStyle(2, 0x777777);
      wall.strokeRect(2, 2, tileSize - 4, tileSize - 4);

      wall.generateTexture("tile_wall", tileSize, tileSize);
      wall.destroy();
    }

    // Generate hole texture
    if (!this.scene.textures.exists("tile_hole")) {
      const hole = this.scene.make.graphics({ x: 0, y: 0, add: false });
      hole.fillStyle(0x111111);
      hole.fillRect(0, 0, tileSize, tileSize);

      // Add depth effect
      const gradient = hole.createLinearGradient(0, 0, tileSize, tileSize);
      gradient.addColorStop(0, 0x000000);
      gradient.addColorStop(1, 0x222222);

      hole.fillStyle(gradient);
      hole.fillRect(2, 2, tileSize - 4, tileSize - 4);

      hole.generateTexture("tile_hole", tileSize, tileSize);
      hole.destroy();
    }
  }

  /**
   * Clear the texture cache
   */
  clear() {
    // Destroy all cached textures
    this.cache.forEach((texture) => {
      if (texture && texture.destroy) {
        texture.destroy();
      }
    });

    // Clear the cache
    this.cache.clear();
  }
}

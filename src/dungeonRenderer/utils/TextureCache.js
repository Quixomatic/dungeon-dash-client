// src/dungeonRenderer/utils/TextureCache.js
/**
 * TextureCache - Manages creation and reuse of textures
 * Optimizes performance by avoiding duplicate texture creation
 */
export class TextureCache {
  constructor(scene) {
    this.scene = scene;
    this.cache = new Map();

    // Define tile textures mapping - this maps numeric tile values to specific PNG files
    this.tileTextures = {
      // Basic types
      "-2": "assets/tiles/hole.png", // Deep hole
      "-1": "assets/tiles/edge.png", // Edge
      0: "assets/tiles/ground.png", // Floor

      // Wall configurations - EXACT mapping based on your existing logic
      1: "assets/tiles/s.png", // Simple walls, orientations
      2: "assets/tiles/s.png",
      3: "assets/tiles/s.png",
      4: "assets/tiles/s.png",
      5: "assets/tiles/s.png",
      6: "assets/tiles/s.png",
      7: "assets/tiles/s.png",
      8: "assets/tiles/s.png",
      9: "assets/tiles/s.png",
      10: "assets/tiles/s.png",
      11: "assets/tiles/s.png",
      12: "assets/tiles/s.png",

      // Horizontal walls
      13: "assets/tiles/w-e.png",
      14: "assets/tiles/w-e.png",
      15: "assets/tiles/w-e.png",
      16: "assets/tiles/w-e.png",
      17: "assets/tiles/w-e.png",
      18: "assets/tiles/w-e.png",
      19: "assets/tiles/w-e.png",
      20: "assets/tiles/w-e.png",
      21: "assets/tiles/w-e.png",
      22: "assets/tiles/w-e.png",
      23: "assets/tiles/w-e.png",
      24: "assets/tiles/w-e.png",
      25: "assets/tiles/w-e.png",

      // East corner walls
      26: "assets/tiles/n-ne-e.png",
      27: "assets/tiles/n-ne-e.png",
      28: "assets/tiles/e.png",
      29: "assets/tiles/n-ne-e.png",
      30: "assets/tiles/n-ne-e.png",
      31: "assets/tiles/e.png",
      32: "assets/tiles/n-ne-e.png",
      33: "assets/tiles/e.png",

      // West corner walls
      34: "assets/tiles/n-nw-w.png",
      35: "assets/tiles/n-nw-w.png",
      36: "assets/tiles/w.png",
      37: "assets/tiles/n-nw-w.png",
      38: "assets/tiles/n-nw-w.png",
      39: "assets/tiles/n-nw-w.png",
      40: "assets/tiles/w.png",
      41: "assets/tiles/w.png",

      // North walls and corners
      42: "assets/tiles/n.png",
      43: "assets/tiles/n.png",
      44: "assets/tiles/ne.png",
      45: "assets/tiles/nw.png",

      // Special cases
      46: "assets/tiles/all.png", // Full solid wall
      47: "assets/tiles/s.png", // Isolated wall
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
    const textureKey = `tile_${tileValue}`;
    let texture;

    // Try to use an existing texture if it exists
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
      // Get the correct PNG path for this specific tile value
      const pngPath = this.tileTextures[tileValue];

      if (pngPath && !this.scene.textures.exists(textureKey)) {
        // If the texture isn't loaded yet, create a fallback and queue the load
        this.scene.load.image(textureKey, pngPath);
        this.scene.load.once("complete", () => {
          // When loaded, clear the cache entry so it's recreated next time
          this.cache.delete(cacheKey);
        });
        // Start loading - this will happen asynchronously
        this.scene.load.start();

        // Create a temporary texture until the real one loads
        texture = this.createTemporaryTileTexture(tileValue, tileSize);
      } else {
        // Create a fallback texture
        texture = this.createFallbackTileTexture(tileValue, tileSize);
      }
    }

    // Cache for reuse
    this.cache.set(cacheKey, texture);

    return texture;
  }

  /**
   * Create a temporary texture while the real one loads
   * @param {number} tileValue - Tile value
   * @param {number} tileSize - Size of tiles in pixels
   * @returns {Phaser.GameObjects.Graphics} - Graphics object as temporary texture
   */
  createTemporaryTileTexture(tileValue, tileSize) {
    const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });

    // Choose color based on tile type
    let color;
    if (tileValue > 0) {
      // Wall colors - slightly different shades based on type
      if (tileValue <= 12) color = 0x666666; // Simple walls
      else if (tileValue <= 25) color = 0x777777; // Horizontal walls
      else if (tileValue <= 33) color = 0x888888; // East corner walls
      else if (tileValue <= 41) color = 0x999999; // West corner walls
      else if (tileValue <= 45) color = 0xaaaaaa; // North walls
      else color = 0x555555; // Special cases
    } else if (tileValue < 0) {
      color = 0x111111; // Hole
    } else {
      color = 0x333333; // Floor
    }

    // Draw a simple colored rectangle
    graphics.fillStyle(color);
    graphics.fillRect(0, 0, tileSize, tileSize);

    // Add a border for walls
    if (tileValue > 0) {
      graphics.lineStyle(1, 0x000000, 0.5);
      graphics.strokeRect(0, 0, tileSize, tileSize);
    }

    return graphics;
  }

  /**
   * Create a fallback texture for unknown tile values
   * @param {number} tileValue - Tile value
   * @param {number} tileSize - Size of tiles in pixels
   * @returns {Phaser.GameObjects.Graphics} - Graphics object as fallback texture
   */
  createFallbackTileTexture(tileValue, tileSize) {
    const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });

    // Choose color based on generalized tile type
    let color;
    if (tileValue > 0) {
      color = 0x666666; // Wall
    } else if (tileValue < 0) {
      color = 0x111111; // Hole
    } else {
      color = 0x333333; // Floor
    }

    // Draw a simple colored rectangle
    graphics.fillStyle(color);
    graphics.fillRect(0, 0, tileSize, tileSize);

    // Add tile value as text for debugging
    const textColor = tileValue > 0 ? 0xffffff : 0xaaaaaa;
    const textGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    textGraphics.fillStyle(textColor);

    // Create a minimal digit representation
    const digits = tileValue.toString();
    const digitSize = Math.min(tileSize / 4, 8);
    const startX = tileSize / 2 - (digits.length * digitSize) / 2;

    for (let i = 0; i < digits.length; i++) {
      const digit = parseInt(digits[i]);
      const x = startX + i * digitSize;
      const y = tileSize / 2 - digitSize / 2;

      switch (digit) {
        case 0:
          textGraphics.fillRect(x, y, digitSize, digitSize);
          break;
        case 1:
          textGraphics.fillRect(x + digitSize / 2, y, digitSize / 4, digitSize);
          break;
        case 2:
          textGraphics.fillRect(x, y, digitSize, digitSize / 4);
          textGraphics.fillRect(
            x + digitSize - digitSize / 4,
            y,
            digitSize / 4,
            digitSize / 2
          );
          textGraphics.fillRect(x, y + digitSize / 2, digitSize, digitSize / 4);
          textGraphics.fillRect(
            x,
            y + digitSize / 2,
            digitSize / 4,
            digitSize / 2
          );
          textGraphics.fillRect(
            x,
            y + digitSize - digitSize / 4,
            digitSize,
            digitSize / 4
          );
          break;
        // Add other digits if needed
        default:
          textGraphics.fillRect(x, y, digitSize / 2, digitSize);
      }
    }

    graphics.draw(textGraphics);
    textGraphics.destroy();

    return graphics;
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

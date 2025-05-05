// src/systems/CollisionSystem.js
export class CollisionSystem {
    constructor(scene) {
      this.scene = scene;
      this.collisionMap = null;
      this.tileSize = 64; // Default, will be updated with map data
      this.debug = false;
      this.debugGraphics = null;
      
      // Player collision settings
      this.playerRadius = 20; // Collision circle radius in pixels
      this.bufferZone = 2; // Small buffer to prevent wall hugging
      
      // Initialize debug visualization if in debug mode
      if (this.debug) {
        this.debugGraphics = scene.add.graphics();
        this.debugGraphics.setDepth(1000);
      }
    }
    
    /**
     * Initialize collision map from map data
     * @param {Object} mapData - Map data from server
     */
    initCollisionMap(mapData) {
      if (!mapData || !mapData.layers || !mapData.layers.tiles) {
        console.error("Invalid map data for collision map");
        return;
      }
      
      const tilesLayer = mapData.layers.tiles;
      this.tileSize = mapData.tileSize || 64;
      
      // Create a collision map the same size as the tile map
      this.collisionMap = [];
      
      for (let y = 0; y < tilesLayer.length; y++) {
        this.collisionMap[y] = [];
        
        for (let x = 0; x < tilesLayer[y].length; x++) {
          // Any tile value > 0 is considered a wall (collision)
          this.collisionMap[y][x] = tilesLayer[y][x] > 0;
        }
      }
      
      console.log(`Collision map initialized: ${this.collisionMap.length}x${this.collisionMap[0].length}`);
      
      // Draw collision map in debug mode
      if (this.debug) {
        this.drawCollisionMap();
      }
    }
    
    /**
     * Check if a position collides with a wall
     * @param {number} x - World X position to check
     * @param {number} y - World Y position to check
     * @param {number} radius - Collision radius (defaults to player radius)
     * @returns {boolean} - True if the position collides
     */
    checkCollision(x, y, radius = this.playerRadius) {
      if (!this.collisionMap) return false;
      
      // Calculate adjusted radius with buffer zone
      const effectiveRadius = radius + this.bufferZone;
      
      // Check collision at multiple points around the circle
      // This is more accurate than just checking the center
      const collisionPoints = [
        { x: x, y: y - effectiveRadius }, // Top
        { x: x + effectiveRadius, y: y }, // Right
        { x: x, y: y + effectiveRadius }, // Bottom
        { x: x - effectiveRadius, y: y }, // Left
        { x: x + 0.7 * effectiveRadius, y: y - 0.7 * effectiveRadius }, // Top-right
        { x: x + 0.7 * effectiveRadius, y: y + 0.7 * effectiveRadius }, // Bottom-right
        { x: x - 0.7 * effectiveRadius, y: y + 0.7 * effectiveRadius }, // Bottom-left
        { x: x - 0.7 * effectiveRadius, y: y - 0.7 * effectiveRadius }  // Top-left
      ];
      
      // Check each collision point
      for (const point of collisionPoints) {
        const tileX = Math.floor(point.x / this.tileSize);
        const tileY = Math.floor(point.y / this.tileSize);
        
        // Check if tile coordinates are within bounds
        if (tileX < 0 || tileX >= this.collisionMap[0].length || 
            tileY < 0 || tileY >= this.collisionMap.length) {
          return true; // Collide with map boundaries
        }
        
        // Check if tile is a wall
        if (this.collisionMap[tileY][tileX]) {
          return true;
        }
      }
      
      return false; // No collision detected
    }
    
    /**
     * Calculate a valid position with sliding along walls
     * @param {number} startX - Starting X position
     * @param {number} startY - Starting Y position
     * @param {number} targetX - Target X position
     * @param {number} targetY - Target Y position
     * @param {number} radius - Collision radius
     * @returns {Object} - Valid position {x, y} after collision resolution
     */
    resolveCollision(startX, startY, targetX, targetY, radius = this.playerRadius) {
      // If no collision at target, return target directly
      if (!this.checkCollision(targetX, targetY, radius)) {
        return { x: targetX, y: targetY };
      }
      
      // Try to slide horizontally
      if (!this.checkCollision(targetX, startY, radius)) {
        return { x: targetX, y: startY };
      }
      
      // Try to slide vertically
      if (!this.checkCollision(startX, targetY, radius)) {
        return { x: startX, y: targetY };
      }
      
      // If both sliding directions fail, don't move
      return { x: startX, y: startY };
    }
    
    /**
     * Draw the collision map for debugging
     */
    drawCollisionMap() {
      if (!this.debugGraphics || !this.collisionMap) return;
      
      this.debugGraphics.clear();
      
      // Get camera view bounds
      const camera = this.scene.cameras.main;
      const bounds = {
        left: camera.scrollX,
        right: camera.scrollX + camera.width,
        top: camera.scrollY,
        bottom: camera.scrollY + camera.height
      };
      
      // Only draw tiles visible in the camera view
      const startTileX = Math.floor(bounds.left / this.tileSize);
      const endTileX = Math.ceil(bounds.right / this.tileSize);
      const startTileY = Math.floor(bounds.top / this.tileSize);
      const endTileY = Math.ceil(bounds.bottom / this.tileSize);
      
      // Draw collision tiles
      this.debugGraphics.lineStyle(1, 0xff0000, 0.5);
      
      for (let y = startTileY; y <= endTileY; y++) {
        for (let x = startTileX; x <= endTileX; x++) {
          // Skip tiles outside map bounds
          if (y < 0 || y >= this.collisionMap.length || 
              x < 0 || x >= this.collisionMap[0].length) {
            continue;
          }
          
          // Draw collision tiles
          if (this.collisionMap[y][x]) {
            this.debugGraphics.strokeRect(
              x * this.tileSize, 
              y * this.tileSize, 
              this.tileSize, 
              this.tileSize
            );
          }
        }
      }
    }
    
    /**
     * Update debug visualization
     * @param {number} playerX - Player X position
     * @param {number} playerY - Player Y position
     */
    updateDebug(playerX, playerY) {
      if (!this.debug || !this.debugGraphics) return;
      
      // Update collision map visualization
      this.drawCollisionMap();
      
      // Draw player collision circle
      this.debugGraphics.lineStyle(2, 0x00ff00, 1);
      this.debugGraphics.strokeCircle(playerX, playerY, this.playerRadius);
      
      // Draw collision points
      this.debugGraphics.fillStyle(0xff0000, 1);
      
      const points = [
        { x: playerX, y: playerY - this.playerRadius }, // Top
        { x: playerX + this.playerRadius, y: playerY }, // Right
        { x: playerX, y: playerY + this.playerRadius }, // Bottom
        { x: playerX - this.playerRadius, y: playerY }, // Left
        { x: playerX + 0.7 * this.playerRadius, y: playerY - 0.7 * this.playerRadius }, // Top-right
        { x: playerX + 0.7 * this.playerRadius, y: playerY + 0.7 * this.playerRadius }, // Bottom-right
        { x: playerX - 0.7 * this.playerRadius, y: playerY + 0.7 * this.playerRadius }, // Bottom-left
        { x: playerX - 0.7 * this.playerRadius, y: playerY - 0.7 * this.playerRadius }  // Top-left
      ];
      
      points.forEach(point => {
        this.debugGraphics.fillCircle(point.x, point.y, 3);
      });
    }
    
    /**
     * Toggle debug mode
     * @param {boolean} enabled - Whether debug should be enabled
     */
    setDebug(enabled) {
      this.debug = enabled;
      
      if (this.debug && !this.debugGraphics) {
        this.debugGraphics = this.scene.add.graphics();
        this.debugGraphics.setDepth(1000);
        this.drawCollisionMap();
      }
      
      if (this.debugGraphics) {
        this.debugGraphics.setVisible(this.debug);
      }
    }
  }
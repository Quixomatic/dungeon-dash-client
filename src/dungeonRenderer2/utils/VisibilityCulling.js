// src/dungeonRenderer/utils/VisibilityCulling.js

/**
 * VisibilityCulling - Determines what structures and tiles should be visible
 * Provides efficient culling based on camera position
 */
export class VisibilityCulling {
    constructor() {
      this.debug = false;
      this.lastUpdate = 0;
      this.updateThreshold = {
        distance: 64,   // Pixel distance to trigger update
        time: 100       // Minimum ms between updates
      };
    }
    
    /**
     * Initialize the culling system
     * @param {Object} options - Configuration options
     * @returns {VisibilityCulling} - This instance for chaining
     */
    init(options = {}) {
      this.debug = options.debug || false;
      
      // Override default thresholds if provided
      if (options.updateThresholdDistance) {
        this.updateThreshold.distance = options.updateThresholdDistance;
      }
      
      if (options.updateThresholdTime) {
        this.updateThreshold.time = options.updateThresholdTime;
      }
      
      return this;
    }
    
    /**
     * Check if we should update visibility based on camera movement
     * @param {Phaser.Cameras.Scene2D.Camera} camera - Current camera
     * @param {Object} lastPosition - Last camera position
     * @returns {boolean} - True if visibility should be updated
     */
    shouldUpdateVisibility(camera, lastPosition) {
      const now = Date.now();
      
      // Always update if time threshold met
      const timeSinceLastUpdate = now - this.lastUpdate;
      if (timeSinceLastUpdate >= this.updateThreshold.time) {
        // Skip distance check if enough time has passed
        this.lastUpdate = now;
        return true;
      }
      
      // Calculate distance moved
      const dx = camera.scrollX - lastPosition.x;
      const dy = camera.scrollY - lastPosition.y;
      const distanceMoved = Math.sqrt(dx * dx + dy * dy);
      
      // If moved significantly, trigger update
      if (distanceMoved >= this.updateThreshold.distance) {
        this.lastUpdate = now;
        
        if (this.debug) {
          console.log(`Camera moved ${Math.round(distanceMoved)}px, updating visibility`);
        }
        
        return true;
      }
      
      return false;
    }
    
    /**
     * Check if a structure is visible in the camera view
     * @param {Object} structureBounds - Structure bounds in pixels
     * @param {Object} cameraBounds - Camera bounds in pixels
     * @param {number} buffer - Additional buffer in pixels
     * @returns {boolean} - True if the structure is visible
     */
    isStructureVisible(structureBounds, cameraBounds, buffer = 0) {
      // Add buffer to camera bounds
      const expandedBounds = {
        left: cameraBounds.left - buffer,
        right: cameraBounds.right + buffer,
        top: cameraBounds.top - buffer,
        bottom: cameraBounds.bottom + buffer
      };
      
      // Check if structure intersects with camera view
      return !(
        structureBounds.right < expandedBounds.left ||
        structureBounds.left > expandedBounds.right ||
        structureBounds.bottom < expandedBounds.top ||
        structureBounds.top > expandedBounds.bottom
      );
    }
    
    /**
     * Calculate visible tile bounds from camera view
     * @param {Phaser.Cameras.Scene2D.Camera} camera - Current camera
     * @param {number} tileSize - Size of tiles in pixels
     * @param {number} buffer - Additional buffer in tiles
     * @returns {Object} - Bounds of visible tiles in tile coordinates
     */
    getVisibleTileBounds(camera, tileSize, buffer = 2) {
      // Calculate bounds in tile coordinates
      const bounds = {
        left: Math.floor(camera.scrollX / tileSize) - buffer,
        right: Math.ceil((camera.scrollX + camera.width) / tileSize) + buffer,
        top: Math.floor(camera.scrollY / tileSize) - buffer,
        bottom: Math.ceil((camera.scrollY + camera.height) / tileSize) + buffer
      };
      
      // Ensure bounds aren't negative
      bounds.left = Math.max(0, bounds.left);
      bounds.top = Math.max(0, bounds.top);
      
      return bounds;
    }
    
    /**
     * Check if a specific tile is within visible bounds
     * @param {number} tileX - Tile X coordinate
     * @param {number} tileY - Tile Y coordinate
     * @param {Object} visibleBounds - Visible tile bounds
     * @returns {boolean} - True if the tile is visible
     */
    isTileVisible(tileX, tileY, visibleBounds) {
      return (
        tileX >= visibleBounds.left &&
        tileX <= visibleBounds.right &&
        tileY >= visibleBounds.top &&
        tileY <= visibleBounds.bottom
      );
    }
    
    /**
     * Calculate priority for loading a structure
     * @param {Object} structure - Structure object
     * @param {Object} playerPosition - Player position in pixels
     * @returns {number} - Priority score (lower is higher priority)
     */
    calculateStructurePriority(structure, playerPosition) {
      if (!structure || !structure.bounds) return Infinity;
      
      // Calculate structure center
      const centerX = (structure.bounds.x + structure.bounds.width / 2) * structure.tileSize;
      const centerY = (structure.bounds.y + structure.bounds.height / 2) * structure.tileSize;
      
      // Calculate distance to player
      const dx = centerX - playerPosition.x;
      const dy = centerY - playerPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate priority based on distance
      return distance;
    }
    
    /**
     * Sort structures by priority
     * @param {Array} structures - Array of structure objects
     * @param {Object} playerPosition - Player position in pixels
     * @returns {Array} - Sorted structures (highest priority first)
     */
    sortStructuresByPriority(structures, playerPosition) {
      return [...structures].sort((a, b) => {
        const priorityA = this.calculateStructurePriority(a, playerPosition);
        const priorityB = this.calculateStructurePriority(b, playerPosition);
        return priorityA - priorityB;
      });
    }
  }
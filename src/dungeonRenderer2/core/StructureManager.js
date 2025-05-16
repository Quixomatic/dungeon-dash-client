// src/dungeonRenderer/core/StructureManager.js
import { TileFactory } from './TileFactory';

/**
 * StructureManager - Manages dungeon structures (rooms, corridors, etc)
 * Handles visibility culling and rendering of structures
 */
export class StructureManager {
  /**
   * Create a new StructureManager
   * @param {Phaser.Scene} scene - The Phaser scene to render in
   * @param {TextureRegistry} textureRegistry - Texture registry for tile textures
   */
  constructor(scene, textureRegistry) {
    this.scene = scene;
    this.textureRegistry = textureRegistry;
    this.tileFactory = new TileFactory(scene, textureRegistry);
    
    // Core properties
    this.tileSize = 64;
    this.structures = {};  // Map of structure id -> structure data
    this.visibilityCounts = {
      total: 0,
      visible: 0,
      rooms: 0,
      corridors: 0,
      spawnRooms: 0
    };
    
    // Visibility tracking
    this.visibleStructures = new Set();
    this.previouslyVisibleStructures = new Set();
    this.visibilityBuffer = 5;  // Additional tiles around camera to keep visible
    
    // Container to hold all structures
    this.container = scene.add.container(0, 0);
    
    // Debug settings
    this.debug = false;
  }
  
  /**
   * Initialize the structure manager
   * @param {Object} options - Configuration options
   * @returns {StructureManager} - This instance for chaining
   */
  init(options = {}) {
    this.tileSize = options.tileSize || this.tileSize;
    this.visibilityBuffer = options.visibilityBuffer || this.visibilityBuffer;
    this.debug = options.debug || false;
    
    // Initialize tile factory
    this.tileFactory.init({
      tileSize: this.tileSize,
      debug: this.debug
    });
    
    // Set container depth
    this.container.setDepth(10);
    
    return this;
  }
  
  /**
   * Preload a structure with tiles
   * @param {Object} structure - Structure definition from map data
   * @param {Object} mapData - Complete map data
   * @param {string} type - Type of structure ('room', 'corridor', 'spawnRoom')
   * @returns {Promise<void>}
   */
  async preloadStructure(structure, mapData, type) {
    // Generate structure ID
    const structureId = this.getStructureId(structure, type);
    
    // Skip if already loaded
    if (this.structures[structureId]) return;
    
    // Calculate bounds including buffer for seamless transitions
    const bounds = this.calculateExpandedBounds(structure);
    
    // Ensure bounds are within map limits
    this.clampBounds(bounds, mapData);
    
    // Create a container for this structure
    const structureContainer = this.scene.add.container(
      bounds.x * this.tileSize,
      bounds.y * this.tileSize
    );
    structureContainer.setName(structureId);
    
    // Generate tile positions for this structure
    const tilePositions = this.calculateTilePositions(bounds);
    
    // Process in chunks to keep UI responsive during loading
    const chunkSize = 50; // Process 50 tiles at a time
    for (let i = 0; i < tilePositions.length; i += chunkSize) {
      const chunk = tilePositions.slice(i, i + chunkSize);
      
      // Create tiles for each position in this chunk
      for (const pos of chunk) {
        // Get world position
        const worldX = bounds.x + pos.localX;
        const worldY = bounds.y + pos.localY;
        
        // Get tile value from map data
        const tileValue = this.getTileValue(worldX, worldY, mapData);
        
        // Skip if tile doesn't exist or is out of bounds
        if (tileValue === undefined) continue;
        
        // Create sprite for this tile
        const sprite = this.tileFactory.createTileSprite(
          tileValue,
          pos.localX * this.tileSize + this.tileSize / 2,
          pos.localY * this.tileSize + this.tileSize / 2
        );
        
        // Add to structure container
        structureContainer.add(sprite);
      }
      
      // Yield to UI thread briefly after each chunk
      if (i + chunkSize < tilePositions.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Create debug outline if debug mode is enabled
    if (this.debug) {
      let color;
      switch (type) {
        case 'room':
          color = 0x00ff00; // Green for rooms
          break;
        case 'corridor':
          color = 0x0000ff; // Blue for corridors
          break;
        case 'spawnRoom':
          color = 0xff00ff; // Magenta for spawn rooms
          break;
        default:
          color = 0xffffff; // White for unknown types
      }
      
      const outline = this.scene.add.rectangle(
        0, 0,
        bounds.width * this.tileSize,
        bounds.height * this.tileSize,
        color, 0.2
      ).setOrigin(0);
      
      structureContainer.add(outline);
    }
    
    // Store structure data
    this.structures[structureId] = {
      id: structureId,
      container: structureContainer,
      bounds: bounds,
      originalStructure: structure,
      type: type,
      visible: false
    };
    
    // Initially hide the structure
    structureContainer.setVisible(false);
    
    // Add to the main container
    this.container.add(structureContainer);
    
    // Update structure counts
    this.visibilityCounts.total++;
    switch (type) {
      case 'room': this.visibilityCounts.rooms++; break;
      case 'corridor': this.visibilityCounts.corridors++; break;
      case 'spawnRoom': this.visibilityCounts.spawnRooms++; break;
    }
    
    // Debug logging
    if (this.debug) {
      console.log(
        `Preloaded structure: ${structureId} (${type}) at (${bounds.x},${bounds.y}) size ${bounds.width}x${bounds.height}`
      );
    }
  }
  
  /**
   * Generate a unique ID for a structure
   * @param {Object} structure - Structure definition
   * @param {string} type - Type of structure
   * @returns {string} - Unique structure ID
   * @private
   */
  getStructureId(structure, type) {
    // Use provided ID if available, otherwise generate one based on coordinates
    return `${type}_${structure.id || `${structure.x}_${structure.y}`}`;
  }
  
  /**
   * Calculate expanded bounds for a structure with a buffer zone
   * @param {Object} structure - Structure definition
   * @returns {Object} - Expanded bounds
   * @private
   */
  calculateExpandedBounds(structure) {
    // Add buffer around structure for seamless transitions
    const buffer = 2; // Buffer tiles around structure
    
    return {
      x: Math.max(0, structure.x - buffer),
      y: Math.max(0, structure.y - buffer),
      width: structure.width + buffer * 2,
      height: structure.height + buffer * 2,
      originalX: structure.x,
      originalY: structure.y,
      originalWidth: structure.width,
      originalHeight: structure.height
    };
  }
  
  /**
   * Clamp bounds to map limits
   * @param {Object} bounds - Bounds to clamp
   * @param {Object} mapData - Map data
   * @private
   */
  clampBounds(bounds, mapData) {
    // Ensure bounds don't extend past map edges
    if (mapData.dungeonTileWidth && bounds.x + bounds.width > mapData.dungeonTileWidth) {
      bounds.width = mapData.dungeonTileWidth - bounds.x;
    }
    
    if (mapData.dungeonTileHeight && bounds.y + bounds.height > mapData.dungeonTileHeight) {
      bounds.height = mapData.dungeonTileHeight - bounds.y;
    }
    
    // Ensure minimum size
    bounds.width = Math.max(1, bounds.width);
    bounds.height = Math.max(1, bounds.height);
  }
  
  /**
   * Calculate all tile positions within a bounds
   * @param {Object} bounds - Structure bounds
   * @returns {Array} - Array of tile position objects
   * @private
   */
  calculateTilePositions(bounds) {
    const positions = [];
    
    // Generate positions for every tile in the structure
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        positions.push({
          localX: x,
          localY: y,
          worldX: bounds.x + x,
          worldY: bounds.y + y
        });
      }
    }
    
    return positions;
  }
  
  /**
   * Get tile value at specific coordinates
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {Object} mapData - Map data
   * @returns {number|undefined} - Tile value or undefined if out of bounds
   * @private
   */
  getTileValue(x, y, mapData) {
    // Check if position is within map bounds
    if (!mapData.layers || !mapData.layers.tiles) {
      return 0; // Default to floor if no layers exist
    }
    
    // Check if position is within the tiles array
    if (y >= 0 && y < mapData.layers.tiles.length &&
        x >= 0 && mapData.layers.tiles[y] && x < mapData.layers.tiles[y].length) {
      return mapData.layers.tiles[y][x];
    }
    
    // Out of bounds - default to floor
    return 0;
  }
  
  /**
   * Update visibility of structures based on camera position
   * @param {Object} cameraBounds - Camera bounds in pixels
   * @param {boolean} forceUpdate - Force update all structures
   */
  updateVisibility(cameraBounds, forceUpdate = false) {
    // Save previous state for comparison
    this.previouslyVisibleStructures = new Set(this.visibleStructures);
    this.visibleStructures.clear();
    
    // Convert buffer to pixels and add to camera bounds
    const bufferPx = this.visibilityBuffer * this.tileSize;
    const expandedBounds = {
      left: cameraBounds.left - bufferPx,
      right: cameraBounds.right + bufferPx,
      top: cameraBounds.top - bufferPx,
      bottom: cameraBounds.bottom + bufferPx
    };
    
    // Check each structure
    let visibleCount = 0;
    
    for (const structureId in this.structures) {
      const structure = this.structures[structureId];
      
      // Convert structure bounds to pixels
      const structureBounds = {
        left: structure.bounds.x * this.tileSize,
        right: (structure.bounds.x + structure.bounds.width) * this.tileSize,
        top: structure.bounds.y * this.tileSize,
        bottom: (structure.bounds.y + structure.bounds.height) * this.tileSize
      };
      
      // Check if structure intersects with expanded camera bounds
      const isVisible = !(
        structureBounds.right < expandedBounds.left ||
        structureBounds.left > expandedBounds.right ||
        structureBounds.bottom < expandedBounds.top ||
        structureBounds.top > expandedBounds.bottom
      );
      
      // Update visibility if changed
      if (isVisible !== structure.visible || forceUpdate) {
        structure.container.setVisible(isVisible);
        structure.visible = isVisible;
      }
      
      // Track visible structures
      if (isVisible) {
        this.visibleStructures.add(structureId);
        visibleCount++;
      }
    }
    
    // Update visibility count
    this.visibilityCounts.visible = visibleCount;
    
    return this.visibleStructures;
  }
  
  /**
   * Get newly visible structures in this update
   * @returns {Array} - Array of structure objects
   */
  getNewlyVisibleStructures() {
    const newlyVisible = [];
    
    for (const structureId of this.visibleStructures) {
      if (!this.previouslyVisibleStructures.has(structureId)) {
        newlyVisible.push(this.structures[structureId]);
      }
    }
    
    return newlyVisible;
  }
  
  /**
   * Get structure counts
   * @returns {Object} - Structure counts
   */
  getCounts() {
    return { ...this.visibilityCounts };
  }
  
  /**
   * Get information about structures at a specific world position
   * @param {number} worldX - World X coordinate
   * @param {number} worldY - World Y coordinate
   * @returns {Object|null} - Structure information or null if none found
   */
  getStructureAtPosition(worldX, worldY) {
    // Convert world coordinates to tile coordinates
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    
    // Check each structure
    for (const structureId in this.structures) {
      const structure = this.structures[structureId];
      const bounds = structure.bounds;
      
      // Check if tile is within bounds
      if (tileX >= bounds.x && tileX < bounds.x + bounds.width &&
          tileY >= bounds.y && tileY < bounds.y + bounds.height) {
        return structure;
      }
    }
    
    return null;
  }
  
  /**
   * Clear all structures
   */
  clear() {
    // Destroy all structures
    for (const structureId in this.structures) {
      const structure = this.structures[structureId];
      if (structure.container) {
        structure.container.destroy();
      }
    }
    
    // Clear structure tracking
    this.structures = {};
    this.visibleStructures.clear();
    this.previouslyVisibleStructures.clear();
    
    // Reset counts
    this.visibilityCounts = {
      total: 0,
      visible: 0,
      rooms: 0,
      corridors: 0,
      spawnRooms: 0
    };
    
    // Clear container
    this.container.removeAll(true);
  }
  
  /**
   * Destroy the manager and clean up resources
   */
  destroy() {
    // Clear all structures
    this.clear();
    
    // Destroy tile factory
    this.tileFactory.destroy();
    
    // Destroy container
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}
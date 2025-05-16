// src/dungeonRenderer/ui/MinimapRenderer.js

/**
 * MinimapRenderer - Renders a minimap overview of the dungeon
 * Provides a small map in the corner for player navigation
 */
export class MinimapRenderer {
    /**
     * Create a new MinimapRenderer
     * @param {Phaser.Scene} scene - The Phaser scene to render in
     */
    constructor(scene) {
      this.scene = scene;
      this.container = null;
      this.background = null;
      this.graphics = null;
      this.playerMarker = null;
      this.floorText = null;
      this.minimapBackground = null;
      this.minimapBorder = null;
      
      // Minimap settings
      this.size = 200; // Size in pixels
      this.padding = 20; // Padding from screen edge
      this.scale = 0.01; // Default scale factor
      this.offsetX = 0; // Offset for centering map in minimap
      this.offsetY = 0;
      this.tileSize = 64;
      
      // Map data
      this.mapData = null;
      this.playerPosition = { x: 0, y: 0 };
      
      // Toggle settings
      this.showSpawnPoints = true;
      this.showPlayerPosition = true;
      this.showStructureTypes = true;
      this.showViewport = false;
      
      // Debug settings
      this.debug = false;
      this.isInitialized = false;
    }
    
    /**
     * Initialize the minimap renderer
     * @param {Object} options - Configuration options
     * @returns {MinimapRenderer} - This instance for chaining
     */
    init(options = {}) {
      if (this.isInitialized) return this;
      
      // Apply options
      this.size = options.size || this.size;
      this.padding = options.padding || this.padding;
      this.debug = options.debug || false;
      
      // Get toggle settings
      this.showSpawnPoints = options.showSpawnPoints !== false;
      this.showPlayerPosition = options.showPlayerPosition !== false;
      this.showStructureTypes = options.showStructureTypes !== false;
      this.showViewport = options.showViewport === true;
      
      // Create the container and UI elements
      this.createMinimapContainer();
      
      this.isInitialized = true;
      return this;
    }
    
    /**
     * Create minimap container and UI elements
     * @private
     */
    createMinimapContainer() {
      // Create container
      this.container = this.scene.add.container(0, 0);
      this.container.setDepth(900); // Above most elements but below UI
      this.container.setScrollFactor(0); // Fixed to camera
      
      // Get camera dimensions
      const width = this.scene.cameras.main.width;
      const height = this.scene.cameras.main.height;
      
      // Position in top-right corner with padding
      const x = width - this.size - this.padding;
      const y = this.padding;
      
      // Create background
      this.minimapBackground = this.scene.add.rectangle(
        0, 0, this.size, this.size, 0x000000, 0.7
      ).setOrigin(0);
      
      // Create border
      this.minimapBorder = this.scene.add.graphics();
      this.minimapBorder.lineStyle(2, 0xffffff, 0.8);
      this.minimapBorder.strokeRect(0, 0, this.size, this.size);
      
      // Create graphics for map elements
      this.graphics = this.scene.add.graphics();
      
      // Create player marker
      this.playerMarker = this.scene.add.circle(0, 0, 4, 0x00ff00, 1);
      
      // Add everything to container
      this.container.add([
        this.minimapBackground,
        this.minimapBorder,
        this.graphics,
        this.playerMarker
      ]);
      
      // Position the container
      this.container.setPosition(x, y);
      
      // Create floor level text
      this.floorText = this.scene.add.text(
        this.size / 2, this.size - 15, 
        'Floor 1', 
        { fontSize: '12px', fill: '#ffffff' }
      ).setOrigin(0.5);
      
      this.container.add(this.floorText);
      
      if (this.debug) {
        console.log(`Minimap created at (${x}, ${y}) with size ${this.size}x${this.size}`);
      }
    }
    
    /**
     * Render the minimap from map data
     * @param {Object} mapData - Map data from server
     * @param {number} tileSize - Size of tiles in pixels
     */
    render(mapData, tileSize) {
      if (!this.isInitialized) {
        console.error('MinimapRenderer not initialized');
        return;
      }
      
      // Store map data and tile size
      this.mapData = mapData;
      this.tileSize = tileSize || this.tileSize;
      
      // Clear existing graphics
      this.graphics.clear();
      
      // Update floor text
      if (this.floorText) {
        this.floorText.setText(`Floor ${mapData.floorLevel || 1}`);
      }
      
      // Calculate scale to fit dungeon in minimap
      this.calculateMinimapScale();
      
      // Draw minimap contents
      this.drawMinimapContents();
      
      // Draw player position if available
      if (this.showPlayerPosition) {
        this.updatePlayerPosition(this.playerPosition.x, this.playerPosition.y);
      } else {
        this.playerMarker.setVisible(false);
      }
      
      if (this.debug) {
        console.log(`Minimap rendered with scale ${this.scale}`);
      }
    }
    
    /**
     * Calculate scale factor to fit dungeon in minimap
     * @private
     */
    calculateMinimapScale() {
      if (!this.mapData) return;
      
      // Get dungeon dimensions in pixels
      const dungeonWidthPx = this.mapData.dungeonTileWidth * this.tileSize;
      const dungeonHeightPx = this.mapData.dungeonTileHeight * this.tileSize;
      
      // Calculate scale to fit in minimap with some padding
      this.scale = Math.min(
        (this.size * 0.9) / dungeonWidthPx,
        (this.size * 0.9) / dungeonHeightPx
      );
      
      // Scale down a bit more for better overview
      this.scale *= 0.8;
      
      // Calculate offsets to center the map in the minimap
      this.offsetX = (this.size - dungeonWidthPx * this.scale) / 2;
      this.offsetY = (this.size - dungeonHeightPx * this.scale) / 2;
    }
    
    /**
     * Draw minimap contents based on map data
     * @private
     */
    drawMinimapContents() {
      if (!this.mapData || !this.graphics) return;
      
      const structural = this.mapData.structural;
      
      // Draw floor background
      this.graphics.fillStyle(0x222222, 0.8);
      this.graphics.fillRect(
        this.offsetX, 
        this.offsetY, 
        this.mapData.dungeonTileWidth * this.tileSize * this.scale,
        this.mapData.dungeonTileHeight * this.tileSize * this.scale
      );
      
      // Draw rooms
      if (structural && structural.rooms) {
        this.graphics.fillStyle(0x444444, 1);
        
        structural.rooms.forEach(room => {
          const x = this.offsetX + room.x * this.tileSize * this.scale;
          const y = this.offsetY + room.y * this.tileSize * this.scale;
          const width = room.width * this.tileSize * this.scale;
          const height = room.height * this.tileSize * this.scale;
          
          this.graphics.fillRect(x, y, width, height);
        });
      }
      
      // Draw corridors
      if (structural && structural.corridors) {
        this.graphics.fillStyle(0x333333, 1);
        
        structural.corridors.forEach(corridor => {
          const x = this.offsetX + corridor.x * this.tileSize * this.scale;
          const y = this.offsetY + corridor.y * this.tileSize * this.scale;
          const width = corridor.width * this.tileSize * this.scale;
          const height = corridor.height * this.tileSize * this.scale;
          
          this.graphics.fillRect(x, y, width, height);
        });
      }
      
      // Draw spawn rooms
      if (structural && structural.spawnRooms) {
        this.graphics.fillStyle(0x8800ff, 0.7);
        
        structural.spawnRooms.forEach(room => {
          const x = this.offsetX + room.x * this.tileSize * this.scale;
          const y = this.offsetY + room.y * this.tileSize * this.scale;
          const width = room.width * this.tileSize * this.scale;
          const height = room.height * this.tileSize * this.scale;
          
          this.graphics.fillRect(x, y, width, height);
        });
      }
      
      // Draw spawn points
      if (this.showSpawnPoints && this.mapData.spawnPoints) {
        this.graphics.fillStyle(0xffff00, 1);
        
        this.mapData.spawnPoints.forEach(spawn => {
          const x = this.offsetX + spawn.x * this.scale;
          const y = this.offsetY + spawn.y * this.scale;
          
          this.graphics.fillCircle(x, y, 2);
        });
      }
      
      // Draw viewport if enabled
      if (this.showViewport) {
        this.drawViewport();
      }
    }
    
    /**
     * Draw camera viewport on minimap
     * @private
     */
    drawViewport() {
      const camera = this.scene.cameras.main;
      
      // Calculate viewport position and size in minimap coordinates
      const x = this.offsetX + camera.scrollX * this.scale;
      const y = this.offsetY + camera.scrollY * this.scale;
      const width = camera.width * this.scale;
      const height = camera.height * this.scale;
      
      // Draw viewport rectangle
      this.graphics.lineStyle(1, 0xffff00, 0.8);
      this.graphics.strokeRect(x, y, width, height);
    }
    
    /**
     * Update player position on minimap
     * @param {number} x - Player x position in world coordinates
     * @param {number} y - Player y position in world coordinates
     */
    updatePlayerPosition(x, y) {
      if (!this.isInitialized || !this.playerMarker) return;
      
      // Store position
      this.playerPosition.x = x;
      this.playerPosition.y = y;
      
      // Calculate minimap position
      const minimapX = this.offsetX + x * this.scale;
      const minimapY = this.offsetY + y * this.scale;
      
      // Update marker position
      this.playerMarker.setPosition(minimapX, minimapY);
      this.playerMarker.setVisible(this.showPlayerPosition);
      
      // Update viewport if enabled
      if (this.showViewport) {
        this.drawViewport();
      }
    }
    
    /**
     * Toggle a specific minimap feature
     * @param {string} feature - Feature to toggle ('spawnPoints', 'playerPosition', 'structureTypes', 'viewport')
     * @param {boolean} enabled - Whether the feature is enabled
     */
    toggleFeature(feature, enabled) {
      switch (feature) {
        case 'spawnPoints':
          this.showSpawnPoints = enabled;
          break;
        case 'playerPosition':
          this.showPlayerPosition = enabled;
          this.playerMarker.setVisible(enabled);
          break;
        case 'structureTypes':
          this.showStructureTypes = enabled;
          break;
        case 'viewport':
          this.showViewport = enabled;
          break;
      }
      
      // Redraw the minimap
      this.drawMinimapContents();
    }
    
    /**
     * Handle resize event from scene
     * @param {number} width - New screen width
     * @param {number} height - New screen height
     */
    handleResize(width, height) {
      if (!this.isInitialized || !this.container) return;
      
      // Position in top-right corner with padding
      const x = width - this.size - this.padding;
      const y = this.padding;
      
      // Update container position
      this.container.setPosition(x, y);
      
      if (this.debug) {
        console.log(`Minimap repositioned to (${x}, ${y}) after resize`);
      }
    }
    
    /**
     * Set visibility of the minimap
     * @param {boolean} visible - Whether the minimap is visible
     */
    setVisible(visible) {
      if (!this.isInitialized || !this.container) return;
      
      this.container.setVisible(visible);
    }
    
    /**
     * Clear minimap contents
     */
    clear() {
      if (!this.isInitialized) return;
      
      if (this.graphics) {
        this.graphics.clear();
      }
      
      if (this.floorText) {
        this.floorText.setText('Floor 1');
      }
      
      this.mapData = null;
    }
    
    /**
     * Destroy the minimap and clean up resources
     */
    destroy() {
      if (this.container) {
        this.container.destroy();
        this.container = null;
      }
      
      this.graphics = null;
      this.playerMarker = null;
      this.floorText = null;
      this.minimapBackground = null;
      this.minimapBorder = null;
      this.mapData = null;
      this.isInitialized = false;
    }
  }
// src/dungeonRenderer/core/DungeonRenderer.js
import { StructureManager } from './StructureManager';
import { TileFactory } from './TileFactory';
import { LoadingManager } from './LoadingManager';
import { VisibilityCulling } from '../utils/VisibilityCulling';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { MinimapRenderer } from '../ui/MinimapRenderer';
import { TextureRegistry } from '../textures/TextureRegistry';

/**
 * DungeonRenderer - Main class for rendering a tile-based dungeon
 * Handles pre-loading, visibility culling, and structure management
 */
export class DungeonRenderer {
  /**
   * Create a new DungeonRenderer
   * @param {Phaser.Scene} scene - The Phaser scene to render in
   */
  constructor(scene) {
    this.scene = scene;
    this.isInitialized = false;
    this.isLoading = false;
    
    // Configuration
    this.tileSize = 64; // Default tile size in pixels
    this.debug = false;
    
    // Create component managers
    this.textureRegistry = new TextureRegistry(scene);
    this.structureManager = new StructureManager(scene, this.textureRegistry);
    this.tileFactory = new TileFactory(scene, this.textureRegistry);
    this.loadingManager = new LoadingManager(scene);
    this.minimapRenderer = new MinimapRenderer(scene);
    this.visibilityCulling = new VisibilityCulling();
    this.performanceMonitor = new PerformanceMonitor();
    
    // Rendering state
    this.mapData = null;
    this.lastCameraPosition = { x: 0, y: 0 };
    this.loadCallback = null;
    this.isMapLoaded = false;
    
    // Debug
    this.debugText = null;
    this.debugGraphics = null;
  }
  
  /**
   * Initialize the renderer with configuration options
   * @param {Object} options - Configuration options
   * @returns {DungeonRenderer} - This instance for chaining
   */
  init(options = {}) {
    if (this.isInitialized) return this;
    
    // Parse options
    this.tileSize = options.tileSize || this.tileSize;
    this.debug = options.debug || false;
    
    // Initialize components with options
    this.textureRegistry.init({ 
      tileSize: this.tileSize, 
      debug: this.debug 
    });
    
    this.structureManager.init({ 
      tileSize: this.tileSize, 
      debug: this.debug,
      visibilityBuffer: options.visibilityBuffer || 5
    });
    
    this.tileFactory.init({ 
      tileSize: this.tileSize, 
      debug: this.debug,
      poolInitialSize: options.poolInitialSize || 100
    });
    
    this.loadingManager.init({
      debug: this.debug,
      progressBarWidth: options.progressBarWidth || 400,
      progressBarHeight: options.progressBarHeight || 30
    });
    
    this.minimapRenderer.init({
      size: options.minimapSize || 200,
      padding: options.minimapPadding || 20,
      debug: this.debug
    });
    
    this.visibilityCulling.init({
      debug: this.debug
    });
    
    this.performanceMonitor.init({
      trackFPS: options.trackFPS !== false,
      trackMemory: options.trackMemory !== false,
      updateFrequency: options.perfUpdateFrequency || 1000,
      debug: this.debug
    });
    
    // Set up camera movement listener
    this.scene.cameras.main.on('camerascroll', this.onCameraMove, this);
    
    // Set up debug displays if enabled
    if (this.debug) {
      this.setupDebugDisplays();
    }
    
    this.isInitialized = true;
    return this;
  }
  
  /**
   * Load and render a dungeon map
   * @param {Object} mapData - Map data from server
   * @param {Function} callback - Callback when loading completes
   * @returns {Promise<boolean>} - Resolves when loading completes
   */
  async loadMap(mapData, callback = null) {
    if (!this.isInitialized) {
      console.error('DungeonRenderer must be initialized before loading a map');
      return false;
    }
    
    if (this.isLoading) {
      console.warn('Already loading a map, ignoring new request');
      return false;
    }
    
    // Start loading process
    this.isLoading = true;
    this.isMapLoaded = false;
    this.loadCallback = callback;
    this.mapData = mapData;
    
    try {
      // Show loading UI
      this.loadingManager.showLoadingUI('Preparing dungeon...', 0);
      
      // Set tile size from map data if provided
      this.tileSize = mapData.tileSize || this.tileSize;
      
      // Set up world bounds based on map data
      this.setWorldBounds();
      
      // Pre-render the minimap
      this.minimapRenderer.render(mapData, this.tileSize);
      
      // Start pre-loading all structures
      await this.preloadAllStructures();
      
      // Perform initial visibility update
      this.updateVisibility(true);
      
      // Hide loading UI
      this.loadingManager.hideLoadingUI();
      
      // Flag as loaded
      this.isLoading = false;
      this.isMapLoaded = true;
      
      // Execute callback if provided
      if (typeof this.loadCallback === 'function') {
        this.loadCallback(true);
      }
      
      return true;
    } catch (error) {
      console.error('Error loading dungeon map:', error);
      
      // Hide loading UI and show error
      this.loadingManager.hideLoadingUI();
      this.loadingManager.showError('Failed to load dungeon. Please try again.');
      
      // Reset state
      this.isLoading = false;
      
      // Execute callback with error if provided
      if (typeof this.loadCallback === 'function') {
        this.loadCallback(false, error);
      }
      
      return false;
    }
  }
  
  /**
   * Preload all structures in the map data
   * @returns {Promise<void>}
   * @private
   */
  async preloadAllStructures() {
    if (!this.mapData || !this.mapData.structural) {
      throw new Error('Invalid map data - missing structural information');
    }
    
    const structural = this.mapData.structural;
    
    // Calculate total items to load for progress tracking
    const totalItems = 
      (structural.rooms?.length || 0) + 
      (structural.corridors?.length || 0) + 
      (structural.spawnRooms?.length || 0);
    
    let loadedItems = 0;
    
    // Pre-load rooms
    if (structural.rooms && structural.rooms.length > 0) {
      for (const room of structural.rooms) {
        await this.structureManager.preloadStructure(room, this.mapData, 'room');
        loadedItems++;
        this.loadingManager.updateProgress(loadedItems / totalItems);
        
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Pre-load corridors
    if (structural.corridors && structural.corridors.length > 0) {
      for (const corridor of structural.corridors) {
        await this.structureManager.preloadStructure(corridor, this.mapData, 'corridor');
        loadedItems++;
        this.loadingManager.updateProgress(loadedItems / totalItems);
        
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Pre-load spawn rooms
    if (structural.spawnRooms && structural.spawnRooms.length > 0) {
      for (const spawnRoom of structural.spawnRooms) {
        await this.structureManager.preloadStructure(spawnRoom, this.mapData, 'spawnRoom');
        loadedItems++;
        this.loadingManager.updateProgress(loadedItems / totalItems);
        
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }
  
  /**
   * Set world bounds based on map data
   * @private
   */
  setWorldBounds() {
    if (!this.mapData) return;
    
    // Calculate world dimensions
    const worldWidth = this.mapData.worldTileWidth * this.tileSize;
    const worldHeight = this.mapData.worldTileHeight * this.tileSize;
    
    // Set physics world bounds
    this.scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    
    // Set camera bounds
    this.scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    
    if (this.debug) {
      console.log(`World bounds set to ${worldWidth}x${worldHeight} pixels`);
    }
  }
  
  /**
   * Handle camera movement
   * @param {Phaser.Cameras.Scene2D.Camera} camera - The camera that moved
   * @private
   */
  onCameraMove = (camera) => {
    // Skip if not loaded
    if (!this.isMapLoaded) return;
    
    // Check if camera has moved enough to update visibility
    if (this.visibilityCulling.shouldUpdateVisibility(camera, this.lastCameraPosition)) {
      // Save new camera position
      this.lastCameraPosition.x = camera.scrollX;
      this.lastCameraPosition.y = camera.scrollY;
      
      // Update visibility
      this.updateVisibility();
    }
  }
  
  /**
   * Update visibility of structures based on camera position
   * @param {boolean} forceUpdate - Force a full update
   * @private
   */
  updateVisibility(forceUpdate = false) {
    // Skip if not loaded
    if (!this.isMapLoaded) return;
    
    // Get current camera view bounds
    const camera = this.scene.cameras.main;
    const cameraBounds = {
      left: camera.scrollX,
      right: camera.scrollX + camera.width,
      top: camera.scrollY,
      bottom: camera.scrollY + camera.height
    };
    
    // Start performance measurement
    this.performanceMonitor.startMeasure('visibilityUpdate');
    
    // Update structure visibility
    this.structureManager.updateVisibility(cameraBounds, forceUpdate);
    
    // End performance measurement
    this.performanceMonitor.endMeasure('visibilityUpdate');
    
    // Update debug displays
    if (this.debug) {
      this.updateDebugDisplays();
    }
  }
  
  /**
   * Update the renderer - called from scene update
   * @param {number} time - Current time
   * @param {number} delta - Time delta since last update
   */
  update(time, delta) {
    // Skip if not loaded
    if (!this.isMapLoaded) return;
    
    // Update performance monitor
    this.performanceMonitor.update(time, delta);
    
    // Get current player position
    const playerPosition = this.getPlayerPosition();
    
    // Update minimap with player position
    if (playerPosition) {
      this.minimapRenderer.updatePlayerPosition(playerPosition.x, playerPosition.y);
    }
    
    // Update debug displays
    if (this.debug) {
      this.updateDebugDisplays();
    }
  }
  
  /**
   * Get current player position
   * @returns {Object|null} - Player position or null
   * @private
   */
  getPlayerPosition() {
    // Try to get player from scene
    if (this.scene.playerManager && this.scene.playerManager.getPlayerPosition) {
      return this.scene.playerManager.getPlayerPosition();
    }
    
    return null;
  }
  
  /**
   * Set up debug displays
   * @private
   */
  setupDebugDisplays() {
    // Create debug text display
    this.debugText = this.scene.add.text(10, 10, 'Dungeon Renderer', {
      fontSize: '14px',
      fill: '#00ff00',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 2 }
    }).setScrollFactor(0).setDepth(1000);
    
    // Create debug graphics for visualizing bounds
    this.debugGraphics = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(1000);
  }
  
  /**
   * Update debug displays
   * @private
   */
  updateDebugDisplays() {
    if (!this.debug) return;
    
    if (this.debugText) {
      // Get performance stats
      const stats = this.performanceMonitor.getStats();
      
      // Get structure counts
      const structureCounts = this.structureManager.getCounts();
      
      // Update debug text
      this.debugText.setText([
        `FPS: ${stats.fps.toFixed(1)}`,
        `Visible: ${structureCounts.visible}/${structureCounts.total} structures`,
        `Last Update: ${stats.lastUpdateTime.toFixed(2)}ms`,
        `Camera: ${Math.round(this.lastCameraPosition.x)},${Math.round(this.lastCameraPosition.y)}`,
        `Sprites: ${this.tileFactory.getActiveSpriteCount()}`
      ].join('\n'));
    }
    
    if (this.debugGraphics) {
      // Clear previous graphics
      this.debugGraphics.clear();
      
      // Get camera bounds for visualization
      const camera = this.scene.cameras.main;
      
      // Draw camera view rectangle
      this.debugGraphics.lineStyle(1, 0xff0000, 0.5);
      this.debugGraphics.strokeRect(
        0, 0, camera.width, camera.height
      );
      
      // Draw culling buffer zone
      const buffer = this.structureManager.visibilityBuffer * this.tileSize;
      this.debugGraphics.lineStyle(1, 0x00ff00, 0.3);
      this.debugGraphics.strokeRect(
        -buffer, -buffer, 
        camera.width + buffer * 2, 
        camera.height + buffer * 2
      );
    }
  }
  
  /**
   * Handle window resize event
   * @param {number} width - New width
   * @param {number} height - New height
   */
  handleResize(width, height) {
    // Update minimap position
    this.minimapRenderer.handleResize(width, height);
    
    // Reposition debug elements
    if (this.debug && this.debugText) {
      this.debugText.setPosition(10, 10);
    }
    
    // Force visibility update to adjust for new view dimensions
    this.updateVisibility(true);
  }
  
  /**
   * Clear the current map
   */
  clearMap() {
    if (!this.isMapLoaded) return;
    
    // Clear all structures
    this.structureManager.clear();
    
    // Clear minimap
    this.minimapRenderer.clear();
    
    // Reset state
    this.mapData = null;
    this.isMapLoaded = false;
    this.lastCameraPosition = { x: 0, y: 0 };
  }
  
  /**
   * Clean up resources when destroying the renderer
   */
  destroy() {
    // Remove event listeners
    this.scene.cameras.main.off('camerascroll', this.onCameraMove);
    
    // Clean up all components
    this.structureManager.destroy();
    this.tileFactory.destroy();
    this.loadingManager.destroy();
    this.minimapRenderer.destroy();
    this.performanceMonitor.destroy();
    
    // Clean up debug elements
    if (this.debugText) {
      this.debugText.destroy();
      this.debugText = null;
    }
    
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
    
    // Reset state
    this.isInitialized = false;
    this.isMapLoaded = false;
    this.isLoading = false;
  }
}
// src/dungeonRenderer2/core/DungeonRenderer.js
import { StructureManager } from './StructureManager';
import { TileFactory } from './TileFactory';
import { LoadingManager } from './LoadingManager';
import { VisibilityCulling } from '../utils/VisibilityCulling';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { MinimapRenderer } from '../ui/MinimapRenderer';
import { TextureRegistry } from '../textures/TextureRegistry';
import { DebugOverlay } from '../ui/DebugOverlay';

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
    this.debugOverlay = new DebugOverlay(scene);
    
    // Rendering state
    this.mapData = null;
    this.lastCameraPosition = { x: 0, y: 0 };
    this.loadCallback = null;
    this.isMapLoaded = false;
    
    // Reference to structure renderer for debugging
    this.structureRenderer = this.structureManager;
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
    
    if (this.debug) {
      this.debugOverlay.init({
        dungeonRenderer: this,
        structureRenderer: this.structureManager,
        visibilityCulling: this.visibilityCulling
      });
    }
    
    // Set up camera movement listener
    this.scene.cameras.main.on('camerascroll', this.onCameraMove, this);
    
    this.isInitialized = true;
    return this;
  }
  
  /**
   * Preload tile assets before rendering
   * This should be called during the scene's preload phase
   */
  preloadTileAssets() {
    // Create base textures for fallbacks
    this.textureRegistry.generateProceduralTextures();
    
    // No need to preload actual textures here - we'll do that during map loading
    // to show proper loading progress
    
    if (this.debug) {
      console.log('Generated procedural textures for tiles');
    }
  }
  
  /**
   * Render a dungeon map
   * @param {Object} mapData - Map data from server
   * @param {Function} callback - Optional callback when loading completes
   */
  renderMap(mapData, callback = null) {
    // Just a wrapper around loadMap for backward compatibility
    return this.loadMap(mapData, callback);
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
      
      // Store current camera position before loading structures
      this.lastCameraPosition = {
        x: this.scene.cameras.main.scrollX,
        y: this.scene.cameras.main.scrollY
      };
      
      // Debug log the initial camera position
      if (this.debug) {
        console.log(`Initial camera position: (${this.lastCameraPosition.x}, ${this.lastCameraPosition.y})`);
      }
      
      // Preload textures first
      this.loadingManager.showLoadingUI('Loading textures...', 0.1);
      await this.textureRegistry.preloadTextures();
      
      // Pre-render the minimap
      this.loadingManager.showLoadingUI('Generating minimap...', 0.2);
      this.minimapRenderer.render(mapData, this.tileSize);
      
      // Start pre-loading all structures
      this.loadingManager.showLoadingUI('Building dungeon structures...', 0.3);
      await this.preloadAllStructures();
      
      // Perform initial visibility update with expanded bounds
      this.loadingManager.showLoadingUI('Finalizing dungeon...', 0.9);
      
      // Force an initial visibility update with generous bounds
      // This is critical to ensuring structures are visible on first load
      const expandedBuffer = this.tileSize * 15; // Use a large buffer for initial visibility
      const initialBounds = {
        left: this.lastCameraPosition.x - expandedBuffer,
        right: this.lastCameraPosition.x + this.scene.cameras.main.width + expandedBuffer,
        top: this.lastCameraPosition.y - expandedBuffer,
        bottom: this.lastCameraPosition.y + this.scene.cameras.main.height + expandedBuffer
      };
      
      // Debug log the initial bounds
      if (this.debug) {
        console.log(`Initial visibility bounds: (${initialBounds.left}, ${initialBounds.top}) to (${initialBounds.right}, ${initialBounds.bottom})`);
      }
      
      // Ensure enough structures are visible initially
      this.structureManager.updateVisibility(initialBounds, true);
      
      // Log how many structures are visible
      if (this.debug) {
        const visibleCount = this.structureManager.getVisibleCount();
        const totalCount = Object.keys(this.structureManager.structures).length;
        console.log(`Initial visibility check: ${visibleCount}/${totalCount} structures visible`);
      }
      
      // Hide loading UI
      this.loadingManager.hideLoadingUI();
      
      // Flag as loaded
      this.isLoading = false;
      this.isMapLoaded = true;
      
      // Execute callback if provided
      if (typeof this.loadCallback === 'function') {
        this.loadCallback(true);
      }
      
      // Schedule another visibility update after a short delay
      // This helps ensure structures appear correctly after any camera adjustments
      this.scene.time.delayedCall(100, () => {
        this.updateVisibility(true);
      });
      
      if (this.debug) {
        console.log('Dungeon map loaded successfully');
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
        this.loadingManager.updateProgress(0.3 + 0.5 * (loadedItems / totalItems));
        
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Pre-load corridors
    if (structural.corridors && structural.corridors.length > 0) {
      for (const corridor of structural.corridors) {
        await this.structureManager.preloadStructure(corridor, this.mapData, 'corridor');
        loadedItems++;
        this.loadingManager.updateProgress(0.3 + 0.5 * (loadedItems / totalItems));
        
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Pre-load spawn rooms
    if (structural.spawnRooms && structural.spawnRooms.length > 0) {
      for (const spawnRoom of structural.spawnRooms) {
        await this.structureManager.preloadStructure(spawnRoom, this.mapData, 'spawnRoom');
        loadedItems++;
        this.loadingManager.updateProgress(0.3 + 0.5 * (loadedItems / totalCount));
        
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
    if (this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    }
    
    // Set camera bounds
    if (this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    }
    
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
    
    if (this.debug) {
      console.log(`Updating visibility for camera bounds: (${Math.round(cameraBounds.left)},${Math.round(cameraBounds.top)}) - (${Math.round(cameraBounds.right)},${Math.round(cameraBounds.bottom)})`);
    }
    
    // Start performance measurement
    this.performanceMonitor.startMeasure('visibilityUpdate');
    
    // Update structure visibility
    this.structureManager.updateVisibility(cameraBounds, forceUpdate);
    
    // Log how many structures are visible
    if (this.debug) {
      const visibleCount = this.structureManager.getVisibleCount();
      const totalCount = Object.keys(this.structureManager.structures).length;
      console.log(`Visibility update: ${visibleCount}/${totalCount} structures visible`);
    }
    
    // End performance measurement
    this.performanceMonitor.endMeasure('visibilityUpdate');
    
    // Update debug overlay if enabled
    if (this.debug && this.debugOverlay) {
      this.debugOverlay.update({
        cameraBounds,
        lastCameraPosition: this.lastCameraPosition
      });
    }
  }
  
  /**
   * Update the renderer - called from scene update
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   */
  update(playerX, playerY) {
    // Skip if not loaded
    if (!this.isMapLoaded) return;
    
    // Update performance monitor
    this.performanceMonitor.update(this.scene.time.now, this.scene.time.deltaTime);
    
    // Update minimap with player position
    if (playerX !== undefined && playerY !== undefined) {
      this.minimapRenderer.updatePlayerPosition(playerX, playerY);
    }
    
    // Update debug overlay if enabled
    if (this.debug && this.debugOverlay) {
      this.debugOverlay.update({
        playerPosition: { x: playerX, y: playerY }
      });
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
    
    // Update debug overlay if enabled
    if (this.debug && this.debugOverlay) {
      this.debugOverlay.handleResize(width, height);
    }
    
    // Force visibility update to adjust for new view dimensions
    this.updateVisibility(true);
    
    // Log the resize event
    if (this.debug) {
      console.log(`Window resized to ${width}x${height}, updating visibility`);
    }
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
   * Get visible structures
   * @returns {Array} - Array of visible structure objects
   */
  getVisibleStructures() {
    return this.structureManager.getVisibleStructures();
  }
  
  /**
   * Force a visibility update with a large buffer
   * Called when initial visibility isn't working
   */
  forceVisibilityUpdate() {
    if (!this.isMapLoaded) return;
    
    // Use a very large buffer to ensure structures are visible
    const extraBuffer = this.tileSize * 20;
    const camera = this.scene.cameras.main;
    
    const expandedBounds = {
      left: camera.scrollX - extraBuffer,
      right: camera.scrollX + camera.width + extraBuffer,
      top: camera.scrollY - extraBuffer,
      bottom: camera.scrollY + camera.height + extraBuffer
    };
    
    if (this.debug) {
      console.log(`Forcing visibility update with large buffer: (${Math.round(expandedBounds.left)},${Math.round(expandedBounds.top)}) - (${Math.round(expandedBounds.right)},${Math.round(expandedBounds.bottom)})`);
    }
    
    // Force update
    this.structureManager.updateVisibility(expandedBounds, true);
    
    // Log how many structures are visible
    if (this.debug) {
      const visibleCount = this.structureManager.getVisibleCount();
      const totalCount = Object.keys(this.structureManager.structures).length;
      console.log(`Force visibility update: ${visibleCount}/${totalCount} structures visible`);
    }
  }
  
  /**
   * Clean up resources when destroying the renderer
   */
  destroy() {
    // Remove event listeners
    if (this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.off('camerascroll', this.onCameraMove);
    }
    
    // Clean up all components
    this.structureManager.destroy();
    this.tileFactory.destroy();
    this.loadingManager.destroy();
    this.minimapRenderer.destroy();
    this.performanceMonitor.destroy();
    
    if (this.debugOverlay) {
      this.debugOverlay.destroy();
      this.debugOverlay = null;
    }
    
    // Reset state
    this.isInitialized = false;
    this.isMapLoaded = false;
    this.isLoading = false;
  }
}
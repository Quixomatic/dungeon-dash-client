// src/managers/DungeonRenderer.js
import { getTemplateById, registerTemplates, getTileColor, TILE_TYPES, generateBasicLayout } from '../data/DungeonTemplates.js';

/**
 * DungeonRenderer - Efficiently renders the dungeon with culling
 */
export class DungeonRenderer {
  constructor(scene) {
    this.scene = scene;
    this.tileSize = 32;
    
    // Layer organization
    this.layers = {
      background: null,
      floor: null,
      walls: null,
      objects: null,
      overlay: null
    };
    
    // Minimap
    this.minimapGraphics = null;
    this.minimapTexture = null;
    this.playerMarker = null;
    this.minimapScale = 0.01; // Scale factor for minimap
    this.minimapSize = 200; // Size of minimap in pixels
    
    // Map data
    this.mapData = null;
    
    // Culling system
    this.visibleTiles = new Map(); // Map of tile IDs to sprites
    this.objectPools = {
      floor: [],
      wall: [],
      object: [],
      corridor: [],
      overlay: []
    };
    
    // Visible region tracking
    this.visibleRegion = {
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0
    };
    
    // Culling buffer (in tiles)
    this.cullingBuffer = 3;
    
    // Spatial index for fast lookups
    this.spatialIndex = null;
    
    // Debug
    this.debug = false;
    this.debugText = null;
    this.renderStats = {
      visibleTiles: 0,
      hiddenTiles: 0,
      poolSize: 0,
      renderTime: 0
    };
  }
  
  /**
   * Initialize the renderer
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    this.debug = options.debug || false;
    this.tileSize = options.tileSize || 32;
    
    // Create layer groups to organize sprites
    this.layers.background = this.scene.add.group();
    this.layers.floor = this.scene.add.group();
    this.layers.walls = this.scene.add.group();
    this.layers.objects = this.scene.add.group();
    this.layers.overlay = this.scene.add.group();
    
    // Set depths to ensure correct rendering order
    this.layers.background.setDepth(5);
    this.layers.floor.setDepth(10);
    this.layers.walls.setDepth(20);
    this.layers.objects.setDepth(30);
    this.layers.overlay.setDepth(100);
    
    // Create minimap
    this.createMinimap();
    
    // Debug text
    if (this.debug) {
      this.debugText = this.scene.add.text(10, 10, "Waiting for map data...", {
        fontSize: '14px',
        fill: '#ffffff',
        backgroundColor: '#00000080',
        padding: { x: 5, y: 5 }
      }).setScrollFactor(0).setDepth(1000);
    }
    
    // Create a background for the world
    this.createWorldBackground();
    
    return this;
  }
  
  /**
   * Create a background for the entire world
   */
  createWorldBackground() {
    // Create a dark background
    this.worldBackground = this.scene.add.rectangle(
      0, 0, 
      this.scene.sys.game.config.width * 10, 
      this.scene.sys.game.config.height * 10,
      0x111111
    );
    this.worldBackground.setOrigin(0.5);
    this.worldBackground.setDepth(1);
    
    // Add a grid pattern
    const gridSize = 500; // Grid cell size
    const gridGraphics = this.scene.add.graphics();
    gridGraphics.lineStyle(1, 0x222222, 0.3);
    
    // Draw horizontal lines
    for (let y = 0; y <= this.scene.sys.game.config.height * 10; y += gridSize) {
      gridGraphics.lineBetween(
        0, y,
        this.scene.sys.game.config.width * 10, y
      );
    }
    
    // Draw vertical lines
    for (let x = 0; x <= this.scene.sys.game.config.width * 10; x += gridSize) {
      gridGraphics.lineBetween(
        x, 0,
        x, this.scene.sys.game.config.height * 10
      );
    }
    
    gridGraphics.setDepth(2);
  }
  
  /**
   * Create the minimap
   */
  createMinimap() {
    // Create a render texture for the minimap
    this.minimapTexture = this.scene.add.renderTexture(
      this.scene.cameras.main.width - this.minimapSize - 10, 
      10,
      this.minimapSize, 
      this.minimapSize
    );
    
    this.minimapTexture.setScrollFactor(0); // Fixed to camera
    this.minimapTexture.setDepth(1000);
    
    // Add background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, this.minimapSize, this.minimapSize);
    bg.lineStyle(1, 0xffffff, 0.8);
    bg.strokeRect(0, 0, this.minimapSize, this.minimapSize);
    
    this.minimapTexture.draw(bg);
    
    // Create player marker (will be updated later)
    this.playerMarker = this.scene.add.graphics();
    this.playerMarker.fillStyle(0x00ff00, 1);
    this.playerMarker.fillCircle(0, 0, 3);
    this.playerMarker.setScrollFactor(0);
    this.playerMarker.setDepth(1001);
    this.playerMarker.setVisible(false);
  }
  
  /**
   * Process and render a new dungeon map
   * @param {Object} mapData - Map data from server
   */
  renderMap(mapData) {
    console.time('mapProcessing');
    
    // Clear any existing map
    this.clearMap();
    
    // Store map data
    this.mapData = mapData;
    
    // Register templates if provided
    if (mapData.templates) {
      registerTemplates(mapData.templates);
    }
    
    // Process rooms and corridors
    this.processMapData();
    
    // Create spatial index for fast lookups
    this.createSpatialIndex();
    
    // Generate minimap
    this.generateMinimap();
    
    // Set camera bounds
    this.setCameraBounds();
    
    // Initial render based on camera position
    this.updateVisibleArea();
    
    // Add floor level text to minimap
    const floorText = this.scene.add.text(
      this.minimapTexture.x + this.minimapSize / 2, 
      this.minimapTexture.y + this.minimapSize - 15,
      `Floor ${mapData.floorLevel || 1}`,
      { fontSize: '12px', fill: '#ffffff' }
    ).setScrollFactor(0).setOrigin(0.5).setDepth(1001);
    
    // Update debug info
    if (this.debug && this.debugText) {
      this.debugText.setText(`Map loaded: ${this.mapData.worldSize}x${this.mapData.worldSize}, ${this.mapData.rooms.length} rooms`);
    }
    
    console.timeEnd('mapProcessing');
  }
  
  /**
   * Set camera bounds based on world size
   */
  setCameraBounds() {
    if (!this.mapData) return;
    
    this.scene.cameras.main.setBounds(
      0, 0, 
      this.mapData.worldSize,
      this.mapData.worldSize
    );
  }
  
  /**
   * Process map data to prepare for rendering
   */
  processMapData() {
    if (!this.mapData) return;
    
    // Process rooms
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach(room => {
        // Expand template references
        if (room.t) {
          const template = getTemplateById(room.t);
          if (template) {
            room.template = template;
            room.layout = template.layout;
            room.objects = template.objects;
          }
        }
        
        // Generate layout if not present
        if (!room.layout) {
          room.layout = generateBasicLayout(room.width, room.height);
        }
      });
    }
    
    // Standardize corridor properties
    if (this.mapData.corridors) {
      this.mapData.corridors.forEach(corridor => {
        // Standardize properties
        if (!corridor.start && corridor.s) {
          corridor.start = corridor.s;
        }
        
        if (!corridor.end && corridor.e) {
          corridor.end = corridor.e;
        }
        
        if (!corridor.waypoint && corridor.w) {
          corridor.waypoint = corridor.w;
        }
        
        // Default width
        if (!corridor.width) {
          corridor.width = 3;
        }
      });
    }
  }
  
  /**
   * Create a spatial index for efficient culling
   */
  createSpatialIndex() {
    // Grid-based spatial index
    this.spatialIndex = new Map();
    const cellSize = 100; // Cells are 100x100 tiles
    
    // Index rooms
    if (this.mapData && this.mapData.rooms) {
      this.mapData.rooms.forEach(room => {
        // Calculate cells this room occupies
        const startCellX = Math.floor(room.x / cellSize);
        const startCell
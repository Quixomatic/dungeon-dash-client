// src/dungeonRenderer/ui/DebugOverlay.js
/**
 * DebugOverlay - Provides visualization and statistics for dungeon renderer
 * Displays performance metrics, visibility culling boundaries, and other debug info
 */
export class DebugOverlay {
    constructor(scene) {
      this.scene = scene;
      this.container = null;
      this.graphics = null;
      this.statsPanel = null;
      this.structureLabels = {};
      this.fpsHistory = [];
      this.fpsUpdateCounter = 0;
      
      // Debug settings
      this.showRoomBounds = true;
      this.showCullingBounds = true;
      this.showTileCoords = false;
      this.showStructureIds = true;
      this.showPerformanceMetrics = true;
      this.showVisibilityInfo = true;
      
      // Visual styles
      this.cullingBoundsColor = 0x00ff00;
      this.roomBoundsColor = 0xff00ff;
      this.structureLabelColor = '#ffff00';
      this.coordsColor = '#00ffff';
      this.wallOutlineColor = 0xff0000;
      
      // Reference to other components
      this.dungeonRenderer = null;
      this.structureRenderer = null;
      this.visibilityCulling = null;
      
      // UI elements for controls
      this.controls = {
        panel: null,
        buttons: {},
        sliders: {},
        checkboxes: {}
      };
      
      // Performance tracking
      this.frameTimeHistory = [];
      this.lastFrameTime = 0;
      this.renderTimeHistory = [];
      this.objectCountHistory = [];
      this.lastRenderTime = 0;
      this.maxHistoryLength = 100; // Number of frames to track
      
      // Expanded state
      this.isExpanded = false;
    }
    
    /**
     * Initialize the debug overlay
     * @param {Object} options - Initialization options
     */
    init(options = {}) {
      // Apply options
      if (options.showRoomBounds !== undefined) this.showRoomBounds = options.showRoomBounds;
      if (options.showCullingBounds !== undefined) this.showCullingBounds = options.showCullingBounds;
      if (options.showTileCoords !== undefined) this.showTileCoords = options.showTileCoords;
      if (options.showStructureIds !== undefined) this.showStructureIds = options.showStructureIds;
      if (options.showPerformanceMetrics !== undefined) this.showPerformanceMetrics = options.showPerformanceMetrics;
      
      // Store references to other components
      this.dungeonRenderer = options.dungeonRenderer || null;
      this.structureRenderer = options.structureRenderer || null;
      this.visibilityCulling = options.visibilityCulling || null;
      
      // Create container
      this.container = this.scene.add.container(0, 0);
      this.container.setDepth(2000); // Above everything
      this.container.setScrollFactor(0); // Fixed to camera
      
      // Create graphics for drawing
      this.graphics = this.scene.add.graphics();
      this.graphics.setDepth(1999); // Just below UI elements
      
      // Create stats panel
      this.createStatsPanel();
      
      // Create control panel
      this.createControlPanel();
      
      // Set up update handlers
      this.setupUpdateHandlers();
      
      return this;
    }
    
    /**
     * Create the stats panel UI
     */
    createStatsPanel() {
      // Get camera dimensions
      const width = this.scene.cameras.main.width;
      
      // Create panel background
      const panelBg = this.scene.add.rectangle(
        10, 10, 200, 150,
        0x000000, 0.7
      ).setOrigin(0, 0);
      
      // Create panel border
      const panelBorder = this.scene.add.rectangle(
        10, 10, 200, 150,
        0x333333, 0
      ).setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, 0.5);
      
      // Create header
      const header = this.scene.add.text(
        20, 15, 
        'RENDERER DEBUG', 
        { 
          fontSize: '14px', 
          fontStyle: 'bold',
          fill: '#ffffff' 
        }
      );
      
      // Create FPS counter
      this.fpsText = this.scene.add.text(
        20, 40,
        'FPS: --',
        { fontSize: '12px', fill: '#00ff00' }
      );
      
      // Create visible objects counter
      this.objectsText = this.scene.add.text(
        20, 60,
        'Objects: --/--',
        { fontSize: '12px', fill: '#ffffff' }
      );
      
      // Create structures counter
      this.structuresText = this.scene.add.text(
        20, 80,
        'Structures: --/--',
        { fontSize: '12px', fill: '#ffffff' }
      );
      
      // Create cullling stats
      this.cullingText = this.scene.add.text(
        20, 100,
        'Culling: -- tiles',
        { fontSize: '12px', fill: '#ffffff' }
      );
      
      // Create render time counter
      this.renderTimeText = this.scene.add.text(
        20, 120,
        'Render: -- ms',
        { fontSize: '12px', fill: '#ffffff' }
      );
      
      // Create memory usage info
      this.memoryText = this.scene.add.text(
        20, 140,
        'Memory: -- MB',
        { fontSize: '12px', fill: '#ffffff' }
      );
      
      // Create toggle button (minimizer)
      this.toggleButton = this.scene.add.text(
        195, 15, 
        '-', 
        { 
          fontSize: '14px', 
          fontStyle: 'bold',
          fill: '#ffffff',
          backgroundColor: '#444444',
          padding: { x: 4, y: 2 }
        }
      ).setOrigin(1, 0)
        .setInteractive({ useHandCursor: true });
      
      // Add click handler for toggle button
      this.toggleButton.on('pointerdown', () => {
        this.toggleExpanded();
      });
      
      // Add everything to the stats panel
      this.statsPanel = this.scene.add.container(0, 0);
      this.statsPanel.add([
        panelBg,
        panelBorder,
        header,
        this.fpsText,
        this.objectsText,
        this.structuresText,
        this.cullingText,
        this.renderTimeText,
        this.memoryText,
        this.toggleButton
      ]);
      
      // Add to main container
      this.container.add(this.statsPanel);
    }
    
    /**
     * Create the debug control panel UI
     */
    createControlPanel() {
      // Get camera dimensions
      const width = this.scene.cameras.main.width;
      const height = this.scene.cameras.main.height;
      
      // Create panel container positioned at bottom of screen
      this.controls.panel = this.scene.add.container(10, height - 40);
      
      // Create panel background with room to expand
      this.controls.background = this.scene.add.rectangle(
        0, 0, 
        width - 20, 30,
        0x000000, 0.7
      ).setOrigin(0, 1);
      
      // Create panel border
      this.controls.border = this.scene.add.rectangle(
        0, 0, 
        width - 20, 30,
        0x333333, 0
      ).setOrigin(0, 1)
        .setStrokeStyle(1, 0xffffff, 0.5);
      
      // Create header/toggle button
      this.controls.header = this.scene.add.text(
        10, -15,
        'DEBUG CONTROLS',
        { 
          fontSize: '12px', 
          fontStyle: 'bold',
          fill: '#ffffff',
          backgroundColor: '#333333',
          padding: { x: 5, y: 3 }
        }
      ).setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      
      // Add click handler for header
      this.controls.header.on('pointerdown', () => {
        this.toggleControlPanel();
      });
      
      // Add basic elements to panel
      this.controls.panel.add([
        this.controls.background,
        this.controls.border,
        this.controls.header
      ]);
      
      // Create checkboxes for toggles
      this.createControlCheckboxes();
      
      // Add to main container
      this.container.add(this.controls.panel);
      
      // Initially collapsed
      this.collapseControlPanel();
    }
    
    /**
     * Create checkbox controls
     */
    createControlCheckboxes() {
      // Create controls in a horizontal row
      const checkboxes = [
        { id: 'showRoomBounds', label: 'Room Bounds', value: this.showRoomBounds },
        { id: 'showCullingBounds', label: 'Culling', value: this.showCullingBounds },
        { id: 'showTileCoords', label: 'Coordinates', value: this.showTileCoords },
        { id: 'showStructureIds', label: 'IDs', value: this.showStructureIds },
        { id: 'showPerformanceMetrics', label: 'Performance', value: this.showPerformanceMetrics }
      ];
      
      // Create each checkbox
      checkboxes.forEach((checkbox, index) => {
        const x = 10 + index * 120;
        const y = -15;
        
        // Container for the checkbox group
        const group = this.scene.add.container(x, y);
        
        // Checkbox box
        const box = this.scene.add.rectangle(
          0, 0, 12, 12, 
          0x444444, 1
        ).setOrigin(0, 0.5)
          .setStrokeStyle(1, 0xffffff, 0.8);
        
        // Checkbox check mark (only visible when checked)
        const check = this.scene.add.text(
          0, 0, '✓', 
          { fontSize: '10px', fill: '#ffffff' }
        ).setOrigin(0.5, 0.5);
        check.x = box.x + box.width / 2;
        check.y = box.y;
        check.visible = checkbox.value;
        
        // Label
        const label = this.scene.add.text(
          box.x + box.width + 5, box.y,
          checkbox.label,
          { fontSize: '12px', fill: '#ffffff' }
        ).setOrigin(0, 0.5);
        
        // Make interactive
        box.setInteractive({ useHandCursor: true });
        label.setInteractive({ useHandCursor: true });
        
        // Add pointer handlers
        const toggleCheck = () => {
          // Toggle value
          checkbox.value = !checkbox.value;
          check.visible = checkbox.value;
          
          // Update corresponding setting
          this[checkbox.id] = checkbox.value;
        };
        
        box.on('pointerdown', toggleCheck);
        label.on('pointerdown', toggleCheck);
        
        // Add to group
        group.add([box, check, label]);
        
        // Store for later access
        this.controls.checkboxes[checkbox.id] = {
          group,
          box,
          check,
          label,
          value: checkbox.value
        };
        
        // Add to panel
        this.controls.panel.add(group);
      });
    }
    
    /**
     * Set up update handlers for tracking frame times and metrics
     */
    setupUpdateHandlers() {
      // Track frame time every frame
      this.scene.events.on('preupdate', (time, delta) => {
        const frameTime = delta;
        
        // Add to history
        this.frameTimeHistory.push(frameTime);
        
        // Keep history at max length
        if (this.frameTimeHistory.length > this.maxHistoryLength) {
          this.frameTimeHistory.shift();
        }
        
        // Update counter for FPS updates
        this.fpsUpdateCounter++;
        
        // Update FPS text less frequently to avoid flicker
        if (this.fpsUpdateCounter >= 30) {
          this.updateFpsText();
          this.fpsUpdateCounter = 0;
          
          // Also update memory usage periodically
          this.updateMemoryDisplay();
        }
      });
      
      // Track other metrics in render update
      this.scene.events.on('postupdate', (time, delta) => {
        // Record render time
        const renderTime = time - this.lastFrameTime;
        this.lastFrameTime = time;
        
        // Add to history
        this.renderTimeHistory.push(renderTime);
        
        // Keep history at max length
        if (this.renderTimeHistory.length > this.maxHistoryLength) {
          this.renderTimeHistory.shift();
        }
        
        // Update object counts if we have the references
        this.updateObjectCounts();
      });
    }
    
    /**
     * Toggle expanded/collapsed state
     */
    toggleExpanded() {
      this.isExpanded = !this.isExpanded;
      
      if (this.isExpanded) {
        // Show all metrics
        this.fpsText.setVisible(true);
        this.objectsText.setVisible(true);
        this.structuresText.setVisible(true);
        this.cullingText.setVisible(true);
        this.renderTimeText.setVisible(true);
        this.memoryText.setVisible(true);
        
        // Set panel height
        if (this.statsPanel.getBounds) {
          const bounds = this.statsPanel.getBounds();
          bounds.height = 150;
        }
        
        // Update toggle button
        this.toggleButton.setText('-');
      } else {
        // Only show FPS
        this.fpsText.setVisible(true);
        this.objectsText.setVisible(false);
        this.structuresText.setVisible(false);
        this.cullingText.setVisible(false);
        this.renderTimeText.setVisible(false);
        this.memoryText.setVisible(false);
        
        // Set panel height
        if (this.statsPanel.getBounds) {
          const bounds = this.statsPanel.getBounds();
          bounds.height = 60;
        }
        
        // Update toggle button
        this.toggleButton.setText('+');
      }
      
      // Update panel bg
      const panelBg = this.statsPanel.getAt(0);
      if (panelBg) {
        panelBg.height = this.isExpanded ? 150 : 60;
      }
      
      // Update border
      const panelBorder = this.statsPanel.getAt(1);
      if (panelBorder) {
        panelBorder.height = this.isExpanded ? 150 : 60;
      }
    }
    
    /**
     * Toggle control panel expanded/collapsed state
     */
    toggleControlPanel() {
      if (this.controls.expanded) {
        this.collapseControlPanel();
      } else {
        this.expandControlPanel();
      }
    }
    
    /**
     * Expand the control panel
     */
    expandControlPanel() {
      // Set flag
      this.controls.expanded = true;
      
      // Update background height
      this.controls.background.height = 100;
      this.controls.border.height = 100;
      
      // Show checkboxes
      Object.values(this.controls.checkboxes).forEach(checkbox => {
        checkbox.group.setVisible(true);
      });
    }
    
    /**
     * Collapse the control panel
     */
    collapseControlPanel() {
      // Set flag
      this.controls.expanded = false;
      
      // Update background height
      this.controls.background.height = 30;
      this.controls.border.height = 30;
      
      // Hide checkboxes
      Object.values(this.controls.checkboxes).forEach(checkbox => {
        checkbox.group.setVisible(false);
      });
    }
    
    /**
     * Update FPS display
     */
    updateFpsText() {
      if (!this.fpsText) return;
      
      // Calculate average FPS
      const fps = Math.round(1000 / this.calculateAverage(this.frameTimeHistory));
      
      // Add to FPS history
      this.fpsHistory.push(fps);
      
      // Keep history limited
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }
      
      // Calculate stable average of recent FPS values
      const stableFps = Math.round(this.calculateAverage(this.fpsHistory));
      
      // Update text with color based on performance
      let color = '#00ff00'; // Green for good FPS
      
      if (stableFps < 30) {
        color = '#ff0000'; // Red for bad FPS
      } else if (stableFps < 55) {
        color = '#ffff00'; // Yellow for mediocre FPS
      }
      
      this.fpsText.setText(`FPS: ${stableFps}`);
      this.fpsText.setColor(color);
    }
    
    /**
     * Update memory usage display
     */
    updateMemoryDisplay() {
      if (!this.memoryText) return;
      
      // Get memory info if available
      if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        const usedMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
        const totalMB = Math.round(memory.totalJSHeapSize / (1024 * 1024));
        
        this.memoryText.setText(`Memory: ${usedMB}MB / ${totalMB}MB`);
        
        // Color based on usage
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        let color = '#00ff00'; // Green for good memory usage
        
        if (usageRatio > 0.8) {
          color = '#ff0000'; // Red for high memory usage
        } else if (usageRatio > 0.5) {
          color = '#ffff00'; // Yellow for medium memory usage
        }
        
        this.memoryText.setColor(color);
      } else {
        this.memoryText.setText('Memory: Not available');
        this.memoryText.setColor('#999999');
      }
    }
    
    /**
     * Update object count displays
     */
    updateObjectCounts() {
      // Skip if elements don't exist
      if (!this.objectsText || !this.structuresText) return;
      
      // Get structure counts if available
      let visibleStructures = 0;
      let totalStructures = 0;
      
      if (this.structureRenderer) {
        visibleStructures = this.structureRenderer.getVisibleCount();
        totalStructures = Object.keys(this.structureRenderer.structures || {}).length;
        
        this.structuresText.setText(`Structures: ${visibleStructures}/${totalStructures}`);
      }
      
      // Count game objects
      const displayList = this.scene.children.list || [];
      const numObjects = displayList.length;
      const numVisible = displayList.filter(obj => obj.visible).length;
      
      this.objectsText.setText(`Objects: ${numVisible}/${numObjects}`);
      
      // Update render time
      const avgRenderTime = this.calculateAverage(this.renderTimeHistory).toFixed(2);
      this.renderTimeText.setText(`Render: ${avgRenderTime} ms`);
      
      // Update culling stats if available
      if (this.visibilityCulling && this.dungeonRenderer) {
        const tileSize = this.dungeonRenderer.tileSize || 64;
        const camera = this.scene.cameras.main;
        
        // Calculate visible tile area
        const visibleTilesX = Math.ceil(camera.width / tileSize);
        const visibleTilesY = Math.ceil(camera.height / tileSize);
        const visibleTiles = visibleTilesX * visibleTilesY;
        
        this.cullingText.setText(`Culling: ~${visibleTiles} tiles`);
      }
    }
    
    /**
     * Update the debug overlay
     * @param {Object} debugInfo - Debug information
     */
    update(debugInfo = {}) {
      // Clear previous debug graphics
      this.graphics.clear();
      
      // Skip if not visible
      if (!this.container.visible) return;
      
      // Combine passed debug info with component references
      const info = {
        ...debugInfo,
        dungeonRenderer: this.dungeonRenderer,
        structureRenderer: this.structureRenderer,
        visibilityCulling: this.visibilityCulling
      };
      
      // Draw debug visualizations based on current settings
      this.drawCameraBounds(info);
      this.drawRoomBounds(info);
      this.drawStructureLabels(info);
      this.drawTileCoordinates(info);
      
      // Update performance graph if expanded and enabled
      if (this.isExpanded && this.showPerformanceMetrics) {
        this.drawPerformanceGraph();
      }
    }
    
    /**
     * Draw camera and culling bounds
     */
    drawCameraBounds(info) {
      if (!this.showCullingBounds) return;
      
      const camera = this.scene.cameras.main;
      
      // Draw camera viewport bounds
      this.graphics.lineStyle(1, this.cullingBoundsColor, 0.8);
      this.graphics.strokeRect(
        camera.scrollX, 
        camera.scrollY, 
        camera.width, 
        camera.height
      );
      
      // Draw expanded culling bounds if visibility culling exists
      if (info.visibilityCulling) {
        const tileSize = (info.dungeonRenderer?.tileSize || 64);
        const bufferTiles = 10; // Should match the buffer in VisibilityCulling
        const bufferSize = bufferTiles * tileSize;
        
        this.graphics.lineStyle(1, this.cullingBoundsColor, 0.4);
        this.graphics.strokeRect(
          camera.scrollX - bufferSize, 
          camera.scrollY - bufferSize, 
          camera.width + bufferSize * 2, 
          camera.height + bufferSize * 2
        );
      }
    }
    
    /**
     * Draw room bounds for all visible structures
     */
    drawRoomBounds(info) {
      if (!this.showRoomBounds || !info.structureRenderer) return;
      
      const tileSize = (info.dungeonRenderer?.tileSize || 64);
      const structures = info.structureRenderer.getVisibleStructures();
      
      // Draw bounds for each visible structure
      structures.forEach(structure => {
        const bounds = structure.bounds;
        const x = bounds.x * tileSize;
        const y = bounds.y * tileSize;
        const width = bounds.width * tileSize;
        const height = bounds.height * tileSize;
        
        // Draw the bounds based on structure type
        let color = this.roomBoundsColor;
        let alpha = 0.4;
        
        if (structure.type === 'spawnRoom') {
          color = 0x8800ff; // Purple for spawn rooms
          alpha = 0.5;
        } else if (structure.type === 'corridor') {
          color = 0x00ffff; // Cyan for corridors
          alpha = 0.3;
        }
        
        // Draw filled rectangle with border
        this.graphics.lineStyle(2, color, alpha * 2);
        this.graphics.strokeRect(x, y, width, height);
        
        // If the structure has an original data reference, draw inner bounds too
        if (structure.originalStructure) {
          const original = structure.originalStructure;
          const innerX = original.x * tileSize;
          const innerY = original.y * tileSize;
          const innerWidth = original.width * tileSize;
          const innerHeight = original.height * tileSize;
          
          // Draw inner original bounds
          this.graphics.lineStyle(1, color, alpha * 3);
          this.graphics.strokeRect(innerX, innerY, innerWidth, innerHeight);
        }
      });
    }
    
    /**
     * Draw structure labels
     */
    drawStructureLabels(info) {
      if (!this.showStructureIds || !info.structureRenderer) return;
      
      const tileSize = (info.dungeonRenderer?.tileSize || 64);
      const structures = info.structureRenderer.getVisibleStructures();
      const camera = this.scene.cameras.main;
      
      // Clear old structure labels
      Object.keys(this.structureLabels).forEach(id => {
        if (!info.structureRenderer.isStructureVisible(id)) {
          if (this.structureLabels[id]) {
            this.structureLabels[id].destroy();
            delete this.structureLabels[id];
          }
        }
      });
      
      // Create or update labels for visible structures
      structures.forEach(structure => {
        const id = structure.container.name;
        const bounds = structure.bounds;
        const x = bounds.x * tileSize + bounds.width * tileSize / 2;
        const y = bounds.y * tileSize + 20;
        
        // Create label if it doesn't exist
        if (!this.structureLabels[id]) {
          this.structureLabels[id] = this.scene.add.text(
            x, y,
            id,
            { 
              fontSize: '12px', 
              fontStyle: 'bold',
              fill: this.structureLabelColor,
              backgroundColor: '#00000080',
              padding: { x: 3, y: 2 }
            }
          ).setOrigin(0.5, 0)
           .setDepth(1500);
          
          // Add to container
          this.container.add(this.structureLabels[id]);
        } else {
          // Update position
          this.structureLabels[id].x = x;
          this.structureLabels[id].y = y;
        }
        
        // Update text to show visibility status
        this.structureLabels[id].setText(`${id} [${structure.type}]`);
        
        // Adjust scroll factor
        this.structureLabels[id].setScrollFactor(1);
      });
    }
    
    /**
     * Draw tile coordinates grid
     */
    drawTileCoordinates(info) {
      if (!this.showTileCoords || !info.dungeonRenderer) return;
      
      const tileSize = info.dungeonRenderer.tileSize || 64;
      const camera = this.scene.cameras.main;
      
      // Only draw coordinates for tiles in view
      const startTileX = Math.floor(camera.scrollX / tileSize);
      const endTileX = Math.ceil((camera.scrollX + camera.width) / tileSize);
      const startTileY = Math.floor(camera.scrollY / tileSize);
      const endTileY = Math.ceil((camera.scrollY + camera.height) / tileSize);
      
      // Draw grid lines
      this.graphics.lineStyle(1, 0x444444, 0.3);
      
      // Vertical lines
      for (let x = startTileX; x <= endTileX; x++) {
        this.graphics.lineBetween(
          x * tileSize, camera.scrollY,
          x * tileSize, camera.scrollY + camera.height
        );
      }
      
      // Horizontal lines
      for (let y = startTileY; y <= endTileY; y++) {
        this.graphics.lineBetween(
          camera.scrollX, y * tileSize,
          camera.scrollX + camera.width, y * tileSize
        );
      }
      
      // Create or update coordinate labels
      for (let y = startTileY; y <= endTileY; y += 5) {
        for (let x = startTileX; x <= endTileX; x += 5) {
          // Only show some coordinates to avoid clutter
          if ((x % 5 === 0 && y % 5 === 0) || (x === 0 && y === 0)) {
            const id = `coord_${x}_${y}`;
            const worldX = x * tileSize + tileSize / 2;
            const worldY = y * tileSize + tileSize / 2;
            
            if (!this.structureLabels[id]) {
              // Create label
              this.structureLabels[id] = this.scene.add.text(
                worldX, worldY,
                `${x},${y}`,
                {
                  fontSize: '10px',
                  fill: this.coordsColor,
                  backgroundColor: '#00000040',
                  padding: { x: 2, y: 1 }
                }
              ).setOrigin(0.5)
               .setDepth(1500)
               .setScrollFactor(1);
              
              // Add to container
              this.container.add(this.structureLabels[id]);
            } else {
              // Update text and position
              this.structureLabels[id].setText(`${x},${y}`);
              this.structureLabels[id].x = worldX;
              this.structureLabels[id].y = worldY;
            }
          }
        }
      }
    }
    
    /**
     * Draw a performance graph
     */
    drawPerformanceGraph() {
      if (this.frameTimeHistory.length < 2) return;
      
      const width = 190;
      const height = 60;
      const x = 10;
      const y = 170; // Below stats panel
      
      // Draw background
      this.graphics.fillStyle(0x000000, 0.5);
      this.graphics.fillRect(x, y, width, height);
      
      // Draw border
      this.graphics.lineStyle(1, 0x666666, 0.5);
      this.graphics.strokeRect(x, y, width, height);
      
      // Draw FPS graph
      this.graphics.lineStyle(1, 0x00ff00, 0.8);
      
      // Calculate scale
      const maxFrameTime = 33.33; // 30 FPS
      const scaleY = height / maxFrameTime;
      const scaleX = width / this.frameTimeHistory.length;
      
      // Draw horizontal lines
      this.graphics.lineStyle(1, 0x666666, 0.3);
      
      // 60 FPS line
      let lineY = y + height - (1000 / 60) * scaleY;
      this.graphics.lineBetween(x, lineY, x + width, lineY);
      
      // 30 FPS line
      lineY = y + height - (1000 / 30) * scaleY;
      this.graphics.lineBetween(x, lineY, x + width, lineY);
      
      // Start drawing graph line
      this.graphics.lineStyle(1, 0x00ff00, 0.8);
      
      // Convert frame times to FPS for more intuitive graph
      const fpsValues = this.frameTimeHistory.map(time => 1000 / time);
      
      this.graphics.beginPath();
      this.graphics.moveTo(x, y + height - fpsValues[0] * height / 60);
      
      for (let i = 1; i < fpsValues.length; i++) {
        const pointX = x + i * scaleX;
        const pointY = y + height - (fpsValues[i] * height / 60);
        this.graphics.lineTo(pointX, pointY);
      }
      
      this.graphics.strokePath();
    }
    
    /**
     * Calculate average value in an array
     * @param {Array} array - Array of numbers
     * @returns {number} - Average value
     */
    calculateAverage(array) {
      if (!array || array.length === 0) return 0;
      
      const sum = array.reduce((acc, val) => acc + val, 0);
      return sum / array.length;
    }
    
    /**
     * Handle resize event
     * @param {number} width - New width
     * @param {number} height - New height
     */
    handleResize(width, height) {
      // Update control panel position
      if (this.controls.panel) {
        this.controls.panel.y = height - 40;
        
        // Update background width
        if (this.controls.background) {
          this.controls.background.width = width - 20;
        }
        
        // Update border width
        if (this.controls.border) {
          this.controls.border.width = width - 20;
        }
      }
      
      return this;
    }
    
    /**
     * Set visibility of debug overlay
     * @param {boolean} visible - Whether overlay should be visible
     */
    setVisible(visible) {
      this.container.setVisible(visible);
      this.graphics.setVisible(visible);
      return this;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
      // Clear structure labels
      Object.values(this.structureLabels).forEach(label => {
        if (label && label.destroy) {
          label.destroy();
        }
      });
      this.structureLabels = {};
      
      // Clear event listeners
      this.scene.events.off('preupdate', this.updateHandler);
      this.scene.events.off('postupdate', this.updateHandler);
      
      // Destroy elements
      if (this.graphics) {
        this.graphics.destroy();
        this.graphics = null;
      }
      
      if (this.statsPanel) {
        this.statsPanel.destroy(true);
        this.statsPanel = null;
      }
      
      if (this.controls.panel) {
        this.controls.panel.destroy(true);
        this.controls.panel = null;
      }
      
      if (this.container) {
        this.container.destroy(true);
        this.container = null;
      }
    }
  }
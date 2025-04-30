// src/managers/DungeonRenderer.js
export class DungeonRenderer {
    constructor(scene) {
      this.scene = scene;
      this.tileSize = 32;
      this.floorColor = 0x333333;
      this.wallColor = 0x666666;
      this.corridorColor = 0x444444;
      this.layers = {
        floor: null,
        walls: null,
        overlay: null
      };
      this.minimapGraphics = null;
      this.minimapScale = 0.1;
      this.mapData = null;
    }
    
    init() {
      // Create layer groups to organize sprites
      this.layers.floor = this.scene.add.group();
      this.layers.walls = this.scene.add.group();
      this.layers.overlay = this.scene.add.group();
      
      // Create minimap
      this.minimapGraphics = this.scene.add.graphics();
      this.minimapGraphics.setScrollFactor(0); // Fixed to camera
      this.minimapGraphics.x = this.scene.cameras.main.width - 210;
      this.minimapGraphics.y = 10;
      
      // Debug text for visibility during development
      this.debugText = this.scene.add.text(10, 10, "Waiting for map data...", {
        fontSize: '16px',
        fill: '#ffffff'
      }).setScrollFactor(0);
    }
    
    renderMap(mapData) {
      // Store map data
      this.mapData = mapData;
      
      // Debug output to confirm we received map data
      console.log("Rendering map:", mapData);
      this.debugText.setText(`Rendering floor ${mapData.floorLevel}: ${mapData.rooms.length} rooms, ${mapData.corridors.length} corridors`);
      
      // Clear existing map
      this.clearMap();
      
      // Render rooms first
      for (const room of mapData.rooms) {
        this.renderRoom(room);
      }
      
      // Render corridors
      for (const corridor of mapData.corridors) {
        this.renderCorridor(corridor);
      }
      
      // Update minimap
      this.updateMinimap();
    }
    
    clearMap() {
      // Clear all layers
      this.layers.floor.clear(true, true);
      this.layers.walls.clear(true, true);
      this.layers.overlay.clear(true, true);
      
      // Clear minimap
      if (this.minimapGraphics) {
        this.minimapGraphics.clear();
      }
    }
    
    renderRoom(room) {
      // Different colors for different room types
      let floorColor, wallColor;
      
      switch (room.type) {
        case 'spawn':
          floorColor = 0x8888ff;
          wallColor = 0x4444aa;
          break;
        case 'treasure':
          floorColor = 0xffff88;
          wallColor = 0xaaaa44;
          break;
        case 'monster':
          floorColor = 0xff8888;
          wallColor = 0xaa4444;
          break;
        case 'boss':
          floorColor = 0xff44ff;
          wallColor = 0xaa22aa;
          break;
        case 'shop':
          floorColor = 0x88ffff;
          wallColor = 0x44aaaa;
          break;
        default:
          floorColor = this.floorColor;
          wallColor = this.wallColor;
      }
      
      // Draw floor
      for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
        for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
          const floorTile = this.scene.add.rectangle(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            this.tileSize,
            this.tileSize,
            floorColor
          );
          
          this.layers.floor.add(floorTile);
        }
      }
      
      // Draw walls
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (
            x === room.x || x === room.x + room.width - 1 ||
            y === room.y || y === room.y + room.height - 1
          ) {
            const wallTile = this.scene.add.rectangle(
              x * this.tileSize + this.tileSize / 2,
              y * this.tileSize + this.tileSize / 2,
              this.tileSize,
              this.tileSize,
              wallColor
            );
            
            this.layers.walls.add(wallTile);
          }
        }
      }
      
      // Add room label (for development)
      if (room.type !== 'normal') {
        const text = this.scene.add.text(
          (room.x + room.width / 2) * this.tileSize,
          (room.y + room.height / 2) * this.tileSize,
          room.type,
          {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 3, y: 2 }
          }
        ).setOrigin(0.5);
        
        this.layers.overlay.add(text);
      }
    }
    
    renderCorridor(corridor) {
      // Render corridor segments
      if (corridor.waypoint) {
        // First segment: start to waypoint
        this.renderCorridorSegment(corridor.start, corridor.waypoint);
        
        // Second segment: waypoint to end
        this.renderCorridorSegment(corridor.waypoint, corridor.end);
      } else {
        // Direct segment: start to end
        this.renderCorridorSegment(corridor.start, corridor.end);
      }
    }
    
    renderCorridorSegment(start, end) {
      const isHorizontal = Math.abs(end.x - start.x) > Math.abs(end.y - start.y);
      
      if (isHorizontal) {
        // Horizontal corridor
        const x1 = Math.min(start.x, end.x);
        const x2 = Math.max(start.x, end.x);
        const y = start.y;
        
        // Draw floor
        for (let x = x1; x <= x2; x++) {
          const floorTile = this.scene.add.rectangle(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            this.tileSize,
            this.tileSize,
            this.corridorColor
          );
          
          this.layers.floor.add(floorTile);
        }
      } else {
        // Vertical corridor
        const y1 = Math.min(start.y, end.y);
        const y2 = Math.max(start.y, end.y);
        const x = start.x;
        
        // Draw floor
        for (let y = y1; y <= y2; y++) {
          const floorTile = this.scene.add.rectangle(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            this.tileSize,
            this.tileSize,
            this.corridorColor
          );
          
          this.layers.floor.add(floorTile);
        }
      }
    }
    
    updateMinimap() {
      if (!this.mapData) return;
      
      // Clear previous minimap
      this.minimapGraphics.clear();
      
      // Draw background
      this.minimapGraphics.fillStyle(0x000000, 0.7);
      this.minimapGraphics.fillRect(0, 0, 200, 200);
      
      // Draw rooms
      for (const room of this.mapData.rooms) {
        // Select color based on room type
        let color;
        switch (room.type) {
          case 'spawn': color = 0x8888ff; break;
          case 'treasure': color = 0xffff88; break;
          case 'monster': color = 0xff8888; break;
          case 'boss': color = 0xff44ff; break;
          case 'shop': color = 0x88ffff; break;
          default: color = 0xaaaaaa;
        }
        
        this.minimapGraphics.fillStyle(color, 1);
        this.minimapGraphics.fillRect(
          room.x * this.tileSize * this.minimapScale,
          room.y * this.tileSize * this.minimapScale,
          room.width * this.tileSize * this.minimapScale,
          room.height * this.tileSize * this.minimapScale
        );
      }
      
      // Draw corridors
      this.minimapGraphics.fillStyle(0x777777, 1);
      
      for (const corridor of this.mapData.corridors) {
        if (corridor.waypoint) {
          this.drawMinimapCorridorSegment(corridor.start, corridor.waypoint);
          this.drawMinimapCorridorSegment(corridor.waypoint, corridor.end);
        } else {
          this.drawMinimapCorridorSegment(corridor.start, corridor.end);
        }
      }
      
      // Add floor label
      this.minimapGraphics.lineStyle(1, 0xffffff, 0.8);
      this.minimapGraphics.strokeRect(0, 0, 200, 200);
      
      const floorText = this.scene.add.text(
        this.minimapGraphics.x + 100, 
        this.minimapGraphics.y + 185,
        `Floor ${this.mapData.floorLevel}`,
        { fontSize: '14px', fill: '#ffffff' }
      ).setScrollFactor(0).setOrigin(0.5);
    }
    
    drawMinimapCorridorSegment(start, end) {
      const isHorizontal = Math.abs(end.x - start.x) > Math.abs(end.y - start.y);
      
      if (isHorizontal) {
        // Horizontal corridor
        const x1 = Math.min(start.x, end.x);
        const x2 = Math.max(start.x, end.x);
        const y = start.y;
        
        this.minimapGraphics.fillRect(
          x1 * this.tileSize * this.minimapScale,
          y * this.tileSize * this.minimapScale,
          (x2 - x1 + 1) * this.tileSize * this.minimapScale,
          this.tileSize * this.minimapScale
        );
      } else {
        // Vertical corridor
        const y1 = Math.min(start.y, end.y);
        const y2 = Math.max(start.y, end.y);
        const x = start.x;
        
        this.minimapGraphics.fillRect(
          x * this.tileSize * this.minimapScale,
          y1 * this.tileSize * this.minimapScale,
          this.tileSize * this.minimapScale,
          (y2 - y1 + 1) * this.tileSize * this.minimapScale
        );
      }
    }
    
    updateMinimapPlayer(x, y) {
      // Skip if no minimap
      if (!this.minimapGraphics) return;
      
      // Draw player marker on minimap
      this.minimapGraphics.fillStyle(0x00ff00, 1);
      this.minimapGraphics.fillCircle(
        x * this.minimapScale,
        y * this.minimapScale,
        3
      );
    }
  }
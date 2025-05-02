// src/managers/DungeonNetworkHandler.js
import { registerTemplates } from "../data/DungeonTemplates.js";

/**
 * DungeonNetworkHandler - Handles dungeon-related network messages
 */
export class DungeonNetworkHandler {
  constructor(scene) {
    this.scene = scene;
    this.room = null;
    this.onMapDataReceived = null;
    this.onTeleported = null;
    this.debug = false;
  }
  
  /**
   * Initialize the handler
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    this.debug = options.debug || false;
    
    return this;
  }
  
  /**
   * Set the Colyseus room to listen for messages
   * @param {Room} room - Colyseus room
   */
  setRoom(room) {
    this.room = room;
    
    if (!room) {
      console.error("Room not available for DungeonNetworkHandler");
      return this;
    }
    
    // Set up message handlers
    this.setupMessageHandlers();
    
    return this;
  }
  
  /**
   * Set up all message handlers
   */
  setupMessageHandlers() {
    if (!this.room) return;
    
    // Handle map data
    this.room.onMessage("mapData", this.handleMapData.bind(this));
    
    // Handle teleportation
    this.room.onMessage("teleported", this.handleTeleported.bind(this));
    
    // Handle phase changes
    this.room.onMessage("phaseChange", this.handlePhaseChange.bind(this));
    
    if (this.debug) {
      console.log("DungeonNetworkHandler: Message handlers set up");
    }
  }
  
  /**
   * Handle map data message from server
   * @param {Object} data - Map data from server
   */
  handleMapData(data) {
    if (this.debug) {
      console.log("Map data received:", {
        width: data.width,
        height: data.height,
        floorLevel: data.floorLevel,
        roomCount: data.rooms.length,
        templateCount: data.templates ? Object.keys(data.templates).length : 0
      });
    }
    
    // Register templates if provided
    if (data.templates) {
      registerTemplates(data.templates);
    }
    
    // Call callback if set
    if (typeof this.onMapDataReceived === 'function') {
      this.onMapDataReceived(data);
    }
  }
  
  /**
   * Handle teleported message from server
   * @param {Object} data - Teleportation data
   */
  handleTeleported(data) {
    if (this.debug) {
      console.log("Teleported:", data);
    }
    
    // Call callback if set
    if (typeof this.onTeleported === 'function') {
      this.onTeleported(data);
    }
  }
  
  /**
   * Handle phase change message from server
   * @param {Object} data - Phase change data
   */
  handlePhaseChange(data) {
    if (this.debug) {
      console.log("Phase changed:", data);
    }
    
    // If entering dungeon phase, we might need to handle specific actions
    if (data.phase === 'dungeon') {
      // To be implemented
    }
  }
  
  /**
   * Set callback for map data received
   * @param {Function} callback - Function to call with map data
   */
  setOnMapDataReceived(callback) {
    this.onMapDataReceived = callback;
    return this;
  }
  
  /**
   * Set callback for teleported event
   * @param {Function} callback - Function to call with teleport data
   */
  setOnTeleported(callback) {
    this.onTeleported = callback;
    return this;
  }
  
  /**
   * Request the current dungeon map
   */
  requestMap() {
    if (!this.room) return;
    
    this.room.send("requestMapData");
    
    if (this.debug) {
      console.log("Map data requested");
    }
  }
}
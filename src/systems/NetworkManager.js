// src/systems/NetworkManager.js
import { Client } from 'colyseus.js';
import gameState from './GameState.js';

class NetworkManager {
  constructor() {
    this.client = null;
    this.room = null;
    this.connected = false;
    this.serverUrl = 'ws://localhost:2567';
    this.roomType = 'normal';
    this.messageHandlers = new Map();
  }
  
  /**
   * Initialize the network manager
   * @param {Object} config - Configuration options
   */
  init(config = {}) {
    if (config.serverUrl) {
      this.serverUrl = config.serverUrl;
    }
    
    if (config.roomType) {
      this.roomType = config.roomType;
    }
    
    console.log(`NetworkManager initialized with server: ${this.serverUrl}`);
    return this;
  }
  
  /**
   * Connect to the server and join a room
   * @param {Object} options - Connection options
   * @returns {Promise} - Promise resolving to the connected room
   */
  async connect(options = {}) {
    try {
      if (!this.client) {
        this.client = new Client(this.serverUrl);
      }
      
      // Join or create room
      this.room = await this.client.joinOrCreate(this.roomType, options);
      this.connected = true;
      
      console.log(`Connected to room: ${this.room.id}`);
      
      // Set up state change handlers
      this.setupRoomHandlers();
      
      return this.room;
    } catch (error) {
      console.error('Connection error:', error);
      throw error;
    }
  }
  
  /**
   * Set up room event handlers
   * @private
   */
  setupRoomHandlers() {
    if (!this.room) return;
    
    // Handle state changes
    this.room.onStateChange(state => {
      // Update game state based on room state
      
      // Handle players
      if (state.players) {
        // Clear missing players
        const currentIds = new Set();
        for (const id in state.players) {
          currentIds.add(id);
          
          const playerData = state.players[id];
          gameState.addPlayer(id, {
            name: playerData.name,
            position: playerData.position,
            isReady: playerData.ready,
            score: playerData.currentProgress || 0
          });
        }
        
        // Remove players not in state
        for (const [id] of gameState.getAllPlayers()) {
          if (!currentIds.has(id)) {
            gameState.removePlayer(id);
          }
        }
      }
      
      // Update game phase
      if (state.gameStarted && !state.gameEnded && gameState.getPhase() !== 'playing') {
        gameState.setPhase('playing');
      } else if (state.gameEnded && gameState.getPhase() !== 'results') {
        gameState.setPhase('results');
      }
    });
    
    // Set up disconnect handler
    this.room.onLeave(code => {
      console.log(`Left room: ${this.room.id}, code: ${code}`);
      this.connected = false;
      this.room = null;
    });
    
    // Set up standard message handlers
    this.setupMessageHandlers();
  }
  
  /**
   * Set up standard message handlers
   * @private
   */
  setupMessageHandlers() {
    // Countdown messages
    this.addMessageHandler('countdownStarted', message => {
      console.log('Countdown started:', message);
    });
    
    this.addMessageHandler('countdownUpdate', message => {
      console.log('Countdown update:', message);
    });
    
    this.addMessageHandler('gameStarted', () => {
      console.log('Game started');
      gameState.setPhase('playing');
    });
    
    this.addMessageHandler('dungeonGenerated', message => {
      console.log('Dungeon generated:', message);
    });
    
    this.addMessageHandler('leaderboardUpdate', message => {
      console.log('Leaderboard update:', message);
      // Update player scores
    });
    
    this.addMessageHandler('globalEvent', message => {
      console.log('Global event:', message);
    });
    
    this.addMessageHandler('gameEnded', message => {
      console.log('Game ended:', message);
      gameState.endGame(message);
    });
  }
  
  /**
   * Add a message handler
   * @param {string} type - Message type
   * @param {Function} handler - Message handler function
   */
  addMessageHandler(type, handler) {
    this.messageHandlers.set(type, handler);
    
    if (this.room) {
      this.room.onMessage(type, message => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in ${type} message handler:`, error);
        }
      });
    }
  }
  
  /**
   * Send a message to the server
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  sendMessage(type, data) {
    if (this.room && this.connected) {
      this.room.send(type, data);
    } else {
      console.warn('Cannot send message: not connected');
    }
  }
  
  /**
   * Send player movement to the server
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  sendPlayerMovement(x, y) {
    this.sendMessage('playerAction', {
      type: 'move',
      x: x,
      y: y
    });
  }
  
  /**
   * Get the current room instance
   * @returns {Room|null} - Colyseus room or null if not connected
   */
  getRoom() {
    return this.room;
  }
  
  /**
   * Check if connected to server
   * @returns {boolean} - True if connected
   */
  isConnected() {
    return this.connected && this.room !== null;
  }
  
  /**
   * Get the current player ID
   * @returns {string|null} - Player ID or null if not connected
   */
  getPlayerId() {
    return this.room ? this.room.sessionId : null;
  }
  
  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    
    this.connected = false;
  }
}

// Create a singleton instance
const networkManager = new NetworkManager();

export default networkManager;
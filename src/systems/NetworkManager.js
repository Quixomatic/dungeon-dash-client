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
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // 2 seconds initial delay
    this.debug = true;
    this.lastInputTime = 0;
    this.inputSendRate = 16.67; // Send inputs at ~60Hz
    this.lastInput = null;
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
    
    if (config.debug !== undefined) {
      this.debug = config.debug;
    }
    
    if (this.debug) {
      console.log(`NetworkManager initialized with server: ${this.serverUrl}`);
    }
    
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
      this.reconnectAttempts = 0;
      
      if (this.debug) {
        console.log(`Connected to room: ${this.room.id}`);
      }
      
      // Set up state change handlers
      this.setupRoomHandlers();
      
      return this.room;
    } catch (error) {
      console.error('Connection error:', error);
      
      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
        
        return new Promise((resolve, reject) => {
          setTimeout(async () => {
            try {
              const room = await this.connect(options);
              resolve(room);
            } catch (reconnectError) {
              reject(reconnectError);
            }
          }, delay);
        });
      }
      
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
            score: playerData.currentProgress || 0,
            health: playerData.health || 100,
            maxHealth: playerData.maxHealth || 100,
            level: playerData.level || 1
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
      if (state.gameStarted && !state.gameEnded && gameState.getPhase() === 'lobby') {
        gameState.setPhase('dungeon');
      } else if (state.gameEnded && gameState.getPhase() !== 'results') {
        gameState.setPhase('results');
      } else if (state.phase && state.phase !== gameState.getPhase()) {
        gameState.setPhase(state.phase);
      }
    });
    
    // Set up disconnect handler
    this.room.onLeave(code => {
      console.log(`Left room: ${this.room.id}, code: ${code}`);
      this.connected = false;
      this.room = null;
      
      // Attempt reconnection if disconnected unexpectedly
      if (code !== 1000) { // Normal closure
        this.attemptReconnection();
      }
    });
    
    // Set up standard message handlers
    this.setupMessageHandlers();
  }
  
  /**
   * Attempt to reconnect to the server
   * @private
   */
  attemptReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
      
      setTimeout(() => {
        this.connect()
          .catch(error => {
            console.error('Reconnection failed:', error);
          });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
  
  /**
   * Set up standard message handlers
   * @private
   */
  setupMessageHandlers() {
    // Countdown messages
    this.addMessageHandler('countdownStarted', message => {
      if (this.debug) {
        console.log('Countdown started:', message);
      }
    });
    
    this.addMessageHandler('countdownUpdate', message => {
      if (this.debug) {
        console.log('Countdown update:', message);
      }
    });
    
    this.addMessageHandler('gameStarted', () => {
      if (this.debug) {
        console.log('Game started');
      }
      gameState.setPhase('dungeon');
    });
    
    this.addMessageHandler('dungeonGenerated', message => {
      if (this.debug) {
        console.log('Dungeon generated:', message);
      }
    });
    
    this.addMessageHandler('leaderboardUpdate', message => {
      if (this.debug) {
        console.log('Leaderboard update:', message);
      }
      // Update player scores
    });
    
    this.addMessageHandler('globalEvent', message => {
      if (this.debug) {
        console.log('Global event:', message);
      }
    });
    
    this.addMessageHandler('gameEnded', message => {
      if (this.debug) {
        console.log('Game ended:', message);
      }
      gameState.endGame(message);
    });
    
    this.addMessageHandler('playerJoined', message => {
      if (this.debug) {
        console.log('Player joined:', message);
      }
    });
    
    this.addMessageHandler('playerLeft', message => {
      if (this.debug) {
        console.log('Player left:', message);
      }
    });
    
    this.addMessageHandler('playerMoved', message => {
      if (this.debug) {
        console.log('Player moved:', message);
      }
      
      // Update player position in game state
      const player = gameState.getPlayer(message.id);
      if (player) {
        gameState.updatePlayer(message.id, {
          position: { x: message.x, y: message.y }
        });
      }
    });
    
    this.addMessageHandler('phaseChange', message => {
      if (this.debug) {
        console.log('Phase change:', message);
      }
      gameState.setPhase(message.phase);
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
   * Send player input to the server
   * @param {Object} inputState - Player input state
   */
  sendPlayerInput(inputState) {
    // Rate limit input messages
    const now = Date.now();
    if (now - this.lastInputTime < this.inputSendRate) {
      // Store input for sending in next allowed time slot
      this.lastInput = { ...inputState };
      return;
    }
    
    this.lastInputTime = now;
    
    // Send input to server
    this.sendMessage('playerInput', inputState);
    
    // Clear stored input
    this.lastInput = null;
  }
  
  /**
   * Process any pending inputs (called from game update loop)
   */
  processInputs() {
    if (this.lastInput) {
      const now = Date.now();
      if (now - this.lastInputTime >= this.inputSendRate) {
        this.sendPlayerInput(this.lastInput);
      }
    }
  }
  
  /**
   * Legacy method: Send player movement to the server directly
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
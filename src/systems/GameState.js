// src/systems/GameState.js

/**
 * GameState - Manages the global state of the game
 */
class GameState {
    constructor() {
      // Game state properties
      this.currentPhase = 'lobby'; // lobby, playing, results
      this.players = new Map();
      this.gameStartTime = null;
      this.gameEndTime = null;
      this.gameConfig = {
        maxPlayers: 100,
        minPlayersToStart: 2,
        gameDuration: 10 * 60 * 1000, // 10 minutes
      };
      
      // Event listeners
      this.listeners = {
        phaseChange: [],
        playerJoined: [],
        playerLeft: [],
        gameStart: [],
        gameEnd: []
      };
    }
    
    /**
     * Initialize with any starting configuration
     * @param {Object} config - Initial configuration
     */
    init(config = {}) {
      if (config.gameConfig) {
        this.gameConfig = { ...this.gameConfig, ...config.gameConfig };
      }
      
      console.log('GameState initialized with config:', this.gameConfig);
      return this;
    }
    
    /**
     * Set the current game phase
     * @param {string} phase - New game phase
     */
    setPhase(phase) {
      if (this.currentPhase === phase) return;
      
      const oldPhase = this.currentPhase;
      this.currentPhase = phase;
      
      // If phase changed to 'playing', record game start time
      if (phase === 'playing' && oldPhase !== 'playing') {
        this.gameStartTime = Date.now();
      }
      
      // If phase changed to 'results', record game end time
      if (phase === 'results' && oldPhase !== 'results') {
        this.gameEndTime = Date.now();
      }
      
      console.log(`Game phase changed: ${oldPhase} -> ${phase}`);
      
      // Trigger phase change event
      this.notifyListeners('phaseChange', { oldPhase, newPhase: phase });
    }
    
    /**
     * Get current game phase
     * @returns {string} - Current phase
     */
    getPhase() {
      return this.currentPhase;
    }
    
    /**
     * Add a player to the state
     * @param {string} id - Player's unique ID
     * @param {Object} data - Player data
     */
    addPlayer(id, data) {
      if (!this.players.has(id)) {
        this.players.set(id, {
          id,
          name: data.name || `Player_${id.substring(0, 4)}`,
          joinTime: Date.now(),
          position: data.position || { x: 400, y: 300 },
          score: 0,
          isReady: false,
          ...data
        });
        
        console.log(`Player added: ${id}`);
        this.notifyListeners('playerJoined', { id, data: this.players.get(id) });
      } else {
        // Update existing player
        const existingData = this.players.get(id);
        this.players.set(id, { ...existingData, ...data });
      }
    }
    
    /**
     * Remove a player from the state
     * @param {string} id - Player's unique ID
     */
    removePlayer(id) {
      if (this.players.has(id)) {
        const playerData = this.players.get(id);
        this.players.delete(id);
        console.log(`Player removed: ${id}`);
        this.notifyListeners('playerLeft', { id, data: playerData });
      }
    }
    
    /**
     * Update a player's data
     * @param {string} id - Player's unique ID
     * @param {Object} data - Updated player data
     */
    updatePlayer(id, data) {
      if (this.players.has(id)) {
        const existingData = this.players.get(id);
        this.players.set(id, { ...existingData, ...data });
      }
    }
    
    /**
     * Get a player by ID
     * @param {string} id - Player's unique ID
     * @returns {Object|null} - Player data or null if not found
     */
    getPlayer(id) {
      return this.players.has(id) ? this.players.get(id) : null;
    }
    
    /**
     * Get all players
     * @returns {Map} - Map of all players
     */
    getAllPlayers() {
      return this.players;
    }
    
    /**
     * Get player count
     * @returns {number} - Number of players
     */
    getPlayerCount() {
      return this.players.size;
    }
    
    /**
     * Start the game
     */
    startGame() {
      this.gameStartTime = Date.now();
      this.setPhase('playing');
      this.notifyListeners('gameStart', { startTime: this.gameStartTime });
    }
    
    /**
     * End the game
     * @param {Object} results - Game results
     */
    endGame(results) {
      this.gameEndTime = Date.now();
      this.gameResults = results;
      this.setPhase('results');
      this.notifyListeners('gameEnd', { 
        endTime: this.gameEndTime, 
        duration: this.gameEndTime - this.gameStartTime,
        results
      });
    }
    
    /**
     * Get elapsed game time in milliseconds
     * @returns {number} - Elapsed time or 0 if game hasn't started
     */
    getElapsedTime() {
      if (!this.gameStartTime) return 0;
      
      const endTime = this.gameEndTime || Date.now();
      return endTime - this.gameStartTime;
    }
    
    /**
     * Get remaining game time in milliseconds
     * @returns {number} - Remaining time or 0 if game hasn't started
     */
    getRemainingTime() {
      if (!this.gameStartTime) return 0;
      if (this.gameEndTime) return 0;
      
      const elapsed = Date.now() - this.gameStartTime;
      const remaining = this.gameConfig.gameDuration - elapsed;
      return Math.max(0, remaining);
    }
    
    /**
     * Add an event listener
     * @param {string} event - Event type
     * @param {Function} callback - Callback function
     */
    addEventListener(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event].push(callback);
      }
    }
    
    /**
     * Remove an event listener
     * @param {string} event - Event type
     * @param {Function} callback - Callback function to remove
     */
    removeEventListener(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    }
    
    /**
     * Notify all listeners of an event
     * @param {string} event - Event type
     * @param {Object} data - Event data
     * @private
     */
    notifyListeners(event, data) {
      if (this.listeners[event]) {
        for (const callback of this.listeners[event]) {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in ${event} listener:`, error);
          }
        }
      }
    }
    
    /**
     * Reset the game state
     */
    reset() {
      this.currentPhase = 'lobby';
      this.players.clear();
      this.gameStartTime = null;
      this.gameEndTime = null;
      this.gameResults = null;
      console.log('Game state reset');
    }
  }
  
  // Create a singleton instance
  const gameState = new GameState();
  
  export default gameState;
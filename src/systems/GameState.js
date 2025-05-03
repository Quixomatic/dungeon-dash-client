// src/systems/GameState.js

/**
 * GameState - Manages the global state of the game
 */
class GameState {
  constructor() {
    // Game state properties
    this.currentPhase = "lobby"; // lobby, dungeon, gauntlet, results
    this.players = new Map();
    this.gameStartTime = null;
    this.gameEndTime = null;
    this.gameConfig = {
      maxPlayers: 100,
      minPlayersToStart: 2,
      gameDuration: 10 * 60 * 1000, // 10 minutes
      dungeonPhaseDuration: 5 * 60 * 1000, // 5 minutes
      gauntletPhaseDuration: 2 * 60 * 1000, // 2 minutes
    };

    // Add map data storage
    this.mapData = null;

    // Event listeners
    this.listeners = {
      phaseChange: [],
      playerJoined: [],
      playerLeft: [],
      gameStart: [],
      gameEnd: [],
    };

    // Debug flag
    this.debug = true;
  }

  /**
   * Initialize with any starting configuration
   * @param {Object} config - Initial configuration
   */
  init(config = {}) {
    if (config.gameConfig) {
      this.gameConfig = { ...this.gameConfig, ...config.gameConfig };
    }

    if (config.debug !== undefined) {
      this.debug = config.debug;
    }

    if (this.debug) {
      console.log("GameState initialized with config:", this.gameConfig);
    }

    return this;
  }

  /**
   * Set map data
   * @param {Object} data - Map data from server
   */
  setMapData(data) {
    this.mapData = data;

    if (this.debug) {
      console.log(
        `Map data stored in GameState with ${data.rooms?.length || 0} rooms`
      );
    }

    // Notify listeners
    this.notifyListeners("mapDataReceived", { data });
  }

  /**
   * Get stored map data
   * @returns {Object|null} - Map data or null if not loaded
   */
  getMapData() {
    return this.mapData;
  }

  /**
   * Check if map data is loaded
   * @returns {boolean} - True if map data is loaded
   */
  isMapLoaded() {
    return this.mapData !== null;
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
    if (
      phase === "dungeon" &&
      oldPhase !== "dungeon" &&
      oldPhase !== "gauntlet"
    ) {
      this.gameStartTime = Date.now();
    }

    // If phase changed to 'results', record game end time
    if (phase === "results" && oldPhase !== "results") {
      this.gameEndTime = Date.now();
    }

    if (this.debug) {
      console.log(`Game phase changed: ${oldPhase} -> ${phase}`);
    }

    // Trigger phase change event
    this.notifyListeners("phaseChange", { oldPhase, newPhase: phase });
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
        isAlive: true,
        level: 1,
        experience: 0,
        health: 100,
        maxHealth: 100,
        ...data,
      });

      if (this.debug) {
        console.log(`Player added: ${id}`, data);
      }

      this.notifyListeners("playerJoined", { id, data: this.players.get(id) });
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

      if (this.debug) {
        console.log(`Player removed: ${id}`);
      }

      this.notifyListeners("playerLeft", { id, data: playerData });
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
    this.setPhase("dungeon");
    this.notifyListeners("gameStart", { startTime: this.gameStartTime });
  }

  /**
   * End the game
   * @param {Object} results - Game results
   */
  endGame(results) {
    this.gameEndTime = Date.now();
    this.gameResults = results;
    this.setPhase("results");
    this.notifyListeners("gameEnd", {
      endTime: this.gameEndTime,
      duration: this.gameEndTime - this.gameStartTime,
      results,
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
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
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
    this.currentPhase = "lobby";
    this.players.clear();
    this.gameStartTime = null;
    this.gameEndTime = null;
    this.gameResults = null;

    if (this.debug) {
      console.log("Game state reset");
    }
  }
}

// Create a singleton instance
const gameState = new GameState();

export default gameState;

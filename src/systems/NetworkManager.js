// src/systems/NetworkManager.js
import { Client, getStateCallbacks } from "colyseus.js";
import gameState from "./GameState.js";

class NetworkManager {
  constructor() {
    this.client = null;
    this.room = null;
    this.connected = false;
    this.serverUrl = "ws://localhost:2567";
    this.roomType = "normal";
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // 2 seconds initial delay
    this.debug = true;
    this.lastInputTime = 0;
    this.inputSendRate = 16.67; // Send inputs at ~60Hz
    this.lastInput = null;

    // Input tracking for reconciliation
    this.inputSequence = 0;
    this.pendingInputs = [];
    this.lastServerState = null;
    this.lastProcessedInput = 0;
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

      // Check for auth token in localStorage
      const token = localStorage.getItem("auth_token");

      // Add token to options if available
      if (token) {
        this.client.auth.token = token;
      }

      // Join or create room
      this.room = await this.client.joinOrCreate(this.roomType, options);
      this.connected = true;
      this.reconnectAttempts = 0;

      if (this.debug) {
        console.log(`Connected to room: ${this.room.id}`);
        console.log(`Auth status: ${token ? "Authenticated" : "Guest"}`);
      }

      // Set up state change handlers
      this.setupRoomHandlers();

      return this.room;
    } catch (error) {
      console.error("Connection error:", error);

      // Special handling for auth errors
      if (error.code === 401) {
        // Clear invalid token
        localStorage.removeItem("auth_token");
        console.log("Authentication failed, cleared token");

        // Attempt reconnect without auth
        return this.connect(options);
      }

      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay =
          this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1); // Exponential backoff

        console.log(
          `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
        );

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

  // Add login method
  async login(email, password) {
    try {
      const response = await fetch(`${this.serverUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store token
      localStorage.setItem("auth_token", data.token);

      // Update client auth
      if (this.client) {
        this.client.auth.token = data.token;
      }

      return data.user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  // Add register method
  async register(username, email, password) {
    try {
      const response = await fetch(`${this.serverUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Store token
      localStorage.setItem("auth_token", data.token);

      // Update client auth
      if (this.client) {
        this.client.auth.token = data.token;
      }

      return data.user;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  // Add logout method
  logout() {
    localStorage.removeItem("auth_token");

    // Disconnect if connected
    if (this.connected) {
      this.disconnect();
    }

    if (this.client) {
      this.client.auth.token = null;
    }
  }

  /**
   * Set up room event handlers
   * @private
   */
  setupRoomHandlers() {
    if (!this.room) {
      console.error("Room not available for NetworkManager");
      return;
    }

    console.log("Setting up room handlers");

    // Listen for state changes
    this.room.onStateChange((state) => {
      //console.log("State changed", state);

      // Update phase if changed
      if (state.phase && state.phase !== gameState.getPhase()) {
        console.log(
          `Phase changed from ${gameState.getPhase()} to ${state.phase}`
        );
        gameState.setPhase(state.phase);
      }
    });

    // Wait for initial state to be fully available
    this.room.onStateChange.once(() => {
      console.log("Initial state received");

      // Verify players exists
      if (this.room.state.players) {
        console.log("Setting up player handlers");

        // Set up player join handler
        this.room.state.players.onAdd = (player, sessionId) => {
          console.log(`Player added handler: ${sessionId}`, player.position);

          gameState.addPlayer(sessionId, {
            name: player.name || `Player_${sessionId.substring(0, 4)}`,
            position: { x: player.position.x, y: player.position.y },
            isLocalPlayer: sessionId === this.room.sessionId,
          });
        };

        // Set up player leave handler
        this.room.state.players.onRemove = (player, sessionId) => {
          console.log(`Player removed: ${sessionId}`);
          gameState.removePlayer(sessionId);
        };

        // Handle existing players (that joined before we set up handlers)
        this.room.state.players.forEach((player, sessionId) => {
          console.log(
            `Processing existing player: ${sessionId}`,
            player.position
          );

          gameState.addPlayer(sessionId, {
            name: player.name || `Player_${sessionId.substring(0, 4)}`,
            position: { x: player.position.x, y: player.position.y },
            isLocalPlayer: sessionId === this.room.sessionId,
          });

          // Set up change listener
          player.onChange = (changes) => {
            console.log(`Player ${sessionId} changed`);

            // Create update
            const updateData = {};

            if (player.position) {
              updateData.position = {
                x: player.position.x,
                y: player.position.y,
              };
            }

            // Apply updates if any
            if (Object.keys(updateData).length > 0) {
              gameState.updatePlayer(sessionId, updateData);
            }
          };
        });
      } else {
        console.warn("No players collection in state");
      }
    });

    // Set up disconnect handler
    this.room.onLeave((code) => {
      this.debug && console.log(`Left room: ${this.room.id}, code: ${code}`);
      this.connected = false;
      this.room = null;

      // Attempt reconnection if disconnected unexpectedly
      if (code !== 1000) {
        // Normal closure
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
      const delay =
        this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

      console.log(
        `Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`
      );

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error("Reconnection failed:", error);
        });
      }, delay);
    } else {
      console.error("Max reconnection attempts reached");
    }
  }

  /**
   * Set up standard message handlers
   * @private
   */
  setupMessageHandlers() {
    // Countdown messages
    this.addMessageHandler("countdownStarted", (message) => {
      if (this.debug) {
        console.log("Countdown started:", message);
      }
    });

    this.addMessageHandler("countdownUpdate", (message) => {
      if (this.debug) {
        console.log("Countdown update:", message);
      }
    });

    this.addMessageHandler("gameStarted", () => {
      if (this.debug) {
        console.log("Game started");
      }
      gameState.setPhase("dungeon");
    });

    this.addMessageHandler("dungeonGenerated", (message) => {
      if (this.debug) {
        console.log("Dungeon generated:", message);
      }
    });

    this.addMessageHandler("leaderboardUpdate", (message) => {
      if (this.debug) {
        //console.log("Leaderboard update:", message);
      }
      // Update player scores
    });

    this.addMessageHandler("globalEvent", (message) => {
      if (this.debug) {
        console.log("Global event:", message);
      }
    });

    this.addMessageHandler("gameEnded", (message) => {
      if (this.debug) {
        console.log("Game ended:", message);
      }
      gameState.endGame(message);
    });

    this.addMessageHandler("playerJoined", (message) => {
      if (this.debug) {
        console.log("Player joined:", message);
      }
    });

    this.addMessageHandler("playerLeft", (message) => {
      if (this.debug) {
        console.log("Player left:", message);
      }
    });

    this.addMessageHandler("playerMoved", (message) => {
      return;
      if (this.debug) {
        console.log("Player moved:", message);
      }

      // Update player position in game state
      const player = gameState.getPlayer(message.id);
      if (player) {
        gameState.updatePlayer(message.id, {
          position: { x: message.x, y: message.y },
        });
      }
    });

    this.addMessageHandler("phaseChange", (message) => {
      if (this.debug) {
        console.log("Phase change:", message);
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
      this.room.onMessage(type, (message) => {
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
      console.warn("Cannot send message: not connected");
    }
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

// src/systems/NetworkManager.js
import { Client, getStateCallbacks } from "colyseus.js";
import gameState from "./GameState.js";

class NetworkManager {
  constructor() {
    this.client = null;
    this.room = null;
    this.connected = false;
    this.serverUrl = "ws://localhost:2567";
    this.httpServerUrl = "http://localhost:2567"; // HTTP URL for auth API
    this.roomType = "normal";
    this.debug = true;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.lastInputTime = 0;
    this.inputSendRate = 16.67;
    this.lastInput = null;

    // Auth state tracking
    this.isAuthenticated = false;
    this.userData = null;

    // Input tracking for reconciliation
    this.inputSequence = 0;
    this.pendingInputs = [];
    this.lastServerState = null;
    this.lastProcessedInput = 0;

    // Check for existing token on initialization
    this.checkExistingAuth();

    // Set up token refresh interval
    this.tokenRefreshInterval = setInterval(() => {
      this.refreshTokenIfNeeded();
    }, 60000); // Check every minute
  }

  /**
   * Check for existing authentication token on startup
   * @private
   */
  async checkExistingAuth() {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    try {
      // Try to parse payload from token (JWT format: header.payload.signature)
      const payload = this.decodeToken(token);
      if (payload) {
        const now = Date.now() / 1000;

        // Check if token is expired
        if (payload.exp && payload.exp < now) {
          console.log("Stored token is expired, trying refresh token");
          // Try to refresh token
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // If token was refreshed successfully, re-run auth check with new token
            return this.checkExistingAuth();
          } else {
            // Failed to refresh, clear tokens
            localStorage.removeItem("auth_token");
            localStorage.removeItem("refresh_token");
            this.isAuthenticated = false;
            this.userData = null;
            return;
          }
        } else {
          // Token is still valid, but we want full user data
          // Set basic user data from token as a fallback
          this.userData = {
            id: payload.id,
            username: payload.username,
            email: payload.email,
          };
          this.isAuthenticated = true;

          // Fetch complete user data
          try {
            await this.fetchUserData();
          } catch (error) {
            console.warn(
              "Could not fetch complete user data, using token data instead:",
              error
            );
          }

          // Trigger auth status changed event
          window.dispatchEvent(
            new CustomEvent("authStatusChanged", {
              detail: {
                isAuthenticated: true,
                user: this.userData,
              },
            })
          );
        }
      }
    } catch (error) {
      console.warn("Could not parse token payload:", error);

      // Try to validate token with server and get user data
      try {
        await this.fetchUserData();

        this.isAuthenticated = true;

        // Trigger auth status changed event
        window.dispatchEvent(
          new CustomEvent("authStatusChanged", {
            detail: {
              isAuthenticated: true,
              user: this.userData,
            },
          })
        );

        console.log("Authentication restored from saved token");
      } catch (error) {
        console.error("Error validating saved token:", error);

        // Try refresh as a last resort
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // If token was refreshed successfully, re-run auth check with new token
          return this.checkExistingAuth();
        } else {
          // Failed to refresh, clear tokens
          localStorage.removeItem("auth_token");
          localStorage.removeItem("refresh_token");
          this.isAuthenticated = false;
          this.userData = null;
        }
      }
    }
  }

  /**
   * Fetch complete user data from the server
   * @returns {Promise<Object>} - Complete user data
   */
  async fetchUserData() {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw new Error("No auth token available");
    }

    const response = await fetch(`${this.httpServerUrl}/auth/userdata`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user data");
    }

    const userData = await response.json();
    this.userData = userData;
    return userData;
  }

  /**
   * Check if token needs refresh and refresh it if needed
   * @private
   */
  async refreshTokenIfNeeded() {
    if (!this.isAuthenticated) return;

    const token = localStorage.getItem("auth_token");
    if (!token) return;

    // Check if token is about to expire
    try {
      const tokenData = this.decodeToken(token);
      const now = Date.now() / 1000;

      console.log("Token data:", tokenData);

      // If token expires in less than 5 minutes, refresh it
      if (tokenData.exp && tokenData.exp - now < 300) {
        await this.refreshToken();
      }
    } catch (error) {
      console.error("Error checking token expiration:", error);
    }
  }

  /**
   * Decode a JWT token
   * @param {string} token - JWT token to decode
   * @returns {Object} - Decoded token payload
   * @private
   */
  decodeToken(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error("Error decoding token:", error);
      return {};
    }
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
      console.log(
        `Auth status: ${this.isAuthenticated ? "Authenticated" : "Guest"}`
      );
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

      // If we have a stored token, set it on the client
      const token = localStorage.getItem("auth_token");
      if (token) {
        this.client.auth.token = token;
        if (this.debug) {
          console.log("Using stored authentication token");
        }
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

      // Handle authentication errors
      if (error.code === 401) {
        console.log("Authentication error:", error.message);

        // Try to refresh token
        if (await this.refreshToken()) {
          // Token refreshed, try connecting again
          console.log("Token refreshed, reconnecting...");
          return this.connect(options);
        }

        // Clear invalid token
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        this.isAuthenticated = false;
        this.userData = null;
        console.log("Authentication failed, cleared token");

        // Notify about auth change
        window.dispatchEvent(
          new CustomEvent("authStatusChanged", {
            detail: {
              isAuthenticated: false,
              user: null,
            },
          })
        );

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

  /**
   * Login an existing user
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<Object>} - User data
   */
  async login(email, password) {
    try {
      const response = await fetch(`${this.httpServerUrl}/auth/login`, {
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

      // Store tokens and update state
      this.handleAuthResponse(data);

      return data.user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {string} username - User's desired username
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @param {Object} options - Additional registration options
   * @returns {Promise<Object>} - User data and tokens
   */
  async register(username, email, password, options = {}) {
    try {
      const response = await fetch(`${this.httpServerUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Store tokens and update state
      this.handleAuthResponse(data);

      return data.user;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * Handle auth response - store tokens and update internal state
   * @private
   * @param {Object} data - Response data
   */
  handleAuthResponse(data) {
    console.log("Handling auth response:", data);

    // Handle nested token structure
    if (data.token && typeof data.token === "object") {
      // The new structure with nested token object
      if (data.token.token) {
        localStorage.setItem("auth_token", data.token.token);

        if (this.client) {
          this.client.auth.token = data.token.token;
        }
      }

      if (data.token.refreshToken) {
        localStorage.setItem("refresh_token", data.token.refreshToken);
      }
    } else {
      // Fallback to the old structure in case the format changes again
      if (data.token) {
        localStorage.setItem("auth_token", data.token);

        if (this.client) {
          this.client.auth.token = data.token;
        }
      }

      if (data.refreshToken) {
        localStorage.setItem("refresh_token", data.refreshToken);
      }
    }

    // Update auth state
    this.isAuthenticated = true;
    this.userData = data.user;

    // Trigger an event others can listen to
    window.dispatchEvent(
      new CustomEvent("authStatusChanged", {
        detail: {
          isAuthenticated: true,
          user: data.user,
        },
      })
    );
  }

  /**
   * Log out the current user
   * @returns {Promise<void>}
   */
  async logout() {
    // Clear tokens
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");

    this.isAuthenticated = false;
    this.userData = null;

    // Clear client auth
    if (this.client) {
      this.client.auth.token = null;
    }

    // Disconnect if connected
    if (this.connected) {
      this.disconnect();
    }

    // Trigger event
    window.dispatchEvent(
      new CustomEvent("authStatusChanged", {
        detail: {
          isAuthenticated: false,
          user: null,
        },
      })
    );

    // Optionally call server logout endpoint
    try {
      await fetch(`${this.httpServerUrl}/auth/logout`, {
        method: "POST",
      });
    } catch (error) {
      // Just log, don't throw - we've already cleared local state
      console.warn("Error during server logout:", error);
    }
  }

  /**
   * Refresh the auth token
   * @returns {Promise<boolean>} Success or failure
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.httpServerUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();

      // For refresh endpoint response
      if (data.token) {
        localStorage.setItem("auth_token", data.token);

        if (this.client) {
          this.client.auth.token = data.token;
        }
      }

      if (data.refreshToken) {
        localStorage.setItem("refresh_token", data.refreshToken);
      }

      console.log("Token refreshed successfully");
      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
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
   * Check if the user is authenticated
   * @returns {boolean} - Authentication status
   */
  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  /**
   * Get the current user data
   * @returns {Object|null} - User data or null if not authenticated
   */
  getUserData() {
    return this.userData;
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

  /**
   * Cleanup when object is destroyed
   */
  destroy() {
    // Clear token refresh interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }

    // Disconnect from server
    this.disconnect();
  }

  /**
   * Test the authentication flow
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<void>}
   */
  async testAuthFlow(email, password) {
    try {
      console.log("Testing authentication flow...");

      // 1. Try to login
      console.log(`Attempting to login as ${email}...`);
      const user = await this.login(email, password);
      console.log("Login successful:", user);

      // 2. Verify authenticated state
      console.log("Checking authentication state...");
      console.log("Is authenticated:", this.isAuthenticated);
      console.log("User data:", this.userData);

      // 3. Connect to a game room
      console.log("Connecting to game room...");
      const room = await this.connect();
      console.log("Connected to room:", room.id);

      // 4. Wait a moment and verify connection
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Connection active:", this.connected);
      console.log("Player ID:", this.getPlayerId());

      return {
        success: true,
        user,
        room,
      };
    } catch (error) {
      console.error("Authentication test failed:", error);
      return {
        success: false,
        error,
      };
    }
  }
}

// Create a singleton instance
const networkManager = new NetworkManager();

export default networkManager;

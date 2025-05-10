// src/scenes/LobbyScene.js - Updated implementation
import Phaser from "phaser";
import { createDebugHelper } from "../utils/debug.js";
import gameState from "../systems/GameState.js";
import networkManager from "../systems/NetworkManager.js";
import { ReactPhaserBridge } from "../ui/ReactPhaserBridge.js";

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super("LobbyScene");
    this.playerName =
      "Player_" + Math.floor(Math.random() * 1000) + "_" + (Date.now() % 10000);
    this.eventNotification = null;
    this.debug = null;
    this.playerList = []; // Track player elements
    this.loadingStatus = {}; // Track loading status of each player

    // React bridge for auth UI
    this.reactBridge = null;
    this.authStatus = {
      authenticated: false,
      userData: null,
    };
  }

  preload() {
    // Create textures instead of loading images
    this.textures.generate("character", {
      data: ["8888", "8888", "8888", "8888"],
      pixelWidth: 16,
      pixelHeight: 16,
    });

    this.textures.generate("button", {
      data: ["2222222222", "2222222222", "2222222222", "2222222222"],
      pixelWidth: 20,
      pixelHeight: 10,
    });

    this.textures.generate("checkbox", {
      data: ["1111", "1001", "1001", "1111"],
      pixelWidth: 16,
      pixelHeight: 16,
    });

    this.textures.generate("checkbox_checked", {
      data: ["1111", "1001", "1221", "1111"],
      pixelWidth: 16,
      pixelHeight: 16,
    });
  }

  create() {
    // Reset game state to lobby phase
    gameState.reset();
    gameState.setPhase("lobby");

    // Create debug helper
    this.debug = createDebugHelper(this, {
      sceneName: "LOBBY SCENE",
      sceneLabelColor: "#ff9900",
      y: 480,
    });

    // UI elements
    this.add
      .text(400, 60, "Dungeon Dash Royale", {
        fontSize: "32px",
        fill: "#fff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(400, 110, "Lobby", {
        fontSize: "24px",
        fill: "#fff",
      })
      .setOrigin(0.5);

    // Auth status text
    this.authStatusText = this.add
      .text(400, 150, "Loading authentication...", {
        fontSize: "18px",
        fill: "#aaa",
      })
      .setOrigin(0.5);

    // Profile button (only visible when logged in)
    this.profileButton = this.add
      .text(700, 60, "Profile", {
        fontSize: "16px",
        backgroundColor: "#554",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.profileButton.setBackgroundColor("#665"))
      .on("pointerout", () => this.profileButton.setBackgroundColor("#554"))
      .on("pointerdown", () => this.showProfileInfo())
      .setVisible(false);

    // Logout button (only visible when logged in)
    this.logoutButton = this.add
      .text(700, 90, "Logout", {
        fontSize: "16px",
        backgroundColor: "#544",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.logoutButton.setBackgroundColor("#655"))
      .on("pointerout", () => this.logoutButton.setBackgroundColor("#544"))
      .on("pointerdown", () => this.handleLogout())
      .setVisible(false);

    // Connect button
    this.connectButton = this.add
      .text(400, 200, "Join Game", {
        fontSize: "24px",
        backgroundColor: "#4a4",
        padding: { x: 20, y: 10 },
        fixedWidth: 200,
        align: "center",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.connectButton.setBackgroundColor("#6c6"))
      .on("pointerout", () => this.connectButton.setBackgroundColor("#4a4"))
      .on("pointerdown", () => this.connectToServer());

    // Status text
    this.statusText = this.add
      .text(400, 250, "Waiting to connect...", {
        fontSize: "18px",
        fill: "#fff",
      })
      .setOrigin(0.5);

    // Player count
    this.playerCountText = this.add
      .text(400, 280, "Players: 0 / 100", {
        fontSize: "18px",
        fill: "#fff",
      })
      .setOrigin(0.5);

    // Required players text
    this.requiredPlayersText = this.add
      .text(400, 310, "Need 2 players to start", {
        fontSize: "16px",
        fill: "#aaa",
      })
      .setOrigin(0.5);

    // Player list container
    this.createPlayerListContainer();

    // Countdown text (hidden initially)
    this.countdownText = this.add
      .text(400, 490, "", {
        fontSize: "24px",
        fill: "#ff0",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);

    // Debug info for testing
    this.debugText = this.add.text(
      20,
      550,
      "Open multiple browser tabs to test multiplayer",
      {
        fontSize: "14px",
        fill: "#aaa",
      }
    );

    // Initialize React Bridge
    this.reactBridge = new ReactPhaserBridge();
    this.reactBridge.initialize();
    this.reactBridge.setCallbacks({
      onAuthComplete: (userData) => this.handleAuthComplete(userData),
    });

    // Listen for auth events
    this.events.on("authComplete", this.handleAuthComplete, this);
    this.events.on("guestLogin", this.handleGuestLogin, this);

    // Set up phase change listener
    gameState.addEventListener("phaseChange", (data) => {
      if (data.newPhase === "dungeon" || data.newPhase === "gauntlet") {
        this.startGame();
      }
    });

    // Check authentication status on startup
    this.checkAuthStatus();

    // Update debug info periodically
    this.time.addEvent({
      delay: 500,
      callback: this.updateDebugInfo,
      callbackScope: this,
      loop: true,
    });
  }

  async checkAuthStatus() {
    // Check if the user is authenticated
    const isAuthenticated = networkManager.isUserAuthenticated();

    if (isAuthenticated) {
      // Get user data
      const userData = networkManager.getUserData();

      // Update auth status
      this.authStatus = {
        authenticated: true,
        userData,
      };

      // Update UI
      this.updateAuthUI();

      // Update player name if available
      if (userData && (userData.username || userData.displayName)) {
        this.playerName = userData.username || userData.displayName;
      }
    } else {
      // Not authenticated, show auth UI
      this.authStatus = {
        authenticated: false,
        userData: null,
      };

      // Update UI
      this.updateAuthUI();

      // Show auth UI after a slight delay
      this.time.delayedCall(500, () => {
        this.reactBridge.showAuthUI();
      });
    }
  }

  handleAuthComplete(userData) {
    // Update auth status
    this.authStatus = {
      authenticated: true,
      userData,
    };

    // Hide auth UI
    this.reactBridge.hideAuthUI();

    // Update UI
    this.updateAuthUI();

    // Update player name
    this.playerName =
      userData.username || userData.displayName || this.playerName;
  }

  handleGuestLogin() {
    // Update auth status
    this.authStatus = {
      authenticated: false,
      userData: null,
    };

    // Hide auth UI
    this.reactBridge.hideAuthUI();

    // Update UI
    this.updateAuthUI();
  }

  handleLogout() {
    // Call logout in NetworkManager
    networkManager.logout();

    // Update auth status
    this.authStatus = {
      authenticated: false,
      userData: null,
    };

    // Update UI
    this.updateAuthUI();

    // Show auth UI
    this.reactBridge.showAuthUI();
  }

  updateAuthUI() {
    if (this.authStatus.authenticated && this.authStatus.userData) {
      // Show authenticated UI
      this.authStatusText.setText(
        `Logged in as: ${
          this.authStatus.userData.username ||
          this.authStatus.userData.displayName
        }`
      );
      this.authStatusText.setFill("#afa");

      // Show profile and logout buttons
      this.profileButton.setVisible(true);
      this.logoutButton.setVisible(true);
    } else {
      // Show guest UI
      this.authStatusText.setText("Playing as Guest");
      this.authStatusText.setFill("#faa");

      // Hide profile and logout buttons
      this.profileButton.setVisible(false);
      this.logoutButton.setVisible(false);
    }
  }

  showProfileInfo() {
    if (!this.authStatus.authenticated || !this.authStatus.userData) {
      return;
    }

    // Create a simple profile popup
    const bg = this.add
      .rectangle(400, 300, 400, 300, 0x222222, 0.9)
      .setOrigin(0.5);

    const title = this.add
      .text(400, 180, "Player Profile", {
        fontSize: "24px",
        fill: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const userData = this.authStatus.userData;

    const content = this.add
      .text(
        400,
        250,
        [
          `Username: ${userData.username || "N/A"}`,
          `Display Name: ${userData.displayName || "N/A"}`,
          `Email: ${userData.email || "N/A"}`,
          `Account ID: ${userData.id || "N/A"}`,
          ``,
          `Game Stats:`,
        ].join("\n"),
        { fontSize: "16px", fill: "#ffffff", align: "center" }
      )
      .setOrigin(0.5, 0);

    const closeButton = this.add
      .text(400, 400, "Close", {
        fontSize: "16px",
        backgroundColor: "#444",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => closeButton.setBackgroundColor("#555"))
      .on("pointerout", () => closeButton.setBackgroundColor("#444"))
      .on("pointerdown", () => {
        // Remove all profile elements
        bg.destroy();
        title.destroy();
        content.destroy();
        closeButton.destroy();
      });
  }

  createPlayerListContainer() {
    // Create player list container with background
    const containerBg = this.add.rectangle(400, 400, 500, 150, 0x222222, 0.7);

    // Header
    this.add
      .text(400, 340, "Players in Lobby", {
        fontSize: "20px",
        fill: "#fff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Column headers
    this.add
      .text(200, 370, "Name", { fontSize: "16px", fill: "#aaa" })
      .setOrigin(0, 0.5);
    this.add
      .text(400, 370, "Map Loaded", { fontSize: "16px", fill: "#aaa" })
      .setOrigin(0, 0.5);
    this.add
      .text(550, 370, "Ready", { fontSize: "16px", fill: "#aaa" })
      .setOrigin(0, 0.5);

    // Container for player list (to make it easier to clear)
    this.playerListContainer = this.add.container(0, 0);

    // Separator line
    const separatorLine = this.add.graphics();
    separatorLine.lineStyle(1, 0x444444, 1);
    separatorLine.lineBetween(200, 380, 600, 380);

    // No players text (initially visible)
    this.noPlayersText = this.add
      .text(400, 420, "No players connected yet", {
        fontSize: "16px",
        fill: "#666",
      })
      .setOrigin(0.5);
    this.playerListContainer.add(this.noPlayersText);
  }

  updatePlayerList() {
    // Clear current list
    this.playerListContainer.removeAll();

    // Get all players from game state
    const players = gameState.getAllPlayers();
    const playerCount = players.size;

    if (playerCount === 0) {
      // Show no players text
      this.noPlayersText = this.add
        .text(400, 420, "No players connected yet", {
          fontSize: "16px",
          fill: "#666",
        })
        .setOrigin(0.5);
      this.playerListContainer.add(this.noPlayersText);
      return;
    }

    // Create list items
    let yOffset = 390;
    const yStep = 30;

    players.forEach((player, id) => {
      // Player name (highlight if it's the local player)
      const isLocalPlayer = id === networkManager.getPlayerId();
      const nameText = this.add
        .text(200, yOffset, player.name, {
          fontSize: "16px",
          fill: isLocalPlayer ? "#ffff00" : "#ffffff",
        })
        .setOrigin(0, 0.5);

      // Map loaded indicator
      const mapLoadedIcon = this.add
        .sprite(
          420,
          yOffset,
          player.mapLoaded ? "checkbox_checked" : "checkbox"
        )
        .setScale(0.25);

      // Ready indicator
      const readyIcon = this.add
        .sprite(570, yOffset, player.ready ? "checkbox_checked" : "checkbox")
        .setScale(0.25);

      // Add to container
      this.playerListContainer.add([nameText, mapLoadedIcon, readyIcon]);

      // Store references for easy updates
      this.loadingStatus[id] = {
        nameText,
        mapLoadedIcon,
        readyIcon,
      };

      yOffset += yStep;
    });
  }

  updateDebugInfo() {
    this.debug.displayObject({
      Phase: gameState.getPhase(),
      Players: gameState.getPlayerCount(),
      Connected: networkManager.isConnected() ? "Yes" : "No",
      "Your ID": networkManager.getPlayerId() || "Not connected",
      Auth: this.authStatus.authenticated ? "Authenticated" : "Guest",
    });

    // Update player count
    this.playerCountText.setText(
      `Players: ${gameState.getPlayerCount()} / 100`
    );

    // Update player list
    this.updatePlayerList();
  }

  async connectToServer() {
    try {
      this.statusText.setText("Connecting to server...");

      // Initialize network manager
      networkManager.init();

      // Connect to server
      const room = await networkManager.connect({
        name: this.playerName,
        // Pass authentication state
        authenticated: this.authStatus.authenticated,
      });

      this.statusText.setText("Connected! Room: " + room.id);

      // Store room and player info in registry for access from other scenes
      this.registry.set("colyseusRoom", room);
      this.registry.set("playerName", this.playerName);

      // Add player to game state
      gameState.addPlayer(room.sessionId, {
        name: this.playerName,
        position: { x: 400, y: 300 },
        mapLoaded: false,
        ready: false,
      });

      // Add message handlers
      this.addMessageHandlers(room);

      // Update DOM elements
      const playerCountElement = document.getElementById("player-count");
      if (playerCountElement) {
        playerCountElement.innerText = `Players: ${gameState.getPlayerCount()}`;
      }
    } catch (error) {
      console.error("Connection error:", error);
      this.statusText.setText("Connection error: " + error.message);
    }
  }

  addMessageHandlers(room) {
    // Add additional message handlers specific to the lobby
    room.onMessage("countdownStarted", (message) => {
      this.countdownText.setText(`Game starting in ${message.seconds}s`);
      this.countdownText.setVisible(true);
    });

    room.onMessage("countdownUpdate", (message) => {
      this.countdownText.setText(`Game starting in ${message.seconds}s`);
    });

    room.onMessage("countdownCancelled", (message) => {
      this.countdownText.setVisible(false);
      this.statusText.setText(`Countdown cancelled: ${message.reason}`);
    });

    room.onMessage("globalEvent", (message) => {
      this.showGlobalEventNotification(message.message);
    });

    // Handle welcome message
    room.onMessage("welcome", (message) => {
      this.statusText.setText(message.message);
    });

    // Handle player counts
    room.onMessage("playerJoined", (message) => {
      this.playerCountText.setText(`Players: ${message.playerCount} / 100`);
    });

    room.onMessage("playerLeft", (message) => {
      this.playerCountText.setText(`Players: ${message.playerCount} / 100`);
    });

    room.onMessage("testMapData", (message) => {
      console.log("testMapData", message);
    });

    // Handle map data
    room.onMessage("mapData", (message) => {
      console.log("Received map data in lobby");

      // Store in gameState
      gameState.setMapData(message);

      // Show loading indicator
      const loadingText = this.add
        .text(400, 500, "Map data received!", {
          fontSize: "18px",
          fill: "#ffff00",
        })
        .setOrigin(0.5);

      // Animate the text
      this.tweens.add({
        targets: loadingText,
        alpha: { from: 1, to: 0 },
        duration: 2000,
        onComplete: () => loadingText.destroy(),
      });

      // Update status text
      this.statusText.setText("Map loaded. Waiting for other players...");

      // Tell server we've loaded the map
      room.send("mapLoaded");
    });

    // Handle player status updates
    room.onStateChange.once(() => {
      // Set up listeners for each player's loading status
      room.state.players.onAdd = (player, sessionId) => {
        // Initial status set
        this.updatePlayerStatus(sessionId, player);

        // Listen for changes
        player.onChange = (changes) => {
          this.updatePlayerStatus(sessionId, player);
        };
      };
    });
  }

  updatePlayerStatus(playerId, player) {
    // Update in gameState
    gameState.updatePlayer(playerId, {
      mapLoaded: player.mapLoaded,
      ready: player.ready,
    });

    // Update UI if we have this player in our list
    if (this.loadingStatus[playerId]) {
      const status = this.loadingStatus[playerId];

      if (status.mapLoadedIcon) {
        status.mapLoadedIcon.setTexture(
          player.mapLoaded ? "checkbox_checked" : "checkbox"
        );
      }

      if (status.readyIcon) {
        status.readyIcon.setTexture(
          player.ready ? "checkbox_checked" : "checkbox"
        );
      }
    }
  }

  showGlobalEventNotification(message) {
    // Create or update notification text
    if (this.eventNotification) {
      this.eventNotification.setText(message);
      this.eventNotification.setVisible(true);
    } else {
      this.eventNotification = this.add
        .text(400, 500, message, {
          fontSize: "18px",
          fill: "#ffff00",
          backgroundColor: "#333333",
          padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5);
    }

    // Hide after a few seconds
    this.time.delayedCall(5000, () => {
      if (this.eventNotification) {
        this.eventNotification.setVisible(false);
      }
    });
  }

  // Clean up React resources on scene shutdown
  shutdown() {
    if (this.reactBridge) {
      this.reactBridge.destroy();
      this.reactBridge = null;
    }
  }

  startGame() {
    this.scene.start("GameScene");
  }
}

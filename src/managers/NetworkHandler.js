// src/managers/NetworkHandler.js
import networkManager from '../systems/NetworkManager.js';
import gameState from '../systems/GameState.js';

export class NetworkHandler {
  constructor(scene) {
    this.scene = scene;
    this.serverStateReceived = false;
  }
  
  initialize() {
    console.log("Initializing NetworkHandler");
    
    // Setup reconciliation handlers
    networkManager.setupReconciliationHandlers();
    
    // Set up state listeners
    this.setupStateListeners();
    
    // Set up message handlers
    this.setupMessageHandlers();
  }
  
  setupStateListeners() {
    console.log("Setting up state listeners");
    
    // Listen for state changes (add players that join later)
    this.scene.room.onStateChange(state => {
      // Process players in state
      if (state && state.players) {
        for (const id in state.players) {
          if (id !== this.scene.playerId && !this.scene.playerManager.otherPlayers[id]) {
            console.log(`Processing player from state change: ${id}`);
            this.scene.playerManager.createOtherPlayerSprite(id, state.players[id]);
          }
        }
      }
    });
  }
  
  setupMessageHandlers() {
    // Handle player joined events
    this.scene.room.onMessage("playerJoined", (message) => {
      console.log(`Player joined message received:`, message);
      
      // Skip if it's the current player
      if (message.id === this.scene.playerId) return;
      
      // Check if we already have this player
      if (this.scene.playerManager.otherPlayers[message.id]) {
        console.log(`Already tracking player ${message.id}`);
        return;
      }
      
      console.log(`New player joined: ${message.id} (${message.name})`);
      
      // Create a new player entry
      const newPlayer = {
        name: message.name,
        position: message.position || { x: 400, y: 300 }
      };
      
      // Create sprite for the player
      this.scene.playerManager.createOtherPlayerSprite(message.id, newPlayer);
      
      // Add to game state
      gameState.addPlayer(message.id, newPlayer);
    });
    
    // Handle player left events
    this.scene.room.onMessage("playerLeft", (message) => {
      console.log(`Player left message received:`, message);
      
      // Remove the player sprite
      this.scene.playerManager.removeOtherPlayer(message.id);
      
      // Remove from game state
      gameState.removePlayer(message.id);
    });
    
    // Handle player movement messages
    this.scene.room.onMessage("playerMoved", (message) => {
      // Skip if it's the current player (handled by reconciliation)
      if (message.id === this.scene.playerId) return;
      
      // If we don't have this player yet, create them
      if (!this.scene.playerManager.otherPlayers[message.id]) {
        const newPlayer = {
          name: `Player_${message.id.substring(0, 4)}`,
          position: { x: message.x, y: message.y }
        };
        this.scene.playerManager.createOtherPlayerSprite(message.id, newPlayer);
      } else {
        // Store server position for interpolation
        const sprite = this.scene.playerManager.otherPlayers[message.id];
        sprite.serverX = message.x;
        sprite.serverY = message.y;
      }
    });
    
    // Handle phase change
    this.scene.room.onMessage("phaseChange", (message) => {
      console.log(`Phase changed to: ${message.phase}`);
      gameState.setPhase(message.phase);
      
      // Update UI
      this.scene.uiManager.updatePhase(message.phase);
    });
    
    // Handle global events
    this.scene.room.onMessage("globalEvent", (message) => {
      console.log("Global event:", message);
      this.scene.uiManager.showGlobalEventNotification(message.message);
    });
    
    // Handle game end
    this.scene.room.onMessage("gameEnded", (message) => {
      console.log("Game ended:", message);
      
      // Show winner announcement
      if (message.winner) {
        const isCurrentPlayer = message.winner.id === this.scene.playerId;
        const text = isCurrentPlayer ? 
          'YOU WON THE GAME!' : 
          `${message.winner.name} won the game!`;
        
        this.scene.uiManager.showAnnouncement(text, 0xffdd00);
      } else {
        this.scene.uiManager.showAnnouncement('GAME OVER', 0xff0000);
      }
      
      // Set timeout to return to lobby
      this.scene.time.delayedCall(5000, () => {
        this.scene.scene.start('LobbyScene');
      });
    });
  }
  
  applyReconciliation() {
    // Apply server reconciliation to local player
    networkManager.applyServerReconciliation(this.scene.playerManager.localPlayer);
    
    // Update name label after reconciliation
    if (this.scene.playerManager.playerNameLabels[this.scene.playerId]) {
      const label = this.scene.playerManager.playerNameLabels[this.scene.playerId];
      label.x = this.scene.playerManager.localPlayer.x;
      label.y = this.scene.playerManager.localPlayer.y - 40;
    }
  }
  
  sendPlayerInput(inputState) {
    // Send input to network manager
    networkManager.sendPlayerInput(inputState);
  }
}
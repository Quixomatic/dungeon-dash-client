// src/managers/NetworkHandler.js


export class NetworkHandler {
  constructor(scene, room, playerId) {
    this.scene = scene;
    this.room = room;
    this.playerId = playerId;
    this.playerManager = null;
    this.inputHandler = null;
    this.reconciliationManager = null;
    
    // Last received sequence from server
    this.lastProcessedSequence = 0;
    
    // Set up message handlers
    this.setupMessageHandlers();
  }
  
  /**
   * Set player manager reference
   * @param {PlayerManager} playerManager - Player manager instance
   */
  setPlayerManager(playerManager) {
    this.playerManager = playerManager;
  }
  
  /**
   * Set input handler reference
   * @param {InputHandler} inputHandler - Input handler instance
   */
  setInputHandler(inputHandler) {
    this.inputHandler = inputHandler;
  }
  
  /**
   * Set reconciliation manager reference
   * @param {ReconciliationManager} reconciliationManager - Reconciliation manager instance
   */
  setReconciliationManager(reconciliationManager) {
    this.reconciliationManager = reconciliationManager;
  }
  
  /**
   * Set up message handlers
   */
  setupMessageHandlers() {
    if (!this.room) {
      console.error("Room not available for network handler");
      return;
    }
    
    // Handle input acknowledgement
    this.room.onMessage("inputAck", this.handleInputAck.bind(this));
    
    // Handle player movement
    this.room.onMessage("playerMoved", this.handlePlayerMoved.bind(this));
    
    // Handle player joined
    this.room.onMessage("playerJoined", this.handlePlayerJoined.bind(this));
    
    // Handle player left
    this.room.onMessage("playerLeft", this.handlePlayerLeft.bind(this));
  }
  
  /**
   * Handle input acknowledgement
   * @param {Object} message - Input acknowledgement message
   */
  handleInputAck(message) {
    //console.log(`Input acknowledged: seq=${message.seq}, position=(${message.x}, ${message.y})`);
    
    // Update last processed sequence
    this.lastProcessedSequence = message.seq;
    
    // Clear acknowledged inputs
    if (this.inputHandler) {
      this.inputHandler.handleInputAck(message.seq);
    }
    
    // Reconcile if positions don't match
    if (this.reconciliationManager) {
      this.reconciliationManager.reconcile({
        x: message.x,
        y: message.y
      }, message.seq);
    }
  }
  
  /**
   * Handle player moved message
   * @param {Object} message - Player moved message
   */
  handlePlayerMoved(message) {
    // Skip if it's the local player (handled by reconciliation)
    if (message.id === this.playerId) return;
    
    //console.log(`Player ${message.id} moved to (${message.x}, ${message.y})`);
    
    // Update other player position
    if (this.playerManager) {
      this.playerManager.updateOtherPlayer(
        message.id,
        message.x,
        message.y,
        message.name
      );
    }
  }
  
  /**
   * Handle player joined message
   * @param {Object} message - Player joined message
   */
  handlePlayerJoined(message) {
    // Skip if it's the local player
    if (message.id === this.playerId) return;
    
    //console.log(`Player joined: ${message.id} (${message.name})`);
    
    // Create other player
    if (this.playerManager) {
      const x = message.position ? message.position.x : 400;
      const y = message.position ? message.position.y : 300;
      
      this.playerManager.updateOtherPlayer(
        message.id,
        x,
        y,
        message.name
      );
    }
  }
  
  /**
   * Handle player left message
   * @param {Object} message - Player left message
   */
  handlePlayerLeft(message) {
    //console.log(`Player left: ${message.id}`);
    
    // Remove other player
    if (this.playerManager) {
      this.playerManager.removeOtherPlayer(message.id);
    }
  }
  
  /**
   * Send input to server
   * @param {Object} input - Input command
   */
  sendInput(input) {
    if (!this.room) return;
    
    try {
      this.room.send("playerInput", input);
    } catch (error) {
      console.error("Error sending input to server:", error);
    }
  }

  /**
   * Send a batch of inputs to the server
   * @param {Array} inputs - Array of input commands
   */
  sendInputBatch(inputs) {
    if (!this.room || inputs.length === 0) return;
    
    try {
      // Send the entire batch of inputs to ensure nothing is lost
      this.room.send("playerInputBatch", {
        inputs: inputs,
        timestamp: Date.now()
      });
      
      //console.log(`Sent input batch with ${inputs.length} inputs, sequences: ${inputs.map(input => input.seq).join(', ')}`);
    } catch (error) {
      console.error("Error sending input batch to server:", error);
    }
  }
}
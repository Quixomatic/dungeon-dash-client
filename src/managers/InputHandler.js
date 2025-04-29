// src/managers/InputHandler.js
import { createControls } from '../utils/controls.js';

export class InputHandler {
  constructor(scene) {
    this.scene = scene;
    this.controls = createControls(scene);
    this.networkHandler = null;
    this.playerManager = null;
    
    // Input sequence tracking
    this.inputSequence = 0;
    this.pendingInputs = [];
    
    // Movement constants
    this.moveSpeed = 300; // pixels per second
    
    // Input sending rate limiting
    this.lastInputTime = 0;
    this.inputSendRate = 16.67; // ~60Hz
  }
  
  /**
   * Set the network handler reference
   * @param {NetworkHandler} networkHandler - Network handler instance
   */
  setNetworkHandler(networkHandler) {
    this.networkHandler = networkHandler;
  }
  
  /**
   * Set the player manager reference
   * @param {PlayerManager} playerManager - Player manager instance
   */
  setPlayerManager(playerManager) {
    this.playerManager = playerManager;
  }
  
  /**
   * Process input and apply movement
   * @param {number} delta - Time since last update in ms
   * @returns {boolean} - True if player moved
   */
  update(delta) {
    if (!this.controls || !this.playerManager) return false;
    
    // Get input state
    const inputState = this.controls.getInputState();
    
    // Check if any movement keys are pressed
    if (!this.controls.isMoving()) return false;
    
    // Generate input command with sequence number
    const input = {
      ...inputState,
      seq: this.inputSequence++,
      timestamp: Date.now(),
      delta
    };
    
    // Apply input locally (client-side prediction)
    this.applyInput(input);
    
    // Queue input to be sent to server
    this.pendingInputs.push(input);
    
    // Send input to server with rate limiting
    this.sendInputToServer();
    
    return true;
  }
  
  /**
   * Apply input to local player
   * @param {Object} input - Input command
   */
  applyInput(input) {
    if (!this.playerManager) return;
    
    // Calculate movement amount
    const moveAmount = (this.moveSpeed * input.delta) / 1000;
    
    // Get player's current position
    const position = this.playerManager.getPlayerPosition();
    const newPosition = { ...position };
    
    // Apply movement based on input
    if (input.left) newPosition.x -= moveAmount;
    if (input.right) newPosition.x += moveAmount;
    if (input.up) newPosition.y -= moveAmount;
    if (input.down) newPosition.y += moveAmount;
    
    // Apply boundary constraints
    newPosition.x = Math.max(0, Math.min(newPosition.x, 800));
    newPosition.y = Math.max(0, Math.min(newPosition.y, 600));
    
    // Update player position
    this.playerManager.setPlayerPosition(newPosition.x, newPosition.y);
  }
  
  /**
   * Send pending inputs to server with rate limiting
   */
  sendInputToServer() {
    if (!this.networkHandler || this.pendingInputs.length === 0) return;
    
    const now = Date.now();
    if (now - this.lastInputTime < this.inputSendRate) return;
    
    this.lastInputTime = now;
    
    // Get the most recent input
    const input = this.pendingInputs[this.pendingInputs.length - 1];
    
    // Send to server
    this.networkHandler.sendInput(input);
  }
  
  /**
   * Called when server acknowledges inputs up to a sequence number
   * @param {number} sequence - Last processed sequence number
   */
  handleInputAck(sequence) {
    // Remove acknowledged inputs from pending list
    this.pendingInputs = this.pendingInputs.filter(input => input.seq > sequence);
  }
  
  /**
   * Reapply any inputs that haven't been processed by server yet
   * @param {Object} startPosition - Position to start reapplying from
   */
  reapplyPendingInputs(startPosition) {
    if (!this.playerManager) return;
    
    // Reset player to authoritative position
    this.playerManager.setPlayerPosition(startPosition.x, startPosition.y);
    
    // Reapply all pending inputs
    for (const input of this.pendingInputs) {
      this.applyInput(input);
    }
  }
}
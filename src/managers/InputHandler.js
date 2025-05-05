// src/managers/InputHandler.js
import { createControls } from '../utils/controls.js';

export class InputHandler {
  constructor(scene) {
    this.scene = scene;
    this.controls = createControls(scene);
    this.networkHandler = null;
    this.playerManager = null;
    this.collisionSystem = null;
    
    // Input sequence tracking
    this.inputSequence = 0;
    this.pendingInputs = [];
    
    // Movement constants - MATCH WITH SERVER
    this.moveSpeed = 300; // pixels per second - must match server's PlayerState.moveSpeed
    
    // Input sending rate limiting
    this.lastInputTime = 0;
    this.inputSendRate = 16.67; // ~60Hz - match server tick rate
    
    // Wall collision feedback
    this.lastCollisionTime = 0;
    this.collisionCooldown = 500; // ms between collision feedback
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
   * Set the collision system reference
   * @param {CollisionSystem} collisionSystem - Collision system instance
   */
  setCollisionSystem(collisionSystem) {
    this.collisionSystem = collisionSystem;
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
    
    // Get player's current position
    const position = this.playerManager.getPlayerPosition();
    
    // Calculate movement amount
    const moveAmount = (this.moveSpeed * delta) / 1000;
    
    // Calculate target position
    let targetX = position.x;
    let targetY = position.y;
    
    if (inputState.left) targetX -= moveAmount;
    if (inputState.right) targetX += moveAmount;
    if (inputState.up) targetY -= moveAmount;
    if (inputState.down) targetY += moveAmount;
    
    // Apply collision detection if system is available
    let newX = targetX;
    let newY = targetY;
    let collided = false;
    
    if (this.collisionSystem) {
      // Check if target position would collide
      if (this.collisionSystem.checkCollision(targetX, targetY)) {
        collided = true;
        
        // Resolve collision with sliding
        const resolvedPosition = this.collisionSystem.resolveCollision(
          position.x, position.y, targetX, targetY
        );
        
        newX = resolvedPosition.x;
        newY = resolvedPosition.y;
        
        // Play collision feedback if enough time has passed
        const now = Date.now();
        if (collided && now - this.lastCollisionTime > this.collisionCooldown) {
          this.playCollisionFeedback();
          this.lastCollisionTime = now;
        }
      }
    } else {
      // No collision system, use target directly
      newX = targetX;
      newY = targetY;
    }
    
    // Generate input command with sequence number
    const input = {
      ...inputState,
      seq: this.inputSequence++,
      timestamp: Date.now(),
      delta,
      targetX: newX,
      targetY: newY
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
    
    // Update player position
    this.playerManager.setPlayerPosition(input.targetX, input.targetY);
    
    // Update collision debug visualization if available
    if (this.collisionSystem && this.collisionSystem.debug) {
      this.collisionSystem.updateDebug(input.targetX, input.targetY);
    }
  }
  
  /**
   * Send pending inputs to server with rate limiting
   */
  sendInputToServer() {
    if (!this.networkHandler || this.pendingInputs.length === 0) return;
    
    const now = Date.now();
    if (now - this.lastInputTime < this.inputSendRate) return;
    
    this.lastInputTime = now;
    
    // CHANGE: Instead of just sending the most recent input,
    // send ALL pending inputs that haven't been acknowledged yet
    // This ensures no inputs are lost
    
    // Send all pending inputs to server
    this.networkHandler.sendInputBatch(this.pendingInputs);
    
    // NOTE: Do NOT clear pendingInputs here - wait for server ack
    // We'll keep them until the server acknowledges processing them
  }
  
  /**
   * Called when server acknowledges inputs up to a sequence number
   * @param {number} sequence - Last processed sequence number
   */
  handleInputAck(sequence) {
    // Remove acknowledged inputs from pending list
    if (sequence !== undefined) {
      // Only remove inputs with sequence <= acknowledged sequence
      this.pendingInputs = this.pendingInputs.filter(input => input.seq > sequence);
      //console.log(`Acknowledged inputs up to seq ${sequence}, remaining: ${this.pendingInputs.length}`);
    }
  }
  
  /**
   * Reapply any inputs that haven't been processed by server yet
   * @param {Object} startPosition - Position to start reapplying from
   */
  reapplyPendingInputs(startPosition) {
    if (!this.playerManager) return;

    //console.log('Pending Inputs', this.pendingInputs);
    
    // Reset player to authoritative position
    this.playerManager.setPlayerPosition(startPosition.x, startPosition.y);
    
    // Reapply all pending inputs
    for (const input of this.pendingInputs) {
      this.applyInput(input);
    }
  }

  /**
   * Play collision feedback effects
   */
  playCollisionFeedback() {
    // Visual feedback
    if (this.playerManager && this.playerManager.localPlayer) {
      // Flash the player briefly
      this.scene.tweens.add({
        targets: this.playerManager.localPlayer,
        alpha: 0.6,
        duration: 50,
        yoyo: true
      });
    }
    
    // Audio feedback
    // If you have sound effects, play them here
    // this.scene.sound.play('bump');
  }
}
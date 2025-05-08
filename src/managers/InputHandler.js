// src/managers/InputHandler.js
import { createControls } from "../utils/controls.js";

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

    // Dash system properties
    this.dashCharges = [
      { available: true, cooldownEndTime: 0 },
      { available: true, cooldownEndTime: 0 },
    ]; // Initialize with 2 charges
    this.dashDistance = 120;
    this.dashDuration = 0.15; // seconds
    this.dashCooldown = 3.0; // seconds
    this.isDashing = false;
    this.dashStartTime = 0;
    this.dashEndTime = 0;
    this.dashDirection = { x: 0, y: 0 };
    this.dashStartPosition = { x: 0, y: 0 };
    this.dashTargetPosition = { x: 0, y: 0 };
    this.lastMovementDirection = { x: 0, y: 1 }; // Default down

    // Initialize dash key
    this.setupDashKey();
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
   * Setup dash key (spacebar)
   */
  setupDashKey() {
    // Add spacebar for dash
    this.dashKey = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.dashKey.on("down", this.handleDashKeyDown.bind(this));
  }

  /**
   * Handle dash key press
   */
  handleDashKeyDown() {
    // Check if currently dashing or no dash charges available
    if (this.isDashing || !this.hasDashCharge()) return;

    // Get direction
    let direction;
    if (this.controls.isMoving()) {
      // Use current movement direction
      direction = this.controls.getDirectionVector();
    } else {
      // Use last movement direction if stationary
      direction = this.lastMovementDirection;
    }

    // Execute dash
    this.executeDash(direction);
  }

  /**
   * Execute dash movement
   * @param {Object} direction - Direction vector {x, y}
   * @returns {boolean} - True if dash was executed
   */
  executeDash(direction) {
    // Check if dash is available
    if (!this.hasDashCharge() || this.isDashing || !this.playerManager)
      return false;

    // Set dashing state
    this.isDashing = true;
    this.dashStartTime = Date.now();
    this.dashEndTime = this.dashStartTime + this.dashDuration * 1000;

    // Calculate dash vector
    this.dashDirection = direction;
    this.dashStartPosition = this.playerManager.getPlayerPosition();

    // Calculate target position without wall consideration
    const fullDashTarget = {
      x: this.dashStartPosition.x + direction.x * this.dashDistance,
      y: this.dashStartPosition.y + direction.y * this.dashDistance,
    };

    // Find the farthest valid position (ray cast approach)
    let validPosition = { ...fullDashTarget };
    let hitWall = false;

    if (this.collisionSystem) {
      // Check intervals along the dash path
      const steps = 10; // Number of points to check
      for (let i = 1; i <= steps; i++) {
        // Calculate position at this step (from start to end)
        const progress = i / steps;
        const checkX =
          this.dashStartPosition.x + direction.x * this.dashDistance * progress;
        const checkY =
          this.dashStartPosition.y + direction.y * this.dashDistance * progress;

        // Check collision at this point
        if (this.collisionSystem.checkCollision(checkX, checkY)) {
          // Found collision - use previous valid position
          hitWall = true;

          // Use the previous valid position (slightly back from collision)
          const prevProgress = (i - 1) / steps;
          validPosition = {
            x:
              this.dashStartPosition.x +
              direction.x * this.dashDistance * prevProgress,
            y:
              this.dashStartPosition.y +
              direction.y * this.dashDistance * prevProgress,
          };

          // Stop checking further points
          break;
        }
      }
    }

    // Set final target position
    this.dashTargetPosition = validPosition;

    // Consume dash charge
    this.consumeDashCharge();

    // Play dash effect
    this.playDashEffect();

    // Add wall impact effect if we hit a wall
    if (hitWall) {
      this.playWallImpactEffect();
    }

    // Send dash input to server
    if (this.networkHandler) {
      this.networkHandler.sendInput({
        type: "dash",
        direction: direction,
        seq: this.inputSequence++,
        timestamp: this.dashStartTime,
        hitWall: hitWall,
      });
    }

    return true;
  }

  playWallImpactEffect() {
    // If we have a player sprite
    if (this.playerManager && this.playerManager.localPlayer) {
      // Add a small particle burst or flash
      this.scene.tweens.add({
        targets: this.playerManager.localPlayer,
        alpha: 0.5,
        duration: 50,
        yoyo: true,
        repeat: 1
      });
      
      // Could also add a particle effect here
      // if (this.scene.particles) {
      //   this.scene.particles.createWallImpact(this.dashTargetPosition.x, this.dashTargetPosition.y);
      // }
    }
  }

  /**
   * Process input and apply movement
   * @param {number} delta - Time since last update in ms
   * @returns {boolean} - True if player moved
   */
  update(delta) {
    if (!this.controls || !this.playerManager) return false;

    // If currently dashing, handle dash movement
    if (this.isDashing) {
      const now = Date.now();

      if (now < this.dashEndTime) {
        // Calculate dash progress (0 to 1)
        const progress =
          (now - this.dashStartTime) / (this.dashDuration * 1000);

        // Use ease-out function for smooth dash
        const easeOutProgress = 1 - Math.pow(1 - progress, 2);

        // Interpolate position
        const position = {
          x:
            this.dashStartPosition.x +
            (this.dashTargetPosition.x - this.dashStartPosition.x) *
              easeOutProgress,
          y:
            this.dashStartPosition.y +
            (this.dashTargetPosition.y - this.dashStartPosition.y) *
              easeOutProgress,
        };

        // Update player position
        this.playerManager.setPlayerPosition(position.x, position.y);
      } else {
        // Dash completed
        this.isDashing = false;
        this.playerManager.setPlayerPosition(
          this.dashTargetPosition.x,
          this.dashTargetPosition.y
        );
      }

      // Don't process regular movement while dashing
      return true;
    }

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

    // Track direction for future dashes
    if (this.controls.isMoving()) {
      const direction = this.controls.getDirectionVector();
      if (direction.x !== 0 || direction.y !== 0) {
        this.lastMovementDirection = { ...direction };
      }
    }

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
          position.x,
          position.y,
          targetX,
          targetY
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
      targetY: newY,
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
      this.pendingInputs = this.pendingInputs.filter(
        (input) => input.seq > sequence
      );
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
        yoyo: true,
      });
    }

    // Audio feedback
    // If you have sound effects, play them here
    // this.scene.sound.play('bump');
  }

  /**
   * Check if player has a dash charge available
   * @returns {boolean} - True if a dash charge is available
   */
  hasDashCharge() {
    for (const charge of this.dashCharges) {
      if (charge.available) {
        return true;
      }
    }
    return false;
  }

  /**
   * Consume a dash charge and start cooldown
   */
  consumeDashCharge() {
    for (let i = 0; i < this.dashCharges.length; i++) {
      if (this.dashCharges[i].available) {
        this.dashCharges[i].available = false;
        this.dashCharges[i].cooldownEndTime =
          Date.now() + this.dashCooldown * 1000;

        // Start cooldown timer
        this.startChargeCooldown(i);
        break;
      }
    }
  }

  /**
   * Start cooldown for a specific charge
   * @param {number} chargeIndex - Index of the charge
   */
  startChargeCooldown(chargeIndex) {
    setTimeout(() => {
      if (chargeIndex < this.dashCharges.length) {
        this.dashCharges[chargeIndex].available = true;
        this.dashCharges[chargeIndex].cooldownEndTime = 0;

        // Play charge refill effect/sound
        this.playChargeRefillEffect();
      }
    }, this.dashCooldown * 1000);
  }

  /**
   * Play visual effect for dash
   */
  playDashEffect() {
    // If we have a player sprite
    if (this.playerManager && this.playerManager.localPlayer) {
      // Add motion blur or trail effect
      // This would be implemented based on your specific visual style

      // Example: alpha flash
      this.scene.tweens.add({
        targets: this.playerManager.localPlayer,
        alpha: 0.7,
        duration: 50,
        yoyo: true,
      });
    }

    // Play dash sound
    // this.scene.sound.play('dash_sound');
  }

  /**
   * Play visual effect for charge refill
   */
  playChargeRefillEffect() {
    // Visual notification that dash is available again
    // this.scene.sound.play('charge_ready');
    console.log("Dash charge restored!");
  }

  /**
   * Update dash charges from server
   * @param {Array} chargesData - Dash charges data from server
   */
  updateDashCharges(chargesData) {
    // Update charge state from server
    this.dashCharges = chargesData;
  }
}

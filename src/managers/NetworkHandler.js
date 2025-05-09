// src/managers/NetworkHandler.js - With toggleable dash animation

export class NetworkHandler {
  constructor(scene, room, playerId) {
    this.scene = scene;
    this.room = room;
    this.playerId = playerId;
    this.playerManager = null;
    this.inputHandler = null;
    this.reconciliationManager = null;

    // Configuration options
    this.enableDashAnimation = true; // Toggle for dash animations
    this.dashAnimationDuration = 100; // Milliseconds, keep this short (80-120ms recommended)

    // Last received sequence from server
    this.lastProcessedSequence = 0;

    this.playerLatestPositions = new Map(); // Store the latest server position for each player
    this.playerSequenceNumbers = new Map(); // Track latest sequence number for each player
    this.debugPositions = false; // Enable position debug logging

    window.testNetworkHandler = this; // For debugging

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
   * Configure animation settings
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    if (options.enableDashAnimation !== undefined) {
      this.enableDashAnimation = options.enableDashAnimation;
    }

    if (options.dashAnimationDuration !== undefined) {
      this.dashAnimationDuration = options.dashAnimationDuration;
    }

    return this;
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

    // Dash handlers
    this.room.onMessage("playerDashed", this.handlePlayerDashed.bind(this));
    this.room.onMessage(
      "dashChargeRestored",
      this.handleDashChargeRestored.bind(this)
    );
  }

  /**
   * Handle player dash events from other players
   * @param {Object} message - Dash event message
   */
  handlePlayerDashed(message) {
    // Skip if it's the local player (handled by client prediction)
    if (message.id === this.playerId) return;

    // Get the current sequence number
    const currentSeq = this.playerSequenceNumbers.get(message.id) || 0;

    // Log received dash
    this.logPositionDebug(message.id, {
      type: "dash-received",
      text: `Received dash seq=${message.seq || "none"}, current=${currentSeq}`,
      data: {
        from: { x: message.startX, y: message.startY },
        to: { x: message.endX, y: message.endY },
      },
    });

    // Only process if this is a newer message
    if (message.seq && message.seq <= currentSeq) {
      this.logPositionDebug(message.id, {
        type: "dash-ignored",
        text: `Ignoring outdated dash message (seq ${message.seq} <= ${currentSeq})`,
        data: { seq: message.seq, currentSeq },
      });
      return;
    }

    // Update the sequence number
    if (message.seq) {
      this.playerSequenceNumbers.set(message.id, message.seq);
      this.logPositionDebug(message.id, {
        type: "dash-sequpdate",
        text: `Updated sequence to ${message.seq}`,
        data: { oldSeq: currentSeq, newSeq: message.seq },
      });
    }

    // Find the other player sprite
    if (!this.playerManager || !this.playerManager.otherPlayers) return;

    const otherPlayer = this.playerManager.otherPlayers[message.id];
    if (!otherPlayer) return;

    // Get the starting position
    const startX = message.startX;
    const startY = message.startY;

    // Get the end position
    const endX = message.endX;
    const endY = message.endY;

    this.logPositionDebug(message.id, {
      type: "dash-execute",
      text: `Executing dash ${Math.round(startX)},${Math.round(
        startY
      )} -> ${Math.round(endX)},${Math.round(endY)}`,
      data: {
        startPos: { x: startX, y: startY },
        endPos: { x: endX, y: endY },
      },
    });

    // Create visual effects to indicate dash
    this.createDashTrail(startX, startY, endX, endY);

    // Flash effects at start and end
    this.createPositionFlash(startX, startY, 0x00ffff); // Blue flash at start
    this.createPositionFlash(endX, endY, 0xffff00); // Yellow flash at end

    // HANDLE PLAYER POSITION BASED ON ANIMATION TOGGLE
    if (this.enableDashAnimation) {
      // ANIMATION ENABLED:
      // 1. First set player to start position
      otherPlayer.x = startX;
      otherPlayer.y = startY;

      console.log(`Dash animation enabled: ${otherPlayer.x},${otherPlayer.y} -> ${endX},${endY}`);

      // 2. Animate to end position with a short tween
      this.scene.tweens.add({
        targets: otherPlayer,
        x: endX,
        y: endY,
        duration: this.dashAnimationDuration,
        ease: "Sine.Out",
        onUpdate: () => {
          // Update name label position during animation
          if (
            this.playerManager.playerNameLabels &&
            this.playerManager.playerNameLabels[message.id]
          ) {
            const nameLabel = this.playerManager.playerNameLabels[message.id];
            nameLabel.x = otherPlayer.x;
            nameLabel.y = otherPlayer.y - 40;
          }
        },
      });
    } else {
      // ANIMATION DISABLED - INSTANT POSITION UPDATE:
      // Just set to final position immediately
      otherPlayer.x = endX;
      otherPlayer.y = endY;

      // Update name label position
      if (
        this.playerManager.playerNameLabels &&
        this.playerManager.playerNameLabels[message.id]
      ) {
        const nameLabel = this.playerManager.playerNameLabels[message.id];
        nameLabel.x = endX;
        nameLabel.y = endY - 40;
      }
    }

    // In both cases, update target position for interpolation system
    otherPlayer.targetX = endX;
    otherPlayer.targetY = endY;

    // Save the position and sequence as player properties for debugging
    otherPlayer._lastPositionX = endX;
    otherPlayer._lastPositionY = endY;
    otherPlayer._lastPositionSeq = message.seq;
    otherPlayer._lastPositionType = "dash";

    // Add timestamp to record when this position was updated
    otherPlayer._lastPositionUpdate = Date.now();

    // Add wall impact effect if they hit a wall
    if (message.hitWall) {
      this.playOtherPlayerWallImpact(message.id);
    }
  }

  /**
   * Handle dash charge restoration notification
   * @param {Object} message - Dash charge restoration message
   */
  handleDashChargeRestored(message) {
    if (this.inputHandler) {
      const chargeIndex = message.chargeIndex || 0;

      // Update charge
      if (this.inputHandler.dashCharges[chargeIndex]) {
        this.inputHandler.dashCharges[chargeIndex].available = true;
        this.inputHandler.dashCharges[chargeIndex].cooldownEndTime = 0;
      }

      // Play restoration effect if we have a UI for it
      if (this.scene.dashUI) {
        this.scene.dashUI.flashChargeReady(chargeIndex);
      }

      console.log(`Dash charge ${chargeIndex} restored`);
    }
  }

  /**
   * Play wall impact effect for other players
   * @param {string} playerId - Player ID
   */
  playOtherPlayerWallImpact(playerId) {
    const otherPlayer = this.playerManager.otherPlayers[playerId];
    if (!otherPlayer) return;

    // Flash effect
    this.scene.tweens.add({
      targets: otherPlayer,
      alpha: 0.5,
      duration: 50,
      yoyo: true,
      repeat: 1,
    });

    // Could add particles here too
  }

  /**
   * Create a trail effect between start and end positions
   * @param {number} startX - Start X position
   * @param {number} startY - Start Y position
   * @param {number} endX - End X position
   * @param {number} endY - End Y position
   */
  createDashTrail(startX, startY, endX, endY) {
    // Calculate the distance between points
    const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);

    // Calculate the number of trail points based on distance
    const pointCount = Math.min(10, Math.max(5, Math.floor(distance / 20)));

    // Create trail points
    for (let i = 0; i <= pointCount; i++) {
      const progress = i / pointCount;

      // Interpolate position
      const x = startX + (endX - startX) * progress;
      const y = startY + (endY - startY) * progress;

      // Create a trail element
      const trailElement = this.scene.add.circle(
        x,
        y,
        5,
        0x00ffff,
        0.7 - progress * 0.6
      );
      trailElement.setDepth(5); // Behind player but above background

      // Fade out and remove
      this.scene.tweens.add({
        targets: trailElement,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        onComplete: () => {
          trailElement.destroy();
        },
      });
    }
  }

  /**
   * Create a flash effect at a position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} color - Flash color
   */
  createPositionFlash(x, y, color) {
    // Create a circle that expands and fades
    const flash = this.scene.add.circle(x, y, 10, color, 0.7);
    flash.setDepth(6);

    // Expand and fade
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 200,
      onComplete: () => {
        flash.destroy();
      },
    });
  }

  /**
   * Handle input acknowledgement
   * @param {Object} message - Input acknowledgement message
   */
  handleInputAck(message) {
    // Update last processed sequence
    this.lastProcessedSequence = message.seq;

    // Clear acknowledged inputs
    if (this.inputHandler) {
      this.inputHandler.handleInputAck(message.seq);
    }

    // Reconcile if positions don't match
    if (this.reconciliationManager) {
      this.reconciliationManager.reconcile(
        {
          x: message.x,
          y: message.y,
        },
        message.seq,
        message.collided
      );
    }
  }

  /**
   * Handle player moved message
   * @param {Object} message - Player moved message
   */
  handlePlayerMoved(message) {
    // Skip if it's the local player (handled by reconciliation)
    if (message.id === this.playerId) return;

    // Get current sequence number
    const currentSeq = this.playerSequenceNumbers.get(message.id) || 0;

    // Log received movement
    this.logPositionDebug(message.id, {
      type: "move-received",
      text: `Received move seq=${message.seq || "none"}, current=${currentSeq}`,
      data: {
        position: { x: message.x, y: message.y },
      },
    });

    // Only process if this is a newer message
    if (message.seq && message.seq <= currentSeq) {
      this.logPositionDebug(message.id, {
        type: "move-ignored",
        text: `Ignoring outdated move message (seq ${message.seq} <= ${currentSeq})`,
        data: { seq: message.seq, currentSeq },
      });
      return;
    }

    // Check if a position update was recently performed
    let otherPlayer =
      this.playerManager && this.playerManager.otherPlayers
        ? this.playerManager.otherPlayers[message.id]
        : null;

    if (otherPlayer && otherPlayer._lastPositionUpdate) {
      const timeSinceLastUpdate = Date.now() - otherPlayer._lastPositionUpdate;

      this.logPositionDebug(message.id, {
        type: "move-timing",
        text: `Time since last update: ${timeSinceLastUpdate}ms`,
        data: {
          timeSince: timeSinceLastUpdate,
          lastUpdateType: otherPlayer._lastPositionType || "unknown",
          lastPosition: {
            x: otherPlayer._lastPositionX,
            y: otherPlayer._lastPositionY,
          },
          newPosition: { x: message.x, y: message.y },
        },
      });

      // Log if this is a revert to an older position
      if (
        otherPlayer._lastPositionX !== undefined &&
        otherPlayer._lastPositionY !== undefined
      ) {
        const distToPrev = Phaser.Math.Distance.Between(
          message.x,
          message.y,
          otherPlayer._lastPositionX,
          otherPlayer._lastPositionY
        );

        if (distToPrev > 10) {
          // Only log significant position changes
          this.logPositionDebug(message.id, {
            type: "move-distance",
            text: `Distance from last position: ${Math.round(distToPrev)}px`,
            data: { distance: distToPrev },
          });
        }
      }

      // Extra protection against old movements right after a position update
      if (timeSinceLastUpdate < 300) {
        // If this message doesn't have a seq or it's not clearly newer
        if (!message.seq) {
          this.logPositionDebug(message.id, {
            type: "move-protected",
            text: `Protected against unsequenced move too soon after update`,
            data: { timeSince: timeSinceLastUpdate },
          });
          return;
        }
      }
    }

    // Update the sequence number
    if (message.seq) {
      this.playerSequenceNumbers.set(message.id, message.seq);
      this.logPositionDebug(message.id, {
        type: "move-sequpdate",
        text: `Updated sequence to ${message.seq}`,
        data: { oldSeq: currentSeq, newSeq: message.seq },
      });
    }

    // Log position update
    if (otherPlayer) {
      this.logPositionDebug(message.id, {
        type: "move-execute",
        text: `Updating position ${Math.round(otherPlayer.x)},${Math.round(
          otherPlayer.y
        )} -> ${Math.round(message.x)},${Math.round(message.y)}`,
        data: {
          from: { x: otherPlayer.x, y: otherPlayer.y },
          to: { x: message.x, y: message.y },
        },
      });
    }

    // Update player position
    if (this.playerManager) {
      this.playerManager.updateOtherPlayer(
        message.id,
        message.x,
        message.y,
        message.name
      );

      // Save the position for debugging
      otherPlayer = this.playerManager.otherPlayers[message.id];
      if (this.playerManager.otherPlayers[message.id]) {
        otherPlayer._lastPositionX = message.x;
        otherPlayer._lastPositionY = message.y;
        otherPlayer._lastPositionSeq = message.seq;
        otherPlayer._lastPositionType = "move";
        otherPlayer._lastPositionUpdate = Date.now();
      }
    }
  }

  /**
   * Handle player joined message
   * @param {Object} message - Player joined message
   */
  handlePlayerJoined(message) {
    // Skip if it's the local player
    if (message.id === this.playerId) return;

    // Create other player
    if (this.playerManager) {
      const x = message.position ? message.position.x : 400;
      const y = message.position ? message.position.y : 300;

      this.playerManager.updateOtherPlayer(message.id, x, y, message.name);
    }
  }

  /**
   * Handle player left message
   * @param {Object} message - Player left message
   */
  handlePlayerLeft(message) {
    // Remove from sequence mapping
    this.playerSequenceNumbers.delete(message.id);

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
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error sending input batch to server:", error);
    }
  }

  logPositionDebug(playerId, message) {
    if (!this.debugPositions) return;

    // Create a short player ID for readability
    const shortId = playerId.substring(0, 4);

    // Format position for logging
    const formatPos = (x, y) => `(${Math.round(x)},${Math.round(y)})`;

    // Log the message with color for different message types
    const messageType = message.type || "unknown";
    let logPrefix = `[${shortId}|${messageType}]`;

    // Different colors for different message types
    if (messageType.includes("dash")) {
      console.log(
        `%c${logPrefix} ${message.text}`,
        "color: #ff00ff",
        message.data
      );
    } else if (messageType.includes("move")) {
      console.log(
        `%c${logPrefix} ${message.text}`,
        "color: #00aaff",
        message.data
      );
    } else {
      console.log(
        `%c${logPrefix} ${message.text}`,
        "color: #aaaaaa",
        message.data
      );
    }
  }
}

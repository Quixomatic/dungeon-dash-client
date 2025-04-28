// src/utils/controls.js

/**
 * Sets up and handles player movement with both WASD and arrow keys
 * @param {Phaser.Scene} scene - The scene containing the player
 * @param {Phaser.GameObjects.Sprite} playerSprite - The player sprite to move
 * @param {Function} onInputCallback - Callback function when input changes
 * @param {number} speed - Movement speed (default: 5)
 * @returns {Object} - Movement control object
 */
export function setupPlayerControls(scene, playerSprite, onInputCallback, speed = 5) {
    // Set up cursor keys (arrows)
    const cursors = scene.input.keyboard.createCursorKeys();
    
    // Set up WASD keys
    const wasd = {
      up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    
    // Track current input state
    const inputState = {
      up: false,
      down: false,
      left: false,
      right: false,
      changed: false
    };
    
    const controls = {
      cursors,
      wasd,
      inputState,
      speed,
      enabled: true,
      
      /**
       * Handle movement in update loop
       * @param {number} moveSpeed - Movement speed (optional, uses default if not provided)
       * @param {Object} bounds - Boundary constraints
       * @returns {boolean} - True if player moved
       */
      update: function(moveSpeed = speed, bounds = { minX: 0, maxX: 800, minY: 0, maxY: 600 }) {
        if (!this.enabled) return false;
        
        // Store previous input state
        const prevState = { ...inputState };
        
        // Update input state
        inputState.left = cursors.left.isDown || wasd.left.isDown;
        inputState.right = cursors.right.isDown || wasd.right.isDown;
        inputState.up = cursors.up.isDown || wasd.up.isDown;
        inputState.down = cursors.down.isDown || wasd.down.isDown;
        
        // Check if input state changed
        inputState.changed = (
          prevState.left !== inputState.left ||
          prevState.right !== inputState.right ||
          prevState.up !== inputState.up ||
          prevState.down !== inputState.down
        );
        
        // If input changed, notify callback
        if (inputState.changed && onInputCallback) {
          onInputCallback({ ...inputState });
        }
        
        // Apply movement locally
        let moved = false;
        
        if (inputState.left) {
          playerSprite.x -= moveSpeed;
          moved = true;
        } else if (inputState.right) {
          playerSprite.x += moveSpeed;
          moved = true;
        }
        
        if (inputState.up) {
          playerSprite.y -= moveSpeed;
          moved = true;
        } else if (inputState.down) {
          playerSprite.y += moveSpeed;
          moved = true;
        }
        
        // Keep player in bounds
        playerSprite.x = Phaser.Math.Clamp(playerSprite.x, bounds.minX, bounds.maxX);
        playerSprite.y = Phaser.Math.Clamp(playerSprite.y, bounds.minY, bounds.maxY);
        
        return moved;
      },
      
      /**
       * Set custom movement speed
       * @param {number} newSpeed - New movement speed
       */
      setSpeed: function(newSpeed) {
        speed = newSpeed;
        this.speed = newSpeed;
      },
      
      /**
       * Disable controls temporarily
       */
      disable: function() {
        this.enabled = false;
      },
      
      /**
       * Enable controls
       */
      enable: function() {
        this.enabled = true;
      },
      
      /**
       * Get current input state
       * @returns {Object} - Current input state
       */
      getInputState: function() {
        return { ...inputState };
      }
    };
    
    return controls;
  }
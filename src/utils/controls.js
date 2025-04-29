// src/utils/controls.js

/**
 * Creates a controls handler for player movement
 * @param {Phaser.Scene} scene - The scene to add controls to
 * @returns {Object} - Controls object
 */
export function createControls(scene) {
  // Set up cursor keys
  const cursors = scene.input.keyboard.createCursorKeys();
  
  // Set up WASD keys
  const wasd = {
    up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
  };
  
  return {
    cursors,
    wasd,
    
    /**
     * Get current input state
     * @returns {Object} - Current input state
     */
    getInputState() {
      return {
        up: cursors.up.isDown || wasd.up.isDown,
        down: cursors.down.isDown || wasd.down.isDown,
        left: cursors.left.isDown || wasd.left.isDown,
        right: cursors.right.isDown || wasd.right.isDown
      };
    },
    
    /**
     * Check if any movement key is pressed
     * @returns {boolean} - True if any movement key is pressed
     */
    isMoving() {
      const state = this.getInputState();
      return state.up || state.down || state.left || state.right;
    },
    
    /**
     * Returns input as a direction vector
     * @returns {Object} - Direction vector {x, y}
     */
    getDirectionVector() {
      const state = this.getInputState();
      const vector = { x: 0, y: 0 };
      
      if (state.left) vector.x -= 1;
      if (state.right) vector.x += 1;
      if (state.up) vector.y -= 1;
      if (state.down) vector.y += 1;
      
      // Normalize diagonal movement
      if (vector.x !== 0 && vector.y !== 0) {
        const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        vector.x /= length;
        vector.y /= length;
      }
      
      return vector;
    }
  };
}
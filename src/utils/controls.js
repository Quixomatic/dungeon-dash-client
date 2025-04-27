// src/utils/controls.js

/**
 * Sets up and handles player movement with both WASD and arrow keys
 * @param {Phaser.Scene} scene - The scene containing the player
 * @param {Phaser.GameObjects.Sprite} playerSprite - The player sprite to move
 * @param {Function} onMoveCallback - Callback function when player moves
 * @returns {Object} - Movement control object
 */
export function setupPlayerControls(scene, playerSprite, onMoveCallback) {
    // Set up cursor keys (arrows)
    const cursors = scene.input.keyboard.createCursorKeys();
    
    // Set up WASD keys
    const wasd = {
      up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    
    const controls = {
      cursors,
      wasd,
      
      // Handle movement in update loop
      update: function(speed = 5, bounds = { minX: 0, maxX: 800, minY: 0, maxY: 600 }) {
        let moved = false;
        
        // Left movement (left arrow or A)
        if (cursors.left.isDown || wasd.left.isDown) {
          playerSprite.x -= speed;
          moved = true;
        } 
        // Right movement (right arrow or D)
        else if (cursors.right.isDown || wasd.right.isDown) {
          playerSprite.x += speed;
          moved = true;
        }
        
        // Up movement (up arrow or W)
        if (cursors.up.isDown || wasd.up.isDown) {
          playerSprite.y -= speed;
          moved = true;
        } 
        // Down movement (down arrow or S)
        else if (cursors.down.isDown || wasd.down.isDown) {
          playerSprite.y += speed;
          moved = true;
        }
        
        // Keep player in bounds
        playerSprite.x = Phaser.Math.Clamp(playerSprite.x, bounds.minX, bounds.maxX);
        playerSprite.y = Phaser.Math.Clamp(playerSprite.y, bounds.minY, bounds.maxY);
        
        // Call move callback if player moved
        if (moved && onMoveCallback) {
          onMoveCallback(playerSprite.x, playerSprite.y);
        }
        
        return moved;
      }
    };
    
    return controls;
  }
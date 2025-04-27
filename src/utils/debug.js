// src/utils/debug.js

/**
 * Creates and manages debug text displays in a scene
 * @param {Phaser.Scene} scene - The scene to add debug info to
 * @param {Object} options - Configuration options
 * @returns {Object} - Debug utility object
 */
export function createDebugHelper(scene, options = {}) {
    const config = {
      x: options.x || 20,
      y: options.y || 520,
      color: options.color || '#aaaaaa',
      fontSize: options.fontSize || '14px',
      backgroundColor: options.backgroundColor,
      padding: options.padding || { x: 5, y: 5 }
    };
    
    // Create debug text object
    const debugText = scene.add.text(
      config.x,
      config.y,
      'Debug: Initializing...',
      {
        fontSize: config.fontSize,
        fill: config.color,
        backgroundColor: config.backgroundColor,
        padding: config.padding
      }
    );
    
    // Add scene identifier label
    const sceneLabel = scene.add.text(
      options.sceneLabelX || 750,
      options.sceneLabelY || 20,
      options.sceneName || scene.scene.key,
      {
        fontSize: '16px',
        fontStyle: 'bold',
        fill: options.sceneLabelColor || '#ff9900',
        backgroundColor: '#333333',
        padding: { x: 8, y: 4 }
      }
    ).setOrigin(1, 0);
    
    return {
      debugText,
      sceneLabel,
      
      /**
       * Updates the debug text content
       * @param {string} text - Text to display
       */
      setText: function(text) {
        debugText.setText(text);
      },
      
      /**
       * Updates the debug text with an object's properties
       * @param {Object} data - Object with properties to display
       */
      displayObject: function(data) {
        const lines = Object.entries(data).map(([key, value]) => {
          // Handle different value types
          let displayValue = value;
          if (typeof value === 'object' && value !== null) {
            // Convert objects to string
            if (Array.isArray(value)) {
              displayValue = `[${value.join(', ')}]`;
            } else {
              displayValue = JSON.stringify(value);
            }
          }
          return `${key}: ${displayValue}`;
        });
        
        debugText.setText(lines.join('\n'));
      }
    };
  }
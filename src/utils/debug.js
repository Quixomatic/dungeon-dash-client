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
    
    // Set higher depth to ensure visibility
    debugText.setDepth(1000);
    sceneLabel.setDepth(1000);
    
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
      },
      
      /**
       * Shows a temporary message
       * @param {string} message - Message to display
       * @param {number} duration - Duration in milliseconds
       */
      showMessage: function(message, duration = 3000) {
        const originalText = debugText.text;
        
        // Show message
        debugText.setText(message);
        
        // Reset after duration
        scene.time.delayedCall(duration, () => {
          debugText.setText(originalText);
        });
      },
      
      /**
       * Add a debugging line or shape
       * @param {string} type - Shape type (line, rectangle, circle)
       * @param {Object} params - Shape parameters
       * @param {number} color - Color in hex format
       */
      drawShape: function(type, params, color = 0xff0000) {
        // Create graphics object if not exists
        if (!this.graphics) {
          this.graphics = scene.add.graphics();
          this.graphics.setDepth(999);
        }
        
        // Clear previous drawings
        this.graphics.clear();
        this.graphics.lineStyle(2, color, 1);
        
        // Draw based on type
        switch (type) {
          case 'line':
            this.graphics.lineBetween(
              params.x1, params.y1, params.x2, params.y2
            );
            break;
          case 'rectangle':
            this.graphics.strokeRect(
              params.x, params.y, params.width, params.height
            );
            break;
          case 'circle':
            this.graphics.strokeCircle(
              params.x, params.y, params.radius
            );
            break;
        }
      },
      
      /**
       * Toggle visibility of debug elements
       * @param {boolean} visible - Visibility state
       */
      setVisible: function(visible) {
        debugText.setVisible(visible);
        sceneLabel.setVisible(visible);
        if (this.graphics) {
          this.graphics.setVisible(visible);
        }
      }
    };
  }
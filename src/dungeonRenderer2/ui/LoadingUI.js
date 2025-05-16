// src/dungeonRenderer/ui/LoadingUI.js
/**
 * LoadingUI - Creates and manages loading UI elements
 * Provides visual feedback during dungeon generation and asset loading
 */
export class LoadingUI {
    constructor(scene) {
      this.scene = scene;
      this.container = null;
      this.background = null;
      this.progressBar = null;
      this.progressText = null;
      this.messageText = null;
      this.floorInfo = null;
      this.visible = false;
      this.progress = 0;
      this.message = "Loading...";
      
      // Additional animated elements
      this.spinnerGraphic = null;
      this.spinnerAngle = 0;
      this.tilePreviewContainer = null;
      
      // Customization options
      this.backgroundColor = 0x000000;
      this.backgroundAlpha = 0.7;
      this.barColor = 0x00aa00;
      this.barBorderColor = 0xffffff;
      this.textColor = '#ffffff';
      this.spinnerColor = 0xffaa00;
    }
    
    /**
     * Initialize the loading UI
     * @param {Object} options - Initialization options
     */
    init(options = {}) {
      // Apply options
      if (options.backgroundColor !== undefined) this.backgroundColor = options.backgroundColor;
      if (options.backgroundAlpha !== undefined) this.backgroundAlpha = options.backgroundAlpha;
      if (options.barColor !== undefined) this.barColor = options.barColor;
      if (options.barBorderColor !== undefined) this.barBorderColor = options.barBorderColor;
      if (options.textColor !== undefined) this.textColor = options.textColor;
      if (options.spinnerColor !== undefined) this.spinnerColor = options.spinnerColor;
      
      // Create container for all UI elements
      this.container = this.scene.add.container(0, 0);
      this.container.setDepth(1000); // Ensure it's above everything
      this.container.setScrollFactor(0); // Fixed to camera
      
      // Create UI elements
      this.createUIElements();
      
      // Hide initially
      this.hide();
      
      return this;
    }
    
    /**
     * Create all UI elements
     */
    createUIElements() {
      // Get camera dimensions
      const width = this.scene.cameras.main.width;
      const height = this.scene.cameras.main.height;
      
      // Create semi-transparent background covering entire screen
      this.background = this.scene.add.rectangle(
        0, 0, width, height, 
        this.backgroundColor, this.backgroundAlpha
      ).setOrigin(0, 0);
      
      // Create centered progress bar
      const barWidth = Math.min(width * 0.7, 500);
      const barHeight = 30;
      const barX = (width - barWidth) / 2;
      const barY = height / 2;
      
      // Bar background/border
      this.barBackground = this.scene.add.rectangle(
        barX, barY, barWidth, barHeight,
        this.barBorderColor, 1
      ).setOrigin(0, 0.5);
      
      // Progress fill
      this.progressBar = this.scene.add.rectangle(
        barX + 2, barY, 0, barHeight - 4,
        this.barColor, 1
      ).setOrigin(0, 0.5);
      
      // Progress text
      this.progressText = this.scene.add.text(
        width / 2, barY + barHeight + 10,
        '0%', 
        { 
          fontSize: '18px', 
          fill: this.textColor, 
          fontStyle: 'bold' 
        }
      ).setOrigin(0.5);
      
      // Main message text
      this.messageText = this.scene.add.text(
        width / 2, barY - barHeight - 10,
        this.message, 
        { 
          fontSize: '24px', 
          fill: this.textColor,
          fontStyle: 'bold'
        }
      ).setOrigin(0.5);
      
      // Floor info text (when transitioning)
      this.floorInfo = this.scene.add.text(
        width / 2, barY - barHeight - 50,
        '', 
        { 
          fontSize: '32px',
          fill: this.textColor,
          fontStyle: 'bold'
        }
      ).setOrigin(0.5);
      
      // Create animated spinner
      this.createSpinner(width / 2, height / 2 + 80);
      
      // Create tile preview animation
      this.createTilePreview(width / 2, height / 2 - 100);
      
      // Add all elements to container
      this.container.add([
        this.background,
        this.barBackground,
        this.progressBar, 
        this.progressText,
        this.messageText,
        this.floorInfo,
        this.spinnerGraphic
      ]);
      
      // Add tile preview elements
      if (this.tilePreviewContainer) {
        this.container.add(this.tilePreviewContainer);
      }
    }
    
    /**
     * Create animated spinner
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    createSpinner(x, y) {
      this.spinnerGraphic = this.scene.add.graphics();
      this.spinnerGraphic.x = x;
      this.spinnerGraphic.y = y;
      
      // Draw initial spinner
      this.updateSpinner();
      
      // Set up animation
      this.scene.time.addEvent({
        delay: 30,
        callback: this.updateSpinner,
        callbackScope: this,
        loop: true
      });
    }
    
    /**
     * Update spinner animation
     */
    updateSpinner() {
      if (!this.spinnerGraphic) return;
      
      // Increment angle
      this.spinnerAngle = (this.spinnerAngle + 10) % 360;
      
      // Clear and redraw
      this.spinnerGraphic.clear();
      this.spinnerGraphic.lineStyle(4, this.spinnerColor, 1);
      
      // Draw a partial circle
      this.spinnerGraphic.beginPath();
      this.spinnerGraphic.arc(
        0, 0, 20,
        Phaser.Math.DegToRad(this.spinnerAngle), 
        Phaser.Math.DegToRad(this.spinnerAngle + 270), 
        false
      );
      this.spinnerGraphic.strokePath();
      
      // Only visible when container is visible
      this.spinnerGraphic.visible = this.visible;
    }
    
    /**
     * Create tile preview animation showing different tile types
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    createTilePreview(x, y) {
      if (!this.scene.textures.exists('tile_0') && 
          !this.scene.textures.exists('floor')) {
        // Skip if we don't have tile textures yet
        return;
      }
      
      this.tilePreviewContainer = this.scene.add.container(x, y);
      
      // Create a few sample tiles
      const tileTypes = [
        { key: 'tile_0', fallback: 'floor' },
        { key: 'tile_1', fallback: 'wall' },
        { key: 'tile_12', fallback: 'wall' },
        { key: 'tile_46', fallback: 'wall' }
      ];
      
      const tileSize = 32;
      const spacing = tileSize + 10;
      const startX = -(spacing * (tileTypes.length - 1)) / 2;
      
      // Create each preview tile
      tileTypes.forEach((type, index) => {
        let sprite;
        
        // Try to use the specified texture
        if (this.scene.textures.exists(type.key)) {
          sprite = this.scene.add.sprite(
            startX + spacing * index, 0, type.key
          );
        } 
        // Fall back to alternative texture
        else if (this.scene.textures.exists(type.fallback)) {
          sprite = this.scene.add.sprite(
            startX + spacing * index, 0, type.fallback
          );
        }
        // Create rectangle if no texture available
        else {
          sprite = this.scene.add.rectangle(
            startX + spacing * index, 0, 
            tileSize, tileSize,
            index === 0 ? 0x333333 : 0x666666
          );
        }
        
        // Resize to tile preview size
        if (sprite.setDisplaySize) {
          sprite.setDisplaySize(tileSize, tileSize);
        }
        
        // Add to preview container
        this.tilePreviewContainer.add(sprite);
        
        // Add hover animation
        this.scene.tweens.add({
          targets: sprite,
          y: { from: -5, to: 5 },
          duration: 1000 + index * 200,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1
        });
      });
    }
    
    /**
     * Show the loading UI
     * @param {string} message - Optional message to display
     * @param {string} floorText - Optional floor information
     */
    show(message = null, floorText = null) {
      if (message) {
        this.setMessage(message);
      }
      
      if (floorText) {
        this.setFloorInfo(floorText);
      }
      
      this.container.setVisible(true);
      this.visible = true;
      
      // Start with 0% progress
      this.updateProgress(0);
      
      return this;
    }
    
    /**
     * Hide the loading UI
     */
    hide() {
      this.container.setVisible(false);
      this.visible = false;
      return this;
    }
    
    /**
     * Set the displayed message
     * @param {string} message - Message to display
     */
    setMessage(message) {
      this.message = message;
      if (this.messageText) {
        this.messageText.setText(message);
      }
      return this;
    }
    
    /**
     * Set the floor information text
     * @param {string} text - Floor information to display
     */
    setFloorInfo(text) {
      if (this.floorInfo) {
        this.floorInfo.setText(text);
        
        // Add a scaling effect when floor info changes
        this.scene.tweens.add({
          targets: this.floorInfo,
          scale: { from: 1.5, to: 1 },
          duration: 500,
          ease: 'Back.easeOut'
        });
      }
      return this;
    }
    
    /**
     * Update the progress bar and text
     * @param {number} value - Progress value (0-1)
     */
    updateProgress(value) {
      // Clamp value between 0 and 1
      this.progress = Math.max(0, Math.min(1, value));
      
      // Update progress bar width
      if (this.progressBar && this.barBackground) {
        const maxWidth = this.barBackground.width - 4; // Account for border
        this.progressBar.width = maxWidth * this.progress;
      }
      
      // Update text
      if (this.progressText) {
        this.progressText.setText(`${Math.round(this.progress * 100)}%`);
      }
      
      return this;
    }
    
    /**
     * Add a loading stage completion effect
     * @param {string} stageName - Name of the completed stage
     */
    completeStage(stageName) {
      // Create a flying text element
      const width = this.scene.cameras.main.width;
      const height = this.scene.cameras.main.height;
      
      const stageText = this.scene.add.text(
        width / 2, height / 2,
        `${stageName} completed!`,
        {
          fontSize: '20px',
          fill: '#00ff00',
          fontStyle: 'bold',
          stroke: '#000000', 
          strokeThickness: 3
        }
      ).setOrigin(0.5);
      
      // Add to container
      this.container.add(stageText);
      
      // Create flying animation
      this.scene.tweens.add({
        targets: stageText,
        y: height / 2 - 100,
        alpha: { from: 1, to: 0 },
        duration: 1000,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          stageText.destroy();
        }
      });
      
      return this;
    }
    
    /**
     * Show a success animation when loading is complete
     * @param {Function} onComplete - Callback to run when animation completes
     */
    showSuccess(onComplete = null) {
      // Update message
      this.setMessage('Loading complete!');
      
      // Fill progress bar
      this.updateProgress(1);
      
      // Flash the progress bar
      this.scene.tweens.add({
        targets: this.progressBar,
        fillColor: { from: this.barColor, to: 0x00ff00 },
        yoyo: true,
        repeat: 3,
        duration: 200,
        onComplete: () => {
          // Fade out with slight delay
          this.scene.time.delayedCall(400, () => {
            this.scene.tweens.add({
              targets: this.container,
              alpha: 0,
              duration: 500,
              onComplete: () => {
                this.hide();
                this.container.alpha = 1;
                
                // Call completion callback if provided
                if (onComplete && typeof onComplete === 'function') {
                  onComplete();
                }
              }
            });
          });
        }
      });
      
      return this;
    }
    
    /**
     * Show an error state
     * @param {string} errorMessage - Error message to display
     */
    showError(errorMessage) {
      // Update message
      this.setMessage('Loading Error');
      
      // Set error color
      this.progressBar.fillColor = 0xff0000;
      
      // Add error details below
      const width = this.scene.cameras.main.width;
      const height = this.scene.cameras.main.height;
      
      const errorText = this.scene.add.text(
        width / 2, height / 2 + 60,
        errorMessage,
        {
          fontSize: '16px',
          fill: '#ff7777',
          align: 'center',
          wordWrap: { width: width * 0.7 }
        }
      ).setOrigin(0.5);
      
      // Add to container
      this.container.add(errorText);
      
      // Add retry button
      const retryButton = this.scene.add.text(
        width / 2, height / 2 + 120,
        'Retry',
        {
          fontSize: '20px',
          fill: '#ffffff',
          backgroundColor: '#773333',
          padding: { x: 20, y: 10 }
        }
      ).setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      
      // Button interactions
      retryButton.on('pointerover', () => {
        retryButton.setBackgroundColor('#aa4444');
      });
      
      retryButton.on('pointerout', () => {
        retryButton.setBackgroundColor('#773333');
      });
      
      retryButton.on('pointerdown', () => {
        // Remove error elements
        errorText.destroy();
        retryButton.destroy();
        
        // Reset progress bar color
        this.progressBar.fillColor = this.barColor;
        
        // Emit retry event
        this.scene.events.emit('loadingui-retry');
        
        // Reset UI to initial state
        this.setMessage('Retrying...');
        this.updateProgress(0);
      });
      
      this.container.add(retryButton);
      
      return this;
    }
    
    /**
     * Handle resize event
     * @param {number} width - New width
     * @param {number} height - New height
     */
    handleResize(width, height) {
      // Update background to cover screen
      if (this.background) {
        this.background.width = width;
        this.background.height = height;
      }
      
      // Update progress bar position and size
      const barWidth = Math.min(width * 0.7, 500);
      const barHeight = 30;
      const barX = (width - barWidth) / 2;
      const barY = height / 2;
      
      if (this.barBackground) {
        this.barBackground.x = barX;
        this.barBackground.y = barY;
        this.barBackground.width = barWidth;
        this.barBackground.height = barHeight;
      }
      
      if (this.progressBar) {
        this.progressBar.x = barX + 2;
        this.progressBar.y = barY;
        this.progressBar.width = (barWidth - 4) * this.progress;
        this.progressBar.height = barHeight - 4;
      }
      
      // Update text positions
      if (this.progressText) {
        this.progressText.x = width / 2;
        this.progressText.y = barY + barHeight + 10;
      }
      
      if (this.messageText) {
        this.messageText.x = width / 2;
        this.messageText.y = barY - barHeight - 10;
      }
      
      if (this.floorInfo) {
        this.floorInfo.x = width / 2;
        this.floorInfo.y = barY - barHeight - 50;
      }
      
      // Update spinner position
      if (this.spinnerGraphic) {
        this.spinnerGraphic.x = width / 2;
        this.spinnerGraphic.y = height / 2 + 80;
      }
      
      // Update tile preview position
      if (this.tilePreviewContainer) {
        this.tilePreviewContainer.x = width / 2;
        this.tilePreviewContainer.y = height / 2 - 100;
      }
      
      return this;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
      if (this.container) {
        this.container.destroy(true);
        this.container = null;
      }
      
      this.spinnerGraphic = null;
      this.tilePreviewContainer = null;
      this.background = null;
      this.progressBar = null;
      this.progressText = null;
      this.messageText = null;
      this.floorInfo = null;
    }
  }
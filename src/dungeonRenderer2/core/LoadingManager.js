// src/dungeonRenderer/core/LoadingManager.js

/**
 * LoadingManager - Manages loading screen and progress tracking
 * Provides user feedback during dungeon loading process
 */
export class LoadingManager {
    /**
     * Create a new LoadingManager
     * @param {Phaser.Scene} scene - The Phaser scene to render in
     */
    constructor(scene) {
      this.scene = scene;
      this.container = null;
      this.progressBar = null;
      this.progressText = null;
      this.messageText = null;
      this.progressBarWidth = 400;
      this.progressBarHeight = 30;
      this.visible = false;
      this.debug = false;
      this.isInitialized = false;
    }
    
    /**
     * Initialize the loading manager
     * @param {Object} options - Configuration options
     * @returns {LoadingManager} - This instance for chaining
     */
    init(options = {}) {
      if (this.isInitialized) return this;
      
      this.progressBarWidth = options.progressBarWidth || this.progressBarWidth;
      this.progressBarHeight = options.progressBarHeight || this.progressBarHeight;
      this.debug = options.debug || false;
      
      // Create UI container
      this.container = this.scene.add.container(0, 0);
      this.container.setDepth(1000); // Make sure it's above everything
      this.container.setScrollFactor(0); // Fixed to camera
      
      // Set initial visibility
      this.container.setVisible(false);
      this.visible = false;
      
      this.isInitialized = true;
      return this;
    }
    
    /**
     * Create loading UI elements
     * @private
     */
    createLoadingUI() {
      // Clear any existing UI
      this.container.removeAll(true);
      
      // Get screen dimensions
      const { width, height } = this.scene.cameras.main;
      
      // Create semi-transparent background
      const background = this.scene.add.rectangle(
        0, 0, width, height, 0x000000, 0.7
      ).setOrigin(0);
      
      // Create progress bar background
      const barBackground = this.scene.add.rectangle(
        width / 2, height / 2,
        this.progressBarWidth + 4, this.progressBarHeight + 4,
        0x333333, 1
      ).setOrigin(0.5);
      
      // Create progress bar
      this.progressBar = this.scene.add.rectangle(
        width / 2 - this.progressBarWidth / 2, height / 2 - this.progressBarHeight / 2,
        0, this.progressBarHeight,
        0x00ff00, 1
      ).setOrigin(0);
      
      // Create message text
      this.messageText = this.scene.add.text(
        width / 2, height / 2 - 50,
        'Loading...',
        { fontSize: '24px', fill: '#ffffff' }
      ).setOrigin(0.5);
      
      // Create progress text
      this.progressText = this.scene.add.text(
        width / 2, height / 2 + 50,
        '0%',
        { fontSize: '18px', fill: '#ffffff' }
      ).setOrigin(0.5);
      
      // Add all elements to container
      this.container.add([
        background,
        barBackground,
        this.progressBar,
        this.messageText,
        this.progressText
      ]);
      
      if (this.debug) {
        console.log('Loading UI created');
      }
    }
    
    /**
     * Show the loading UI with a message
     * @param {string} message - Message to display
     * @param {number} progress - Initial progress (0-1)
     */
    showLoadingUI(message = 'Loading...', progress = 0) {
      if (!this.isInitialized) {
        console.error('LoadingManager not initialized');
        return;
      }
      
      // Create UI if it doesn't exist
      if (this.container.length === 0) {
        this.createLoadingUI();
      }
      
      // Update message and progress
      if (this.messageText) {
        this.messageText.setText(message);
      }
      
      // Update progress
      this.updateProgress(progress);
      
      // Show container
      this.container.setVisible(true);
      this.visible = true;
      
      if (this.debug) {
        console.log(`Loading UI shown: "${message}"`);
      }
    }
    
    /**
     * Update the progress bar and text
     * @param {number} progress - Progress value (0-1)
     */
    updateProgress(progress) {
      if (!this.isInitialized || !this.visible) return;
      
      // Clamp progress value
      progress = Math.max(0, Math.min(1, progress));
      
      // Update progress bar width
      if (this.progressBar) {
        this.progressBar.width = this.progressBarWidth * progress;
      }
      
      // Update progress text
      if (this.progressText) {
        this.progressText.setText(`${Math.round(progress * 100)}%`);
      }
      
      if (this.debug && progress % 0.1 < 0.01) {
        console.log(`Loading progress: ${Math.round(progress * 100)}%`);
      }
    }
    
    /**
     * Hide the loading UI
     */
    hideLoadingUI() {
      if (!this.isInitialized) return;
      
      this.container.setVisible(false);
      this.visible = false;
      
      if (this.debug) {
        console.log('Loading UI hidden');
      }
    }
    
    /**
     * Show an error message
     * @param {string} message - Error message to display
     * @param {Function} onClose - Optional callback when closed
     */
    showError(message, onClose = null) {
      if (!this.isInitialized) return;
      
      // Get screen dimensions
      const { width, height } = this.scene.cameras.main;
      
      // Create error container
      const errorContainer = this.scene.add.container(0, 0);
      errorContainer.setDepth(1001); // Above loading UI
      errorContainer.setScrollFactor(0);
      
      // Create semi-transparent background
      const background = this.scene.add.rectangle(
        0, 0, width, height, 0x000000, 0.8
      ).setOrigin(0);
      
      // Create error panel
      const panel = this.scene.add.rectangle(
        width / 2, height / 2,
        400, 250,
        0x330000, 1
      ).setOrigin(0.5);
      
      // Create border
      const border = this.scene.add.rectangle(
        width / 2, height / 2,
        404, 254,
        0xff0000, 1
      ).setOrigin(0.5).setStrokeStyle(4, 0xff0000);
      
      // Create error text
      const errorText = this.scene.add.text(
        width / 2, height / 2 - 40,
        'Error',
        { fontSize: '28px', fill: '#ff0000', fontStyle: 'bold' }
      ).setOrigin(0.5);
      
      // Create message text
      const messageText = this.scene.add.text(
        width / 2, height / 2 + 10,
        message,
        { fontSize: '18px', fill: '#ffffff', align: 'center', wordWrap: { width: 380 } }
      ).setOrigin(0.5);
      
      // Create close button
      const closeButton = this.scene.add.rectangle(
        width / 2, height / 2 + 80,
        120, 40,
        0xff0000, 1
      ).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      const closeText = this.scene.add.text(
        width / 2, height / 2 + 80,
        'Close',
        { fontSize: '18px', fill: '#ffffff' }
      ).setOrigin(0.5);
      
      // Set up close button event
      closeButton.on('pointerdown', () => {
        errorContainer.destroy();
        if (typeof onClose === 'function') {
          onClose();
        }
      });
      
      // Add hover effect
      closeButton.on('pointerover', () => {
        closeButton.setFillStyle(0xaa0000);
      });
      
      closeButton.on('pointerout', () => {
        closeButton.setFillStyle(0xff0000);
      });
      
      // Add all elements to container
      errorContainer.add([
        background,
        border,
        panel,
        errorText,
        messageText,
        closeButton,
        closeText
      ]);
      
      if (this.debug) {
        console.log(`Error shown: "${message}"`);
      }
    }
    
    /**
     * Destroy the loading manager and clean up resources
     */
    destroy() {
      if (this.container) {
        this.container.destroy();
        this.container = null;
      }
      
      this.progressBar = null;
      this.progressText = null;
      this.messageText = null;
      this.isInitialized = false;
    }
  }
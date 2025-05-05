// src/managers/UIManager.js - Updated for new dungeon format
import gameState from '../systems/GameState.js';

export class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.infoText = null;
    this.playerCountText = null;
    this.phaseText = null;
    this.announcementText = null;
    this.warningText = null;
    this.notificationQueue = [];
    this.notificationActive = false;
  }
  
  initialize() {
    console.log("Initializing UIManager");
    
    // Create UI elements
    this.createUIElements();
    
    // Listen for game state changes
    this.setupGameStateListeners();
  }
  
  createUIElements() {
    // Info text - positioned at top left
    this.infoText = this.scene.add.text(20, 40, 'Use WASD or arrow keys to move', {
      fontSize: '16px',
      fill: '#ffffff',
      backgroundColor: '#00000080',
      padding: { x: 8, y: 4 }
    }).setScrollFactor(0).setDepth(1000);
    
    // Player count text
    this.playerCountText = this.scene.add.text(20, 70, 'Players: 0', {
      fontSize: '16px',
      fill: '#ffffff',
      backgroundColor: '#00000080',
      padding: { x: 8, y: 4 }
    }).setScrollFactor(0).setDepth(1000);
    
    // Phase text
    this.phaseText = this.scene.add.text(20, 100, 'Phase: DUNGEON', {
      fontSize: '16px',
      fill: '#ffffff',
      backgroundColor: '#00000080',
      padding: { x: 8, y: 4 }
    }).setScrollFactor(0).setDepth(1000);
    
    // Announcement container (center of screen)
    this.announcementContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1001);
    this.announcementText = null;
    
    // Warning container (top center)
    this.warningContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1002);
    this.warningText = null;
    
    // Notification container (bottom right)
    this.notificationContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1003);
    
    // Update player count and phase immediately
    this.updatePlayerCount();
    this.updatePhase(gameState.getPhase());
  }
  
  setupGameStateListeners() {
    // Listen for phase changes
    gameState.addEventListener('phaseChange', data => {
      this.updatePhase(data.newPhase);
    });
    
    // Listen for player count changes
    gameState.addEventListener('playerJoined', () => {
      this.updatePlayerCount();
    });
    
    gameState.addEventListener('playerLeft', () => {
      this.updatePlayerCount();
    });
  }
  
  updatePlayerCount() {
    const count = gameState.getPlayerCount();
    this.playerCountText.setText(`Players: ${count}`);
  }
  
  updatePhase(phase) {
    this.phaseText.setText(`Phase: ${phase.toUpperCase()}`);
  }
  
  /**
   * Show a global event notification
   * @param {string} message - Message to display
   */
  showGlobalEventNotification(message) {
    // Create notification at the top of the screen
    const notification = this.scene.add.text(400, 120, message, {
      fontSize: '18px',
      fontStyle: 'bold',
      fill: '#ffff00',
      backgroundColor: '#33333399',
      padding: { x: 16, y: 8 },
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    
    // Fade out after a few seconds
    this.scene.tweens.add({
      targets: notification,
      alpha: 0,
      y: 100,
      duration: 5000,
      ease: 'Power2',
      onComplete: () => {
        notification.destroy();
      }
    });
  }
  
  /**
   * Show an announcement in the center of the screen
   * @param {string} text - Text to display
   * @param {number} color - Background color (hex)
   */
  showAnnouncement(text, color = 0x333333) {
    // Remove existing announcement if any
    if (this.announcementText) {
      this.announcementText.destroy();
    }
    
    // Get screen center
    const centerX = this.scene.cameras.main.width / 2;
    const centerY = this.scene.cameras.main.height / 2;
    
    // Create announcement text
    this.announcementText = this.scene.add.text(centerX, centerY, text, {
      fontSize: '32px',
      fontStyle: 'bold',
      fill: '#ffffff',
      backgroundColor: this.hexToString(color) + 'cc',
      padding: { x: 20, y: 10 },
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0);
    
    // Add to container
    this.announcementContainer.add(this.announcementText);
    
    // Add scale animation
    this.scene.tweens.add({
      targets: this.announcementText,
      scale: { from: 0.5, to: 1 },
      duration: 500,
      ease: 'Back.Out'
    });
    
    // Fade out after a few seconds
    this.scene.tweens.add({
      targets: this.announcementText,
      alpha: 0,
      delay: 3000,
      duration: 1000,
      onComplete: () => {
        if (this.announcementText) {
          this.announcementText.destroy();
          this.announcementText = null;
        }
      }
    });
  }
  
  /**
   * Show a warning at the top of the screen
   * @param {string} text - Warning text
   * @param {number} color - Background color (hex)
   */
  showWarning(text, color = 0xff0000) {
    // Remove existing warning if any
    if (this.warningText) {
      this.warningText.destroy();
    }
    
    // Get screen center
    const centerX = this.scene.cameras.main.width / 2;
    
    // Create warning text
    this.warningText = this.scene.add.text(centerX, 50, text, {
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#ffffff',
      backgroundColor: this.hexToString(color) + 'cc',
      padding: { x: 16, y: 8 },
      align: 'center'
    }).setOrigin(0.5, 0).setScrollFactor(0);
    
    // Add to container
    this.warningContainer.add(this.warningText);
    
    // Add pulse animation
    this.scene.tweens.add({
      targets: this.warningText,
      scale: { from: 1, to: 1.05 },
      duration: 300,
      yoyo: true,
      repeat: 5
    });
    
    // Auto-remove after 5 seconds if not floor collapse warning
    if (!text.includes('FLOOR COLLAPSING')) {
      this.scene.time.delayedCall(5000, () => {
        if (this.warningText) {
          this.warningText.destroy();
          this.warningText = null;
        }
      });
    }
  }
  
  /**
   * Show a temporary notification
   * @param {string} message - Notification message
   */
  showNotification(message) {
    // Add to queue
    this.notificationQueue.push(message);
    
    // Process queue if not already processing
    if (!this.notificationActive) {
      this.processNotificationQueue();
    }
  }
  
  /**
   * Process the notification queue
   */
  processNotificationQueue() {
    if (this.notificationQueue.length === 0) {
      this.notificationActive = false;
      return;
    }
    
    this.notificationActive = true;
    const message = this.notificationQueue.shift();
    
    // Get screen dimensions
    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;
    
    // Create notification
    const notification = this.scene.add.text(
      screenWidth - 20, 
      screenHeight - 100, 
      message, 
      {
        fontSize: '16px',
        fill: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 10, y: 5 },
        align: 'right'
      }
    ).setOrigin(1, 0).setScrollFactor(0).setAlpha(0);
    
    // Slide in animation
    this.scene.tweens.add({
      targets: notification,
      x: screenWidth - 20,
      alpha: 1,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        // Wait then fade out
        this.scene.time.delayedCall(2000, () => {
          this.scene.tweens.add({
            targets: notification,
            x: screenWidth + 50,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
              notification.destroy();
              // Process next notification
              this.processNotificationQueue();
            }
          });
        });
      }
    });
  }
  
  /**
   * Convert hex color to string format
   * @param {number} hex - Hex color
   * @returns {string} - String format (#RRGGBB)
   */
  hexToString(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  /**
   * Handle resize event
   * @param {number} width - New screen width
   * @param {number} height - New screen height
   */
  handleResize(width, height) {
    // Update UI positions based on new screen size
    if (this.announcementText) {
      this.announcementText.setPosition(width / 2, height / 2);
    }
    
    if (this.warningText) {
      this.warningText.setPosition(width / 2, 50);
    }
    
    // Reposition any active notifications
    this.notificationContainer.getAll().forEach(notification => {
      notification.setPosition(width - 20, notification.y);
    });
  }
}
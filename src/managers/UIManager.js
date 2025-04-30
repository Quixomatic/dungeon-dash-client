// src/managers/UIManager.js
import gameState from '../systems/GameState.js';

export class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.infoText = null;
    this.playerCountText = null;
    this.phaseText = null;
    this.announcementText = null;
  }
  
  initialize() {
    console.log("Initializing UIManager");
    
    // Create UI elements
    this.createUIElements();
  }
  
  createUIElements() {
    // Info text
    this.infoText = this.scene.add.text(20, 20, 'Use WASD or arrow keys to move', {
      fontSize: '18px',
      fill: '#ffffff'
    });
    
    // Player count text
    this.playerCountText = this.scene.add.text(20, 50, 'Players: 0', {
      fontSize: '18px',
      fill: '#ffffff'
    });
    
    // Phase text
    this.phaseText = this.scene.add.text(20, 80, 'Phase: LOBBY', {
      fontSize: '18px',
      fill: '#ffffff'
    });
    
    // Update player count
    this.updatePlayerCount();
  }
  
  updatePlayerCount() {
    const count = this.scene.playerManager.getPlayerCount();
    this.playerCountText.setText(`Players: ${count}`);
    
    // Update DOM element
    const playerCountElement = document.getElementById('player-count');
    if (playerCountElement) {
      playerCountElement.innerText = `Players: ${count}`;
    }
  }
  
  updatePhase(phase) {
    this.phaseText.setText(`Phase: ${phase.toUpperCase()}`);
  }
  
  showGlobalEventNotification(message) {
    // Create notification at the top of the screen
    const notification = this.scene.add.text(400, 100, message, {
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#ffff00',
      backgroundColor: '#333333',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setDepth(100);
    
    // Fade out after a few seconds
    this.scene.tweens.add({
      targets: notification,
      alpha: 0,
      duration: 2000,
      delay: 3000,
      onComplete: () => {
        notification.destroy();
      }
    });
  }
  
  showAnnouncement(text, color = 0xffff00) {
    // Remove existing announcement if any
    if (this.announcementText) {
      this.announcementText.destroy();
    }
    
    // Create announcement text
    this.announcementText = this.scene.add.text(400, 200, text, {
      fontSize: '32px',
      fontStyle: 'bold',
      fill: '#ffffff',
      backgroundColor: color,
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(100);
    
    // Add scale animation
    this.scene.tweens.add({
      targets: this.announcementText,
      scale: { from: 0.5, to: 1 },
      duration: 500,
      ease: 'Bounce.Out'
    });
  }

  handleResize(width, height) {
    // Update UI positions based on new screen size
    if (this.infoText) {
      this.infoText.setPosition(20, 20);
    }
    
    if (this.playerCountText) {
      this.playerCountText.setPosition(20, 50);
    }
    
    if (this.phaseText) {
      this.phaseText.setPosition(20, 80);
    }
    
    // Update any other UI elements...
  }
}
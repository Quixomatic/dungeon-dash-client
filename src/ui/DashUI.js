// src/ui/DashUI.js

/**
 * Creates a UI component for dash charges
 * @param {Phaser.Scene} scene - The scene to add UI to
 * @param {InputHandler} inputHandler - Reference to the input handler
 * @returns {Object} - DashUI object
 */
export function createDashUI(scene, inputHandler) {
  // Create container for dash UI
  const container = scene.add.container(20, 100);
  container.setScrollFactor(0); // Fixed to camera
  container.setDepth(100); // On top of most game elements
  
  // Background - make wider to fit two charges
  const background = scene.add.rectangle(0, 0, 130, 40, 0x000000, 0.5);
  background.setOrigin(0, 0);
  
  // Label
  const label = scene.add.text(10, 5, 'DASH', {
    fontSize: '14px',
    fill: '#ffffff'
  });
  
  // Charge indicators
  const chargeIndicators = [];
  
  // Create charge indicators
  const charge1 = scene.add.circle(70, 20, 12, 0x00ff00);
  const charge2 = scene.add.circle(100, 20, 12, 0x00ff00);
  chargeIndicators.push(charge1, charge2);
  
  // Add all elements to container
  container.add([background, label, charge1, charge2]);
  
  // Timer graphics for cooldown
  const timerGraphics = scene.add.graphics();
  timerGraphics.setScrollFactor(0);
  timerGraphics.setDepth(101);
  container.add(timerGraphics);
  
  return {
    container,
    chargeIndicators,
    timerGraphics,
    
    /**
     * Update the UI based on dash charges
     */
    update() {
      // Skip if no input handler
      if (!inputHandler || !inputHandler.dashCharges) return;
      
      // Clear timer graphics
      timerGraphics.clear();
      
      // Update each charge indicator
      inputHandler.dashCharges.forEach((charge, index) => {
        // Make sure we have enough indicators
        if (index >= chargeIndicators.length) {
          // Create new indicator if needed
          const newCharge = scene.add.circle(70 + index * 30, 20, 12, 0x00ff00);
          chargeIndicators.push(newCharge);
          container.add(newCharge);
        }
        
        // Update indicator state
        const indicator = chargeIndicators[index];
        
        if (charge.available) {
          // Available charge
          indicator.setFillStyle(0x00ff00); // Green
        } else {
          // Unavailable charge - show cooldown
          indicator.setFillStyle(0xff0000); // Red
          
          // Calculate cooldown progress (0-1)
          const now = Date.now();
          const endTime = charge.cooldownEndTime;
          const totalCooldown = inputHandler.dashCooldown * 1000;
          const elapsed = now - (endTime - totalCooldown);
          const progress = Math.min(1, Math.max(0, elapsed / totalCooldown));
          
          // Draw cooldown timer overlay
          if (progress < 1) {
            timerGraphics.fillStyle(0x00ff00, 0.5);
            timerGraphics.slice(
              indicator.x, 
              indicator.y, 
              indicator.radius, 
              Phaser.Math.DegToRad(270), 
              Phaser.Math.DegToRad(270 + 360 * progress), 
              true
            );
            timerGraphics.fillPath();
          }
        }
      });
    },
    
    /**
     * Play a flash animation when dash is used
     */
    flashCharge(index = 0) {
      if (index < chargeIndicators.length) {
        scene.tweens.add({
          targets: chargeIndicators[index],
          alpha: 0.2,
          duration: 100,
          yoyo: true
        });
      }
    },
    
    /**
     * Play a restoration animation when charge is ready
     */
    flashChargeReady(index = 0) {
      if (index < chargeIndicators.length) {
        scene.tweens.add({
          targets: chargeIndicators[index],
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 200,
          yoyo: true
        });
      }
    }
  };
}
// src/managers/ReconciliationManager.js

export class ReconciliationManager {
    constructor(scene) {
      this.scene = scene;
      this.playerManager = null;
      this.inputHandler = null;
      
      // Reconciliation settings - INCREASED THRESHOLD
      this.reconciliationThreshold = 12; // Increased from 5 to 20 pixels
      this.reconciliationCount = 0;
      this.debugEnabled = true;
    }
    
    /**
     * Set player manager reference
     * @param {PlayerManager} playerManager - Player manager instance
     */
    setPlayerManager(playerManager) {
      this.playerManager = playerManager;
    }
    
    /**
     * Set input handler reference
     * @param {InputHandler} inputHandler - Input handler instance
     */
    setInputHandler(inputHandler) {
      this.inputHandler = inputHandler;
    }
    
    /**
     * Reconcile local player position with server position
     * @param {Object} serverPosition - Authoritative position from server
     * @param {number} sequence - Input sequence number
     */
    reconcile(serverPosition, sequence) {
      if (!this.playerManager || !this.inputHandler) return;
      
      // Get current predicted position
      const clientPosition = this.playerManager.getPlayerPosition();
      
      // Calculate distance between client and server positions
      const dx = clientPosition.x - serverPosition.x;
      const dy = clientPosition.y - serverPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If difference is significant, reconcile
      if (distance > this.reconciliationThreshold) {
        this.reconciliationCount++;
        
        if (this.debugEnabled) {
          console.log(`Reconciliation needed: client=(${clientPosition.x.toFixed(2)}, ${clientPosition.y.toFixed(2)}), server=(${serverPosition.x.toFixed(2)}, ${serverPosition.y.toFixed(2)}), diff=${distance.toFixed(2)}`);
        }
        
        // Reapply pending inputs starting from server position
        this.inputHandler.reapplyPendingInputs(serverPosition);
      }
    }
    
    /**
     * Get number of reconciliations that have occurred
     * @returns {number} - Reconciliation count
     */
    getReconciliationCount() {
      return this.reconciliationCount;
    }
  }
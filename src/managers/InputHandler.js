// src/managers/InputHandler.js
import { setupPlayerControls } from '../utils/controls.js';

export class InputHandler {
  constructor(scene) {
    this.scene = scene;
    this.controls = null;
  }
  
  initialize() {
    console.log("Initializing InputHandler");
    
    // Set up player controls using the utility
    this.controls = setupPlayerControls(
      this.scene, 
      this.scene.playerManager.localPlayer, 
      this.onInputChange.bind(this)
    );
  }
  
  onInputChange(inputState) {
    // Send input to server via network handler
    this.scene.networkHandler.sendPlayerInput(inputState);
  }
  
  update(time, delta) {
    if (!this.controls || !this.controls.enabled) return false;
    
    // Use fixed time step for consistent movement
    const fixedDelta = this.scene.fixedTimeStep / 1000; // Convert to seconds
    const moveSpeed = this.controls.speed;
    
    // Update controls with current time
    return this.controls.update(time, moveSpeed * fixedDelta);
  }
}
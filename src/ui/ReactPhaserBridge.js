// src/ui/ReactPhaserBridge.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthContainer from '../components/AuthContainer';

export class ReactPhaserBridge {
  constructor() {
    this.reactRoot = null;
    this.reactContainer = null;
    this.callbacks = {};
  }

  initialize() {
    // Create container for React components if it doesn't exist
    if (!this.reactContainer) {
      this.reactContainer = document.createElement('div');
      this.reactContainer.id = 'react-ui-root';
      this.reactContainer.style.position = 'absolute';
      this.reactContainer.style.top = '0';
      this.reactContainer.style.left = '0';
      this.reactContainer.style.width = '100%';
      this.reactContainer.style.height = '100%';
      this.reactContainer.style.pointerEvents = 'none';
      this.reactContainer.style.zIndex = '1000';
      
      // Add to game container
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        gameContainer.appendChild(this.reactContainer);
      } else {
        document.body.appendChild(this.reactContainer);
      }

      // Create React root using the new API
      this.reactRoot = ReactDOM.createRoot(this.reactContainer);
    }
  }

  setCallbacks(callbacks) {
    this.callbacks = callbacks;
  }

  showAuthUI() {
    this.initialize();
    
    // Make container capture pointer events when auth UI is shown
    this.reactContainer.style.pointerEvents = 'auto';
    this.reactContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    
    // Render AuthContainer component using the new API
    this.reactRoot.render(
      <AuthContainer onAuthComplete={this.callbacks.onAuthComplete} />
    );
  }

  hideAuthUI() {
    if (this.reactContainer) {
      // Stop capturing pointer events
      this.reactContainer.style.pointerEvents = 'none';
      this.reactContainer.style.backgroundColor = 'transparent';
      
      // Unmount React component by rendering null
      this.reactRoot.render(null);
    }
  }

  destroy() {
    if (this.reactRoot) {
      // Use unmount instead of unmountComponentAtNode
      this.reactRoot.unmount();
      
      if (this.reactContainer && this.reactContainer.parentNode) {
        this.reactContainer.parentNode.removeChild(this.reactContainer);
      }
      
      this.reactContainer = null;
      this.reactRoot = null;
    }
  }
}
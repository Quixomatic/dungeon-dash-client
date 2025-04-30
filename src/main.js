// src/main.js
import Phaser from "phaser";
import { LobbyScene } from "./scenes/LobbyScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { ResultsScene } from "./scenes/ResultsScene.js";
import gameState from "./systems/GameState.js";
import networkManager from "./systems/NetworkManager.js";

// Initialize game state
gameState.init({
  gameConfig: {
    maxPlayers: 100,
    minPlayersToStart: 2,
    gameDuration: 10 * 60 * 1000, // 10 minutes
    debug: true // Enable debug logging
  },
  debug: true
});

// Initialize network manager with debug enabled
networkManager.init({
  debug: true
});

const config = {
  type: Phaser.AUTO,
  // Use window dimensions or fallback to defaults
  width: window.innerWidth || 800,
  height: window.innerHeight || 600,
  parent: "game-container",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    },
  },
  scene: [LobbyScene, GameScene, ResultsScene],
  // Add scale manager settings
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// Create game instance
window.game = new Phaser.Game(config);

// Update player count in UI
window.addEventListener('playerCountUpdate', (event) => {
  const playerCountElement = document.getElementById('player-count');
  if (playerCountElement) {
    playerCountElement.innerText = `Players: ${event.detail.count}`;
  }
});

// Make objects available for debugging in browser console
window.gameState = gameState;
window.networkManager = networkManager;

// Log when game is ready
window.addEventListener('load', () => {
  console.log('Dungeon Dash Royale started');
  console.log('Debug mode enabled - check console for logs');
});
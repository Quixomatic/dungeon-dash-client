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
    gameDuration: 10 * 60 * 1000 // 10 minutes
  }
});

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: "game-container",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [LobbyScene, GameScene, ResultsScene],
};

window.game = new Phaser.Game(config);

// Add an event listener to update player count in the UI
window.addEventListener('playerCountUpdate', (event) => {
  const playerCountElement = document.getElementById('player-count');
  if (playerCountElement) {
    playerCountElement.innerText = `Players: ${event.detail.count}`;
  }
});

// For debugging in browser console
window.gameState = gameState;
window.networkManager = networkManager;
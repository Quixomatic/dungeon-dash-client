// src/main.js
import Phaser from "phaser";
import { LobbyScene } from "./scenes/lobbyScene.js";
import { GameScene } from "./scenes/gameScene.js";

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
  scene: [LobbyScene, GameScene],
};

window.game = new Phaser.Game(config);

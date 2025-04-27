// src/scenes/ResultsScene.js
import Phaser from 'phaser';
import { createDebugHelper } from '../utils/debug.js';
import gameState from '../systems/GameState.js';
import networkManager from '../systems/NetworkManager.js';

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('ResultsScene');
    this.debug = null;
  }

  preload() {
    // No specific assets needed for this scene
  }

  create() {
    console.log("ResultsScene created");
    
    // Make sure we're in the correct phase
    gameState.setPhase('results');
    
    // Create background
    this.add.rectangle(400, 300, 800, 600, 0x222222);
    
    // Create debug helper
    this.debug = createDebugHelper(this, {
      sceneName: 'RESULTS SCENE',
      sceneLabelColor: '#ff00ff'
    });
    
    // Title
    this.add.text(400, 100, 'Game Results', {
      fontSize: '32px',
      fontStyle: 'bold',
      fill: '#ffffff'
    }).setOrigin(0.5);
    
    // Get game results
    const results = gameState.gameResults || { reason: 'unknown' };
    
    // Display winner info if available
    if (results.winner) {
      const isCurrentPlayer = results.winner.id === networkManager.getPlayerId();
      const winnerText = isCurrentPlayer ? 
        'You won the game!' : 
        `Winner: ${results.winner.name}`;
      
      this.add.text(400, 170, winnerText, {
        fontSize: '24px',
        fontStyle: 'bold',
        fill: '#ffff00'
      }).setOrigin(0.5);
    } else {
      // No winner (time ran out)
      this.add.text(400, 170, 'Time expired!', {
        fontSize: '24px',
        fontStyle: 'bold',
        fill: '#ffff00'
      }).setOrigin(0.5);
    }
    
    // Game stats
    const gameTime = gameState.getElapsedTime();
    const minutes = Math.floor(gameTime / 60000);
    const seconds = Math.floor((gameTime % 60000) / 1000);
    
    this.add.text(400, 220, `Game duration: ${minutes}m ${seconds}s`, {
      fontSize: '18px',
      fill: '#ffffff'
    }).setOrigin(0.5);
    
    this.add.text(400, 250, `Total players: ${gameState.getPlayerCount()}`, {
      fontSize: '18px',
      fill: '#ffffff'
    }).setOrigin(0.5);
    
    // Show leaderboard
    this.createLeaderboard();
    
    // Return to lobby button
    const returnButton = this.add.text(400, 500, 'Return to Lobby', {
      fontSize: '24px',
      backgroundColor: '#4a4',
      padding: { x: 20, y: 10 },
      fixedWidth: 250,
      align: 'center'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => returnButton.setBackgroundColor('#6c6'))
      .on('pointerout', () => returnButton.setBackgroundColor('#4a4'))
      .on('pointerdown', () => this.returnToLobby());
    
    // Update debug info periodically
    this.time.addEvent({
      delay: 1000,
      callback: this.updateDebugInfo,
      callbackScope: this,
      loop: true
    });
  }
  
  createLeaderboard() {
    // Create leaderboard container
    const leaderboardContainer = this.add.container(400, 350);
    
    // Header
    const header = this.add.text(0, -60, 'Leaderboard', {
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#ffffff'
    }).setOrigin(0.5, 0);
    leaderboardContainer.add(header);
    
    // Background
    const background = this.add.rectangle(0, 0, 300, 200, 0x333333, 0.7);
    leaderboardContainer.add(background);
    
    // Get sorted players
    const sortedPlayers = Array.from(gameState.getAllPlayers().entries())
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 5); // Top 5 players
    
    // Display players
    sortedPlayers.forEach((entry, index) => {
      const [id, player] = entry;
      const isCurrentPlayer = id === networkManager.getPlayerId();
      const yPos = -80 + (index + 1) * 30;
      
      // Rank
      const rankText = this.add.text(-120, yPos, `${index + 1}.`, {
        fontSize: '16px',
        fill: isCurrentPlayer ? '#ffff00' : '#ffffff'
      }).setOrigin(0, 0.5);
      
      // Name
      const nameText = this.add.text(-90, yPos, player.name, {
        fontSize: '16px',
        fill: isCurrentPlayer ? '#ffff00' : '#ffffff'
      }).setOrigin(0, 0.5);
      
      // Score
      const scoreText = this.add.text(120, yPos, `${player.score}`, {
        fontSize: '16px',
        fill: isCurrentPlayer ? '#ffff00' : '#ffffff'
      }).setOrigin(1, 0.5);
      
      leaderboardContainer.add([rankText, nameText, scoreText]);
    });
    
    // If no players
    if (sortedPlayers.length === 0) {
      const noPlayersText = this.add.text(0, 0, 'No player data available', {
        fontSize: '16px',
        fill: '#aaaaaa'
      }).setOrigin(0.5);
      
      leaderboardContainer.add(noPlayersText);
    }
  }
  
  updateDebugInfo() {
    this.debug.displayObject({
      'Phase': gameState.getPhase(),
      'Players': gameState.getPlayerCount(),
      'Game Duration': Math.floor(gameState.getElapsedTime() / 1000) + 's',
      'Connected': networkManager.isConnected() ? 'Yes' : 'No'
    });
  }
  
  returnToLobby() {
    // Reset game state
    gameState.reset();
    
    // Start lobby scene
    this.scene.start('LobbyScene');
  }
}
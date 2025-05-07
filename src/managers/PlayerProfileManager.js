// src/managers/PlayerProfileManager.js
import gameState from "../systems/GameState.js";
import networkManager from "../systems/NetworkManager.js";

/**
 * Manages player profile data and persistence
 */
export class PlayerProfileManager {
  constructor() {
    this.currentProfile = null;
    this.isGuest = true;
    this.profileListeners = [];
    
    // Initialize by checking current auth state
    this.checkAuthState();
    
    // Listen for auth changes
    window.addEventListener('authStatusChanged', this.handleAuthChange.bind(this));
  }
  
  /**
   * Check current authentication state
   */
  checkAuthState() {
    const isAuthenticated = networkManager.isUserAuthenticated();
    
    if (isAuthenticated) {
      const userData = networkManager.getUserData();
      this.setAuthenticatedProfile(userData);
    } else {
      this.setGuestProfile();
    }
  }
  
  /**
   * Handle authentication state changes
   * @param {Event} event - Auth change event
   */
  handleAuthChange(event) {
    if (event.detail && event.detail.isAuthenticated) {
      this.setAuthenticatedProfile(event.detail.user);
    } else {
      this.setGuestProfile();
    }
  }
  
  /**
   * Set authenticated user profile
   * @param {Object} userData - User data from authentication
   */
  setAuthenticatedProfile(userData) {
    this.isGuest = false;
    this.currentProfile = {
      id: userData.id,
      username: userData.username,
      displayName: userData.displayName || userData.username,
      email: userData.email,
      authenticated: true,
      
      // Default stats that will be updated from server
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        killCount: 0,
        deathCount: 0,
        highScore: 0,
        playTime: 0
      }
    };
    
    // Notify listeners
    this.notifyProfileListeners();
    
    // Fetch profile data if connected
    this.fetchProfileData();
  }
  
  /**
   * Set guest profile
   */
  setGuestProfile() {
    this.isGuest = true;
    this.currentProfile = {
      id: null,
      username: `Guest_${Math.floor(Math.random() * 10000)}`,
      displayName: `Guest_${Math.floor(Math.random() * 10000)}`,
      authenticated: false,
      
      // Default stats for guests (not persisted)
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        killCount: 0,
        deathCount: 0,
        highScore: 0,
        playTime: 0
      }
    };
    
    // Notify listeners
    this.notifyProfileListeners();
  }
  
  /**
   * Fetch profile data from server
   */
  async fetchProfileData() {
    if (this.isGuest) return;
    
    try {
      // In a real implementation, we would fetch this from an API endpoint
      // For now, just simulate successful fetching
      console.log("Fetching profile data from server...");
      
      // Update with mock data for now
      this.currentProfile.stats = {
        gamesPlayed: 24,
        gamesWon: 5,
        killCount: 78,
        deathCount: 19,
        highScore: 1240,
        playTime: 18600 // in seconds
      };
      
      // Notify listeners of updated profile
      this.notifyProfileListeners();
    } catch (error) {
      console.error("Error fetching profile data:", error);
    }
  }
  
  /**
   * Update profile stats after a game
   * @param {Object} gameStats - Stats from the game session
   */
  updateProfileStats(gameStats) {
    if (!this.currentProfile) return;
    
    // Update local stats
    const stats = this.currentProfile.stats;
    
    stats.gamesPlayed++;
    if (gameStats.won) stats.gamesWon++;
    if (gameStats.kills) stats.killCount += gameStats.kills;
    if (gameStats.deaths) stats.deathCount += gameStats.deaths;
    if (gameStats.score) stats.highScore = Math.max(stats.highScore, gameStats.score);
    if (gameStats.playTime) stats.playTime += gameStats.playTime;
    
    // Notify listeners
    this.notifyProfileListeners();
    
    // If authenticated, send to server
    if (!this.isGuest) {
      this.saveProfileStats();
    }
  }
  
  /**
   * Save profile stats to server
   */
  async saveProfileStats() {
    if (this.isGuest || !this.currentProfile) return;
    
    try {
      // In a real implementation, we would send this to an API endpoint
      console.log("Saving profile stats to server...");
      // The actual saving happens in NormalGameRoom.onLeave
    } catch (error) {
      console.error("Error saving profile stats:", error);
    }
  }
  
  /**
   * Get current profile
   * @returns {Object|null} - Current profile or null
   */
  getProfile() {
    return this.currentProfile;
  }
  
  /**
   * Check if current user is a guest
   * @returns {boolean} - True if guest
   */
  isGuestUser() {
    return this.isGuest;
  }
  
  /**
   * Add a profile change listener
   * @param {Function} listener - Callback function
   */
  addProfileListener(listener) {
    if (typeof listener === 'function') {
      this.profileListeners.push(listener);
    }
  }
  
  /**
   * Remove a profile change listener
   * @param {Function} listener - Callback function to remove
   */
  removeProfileListener(listener) {
    this.profileListeners = this.profileListeners.filter(l => l !== listener);
  }
  
  /**
   * Notify all profile listeners
   */
  notifyProfileListeners() {
    this.profileListeners.forEach(listener => {
      try {
        listener(this.currentProfile);
      } catch (error) {
        console.error("Error in profile listener:", error);
      }
    });
  }
}
// src/dungeonRenderer/utils/PerformanceMonitor.js

/**
 * PerformanceMonitor - Tracks and reports renderer performance metrics
 * Monitors FPS, render times, and memory usage for debugging
 */
export class PerformanceMonitor {
    constructor() {
      this.stats = {
        fps: 0,
        frameTime: 0,
        averageFrameTime: 0,
        measuredTimes: {},
        objectCounts: {
          sprites: 0,
          textures: 0,
          structures: 0
        },
        memory: null
      };
      
      this.measures = new Map();
      this.fpsHistory = [];
      this.frameTimeHistory = [];
      this.trackFPS = true;
      this.trackMemory = false;
      this.updateFrequency = 1000; // ms between stats updates
      this.lastUpdateTime = 0;
      this.historySize = 60; // Keep 60 samples (1 second at 60 FPS)
      this.debug = false;
      this.isInitialized = false;
    }
    
    /**
     * Initialize the performance monitor
     * @param {Object} options - Configuration options
     * @returns {PerformanceMonitor} - This instance for chaining
     */
    init(options = {}) {
      this.trackFPS = options.trackFPS !== false;
      this.trackMemory = options.trackMemory === true;
      this.updateFrequency = options.updateFrequency || 1000;
      this.historySize = options.historySize || 60;
      this.debug = options.debug || false;
      
      // Clear any existing data
      this.fpsHistory = [];
      this.frameTimeHistory = [];
      this.measures.clear();
      
      // Reset stats
      this.resetStats();
      
      this.isInitialized = true;
      return this;
    }
    
    /**
     * Reset all statistics
     */
    resetStats() {
      this.stats = {
        fps: 0,
        frameTime: 0,
        averageFrameTime: 0,
        measuredTimes: {},
        objectCounts: {
          sprites: 0,
          textures: 0,
          structures: 0
        },
        memory: null
      };
      
      this.fpsHistory = [];
      this.frameTimeHistory = [];
      this.measures.clear();
      this.lastUpdateTime = 0;
    }
    
    /**
     * Update the performance monitor
     * @param {number} time - Current time
     * @param {number} delta - Time since last frame in ms
     */
    update(time, delta) {
      if (!this.isInitialized) return;
      
      // Track frame time
      this.frameTimeHistory.push(delta);
      if (this.frameTimeHistory.length > this.historySize) {
        this.frameTimeHistory.shift();
      }
      
      // Calculate current FPS
      const currentFps = delta > 0 ? 1000 / delta : 0;
      this.fpsHistory.push(currentFps);
      if (this.fpsHistory.length > this.historySize) {
        this.fpsHistory.shift();
      }
      
      // Update statistics periodically
      if (time - this.lastUpdateTime >= this.updateFrequency) {
        this.updateStats();
        this.lastUpdateTime = time;
      }
    }
    
    /**
     * Start measuring a specific operation
     * @param {string} name - Name of the operation
     */
    startMeasure(name) {
      if (!this.isInitialized) return;
      
      this.measures.set(name, {
        startTime: performance.now(),
        endTime: null,
        duration: 0
      });
    }
    
    /**
     * End measuring a specific operation
     * @param {string} name - Name of the operation
     * @returns {number} - Duration in milliseconds or -1 if not found
     */
    endMeasure(name) {
      if (!this.isInitialized) return -1;
      
      // Get the measure
      const measure = this.measures.get(name);
      if (!measure || measure.startTime === null) return -1;
      
      // Set end time and calculate duration
      measure.endTime = performance.now();
      measure.duration = measure.endTime - measure.startTime;
      
      // Update stats for this measure
      if (!this.stats.measuredTimes[name]) {
        this.stats.measuredTimes[name] = {
          last: measure.duration,
          min: measure.duration,
          max: measure.duration,
          avg: measure.duration,
          samples: 1
        };
      } else {
        const stats = this.stats.measuredTimes[name];
        stats.last = measure.duration;
        stats.min = Math.min(stats.min, measure.duration);
        stats.max = Math.max(stats.max, measure.duration);
        stats.avg = ((stats.avg * stats.samples) + measure.duration) / (stats.samples + 1);
        stats.samples++;
      }
      
      if (this.debug && name === 'visibilityUpdate') {
        console.log(`${name} took ${measure.duration.toFixed(2)}ms`);
      }
      
      return measure.duration;
    }
    
    /**
     * Update performance statistics
     */
    updateStats() {
      // Calculate average FPS
      const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
      this.stats.fps = this.fpsHistory.length > 0 ? sum / this.fpsHistory.length : 0;
      
      // Calculate average frame time
      const frameTimeSum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
      this.stats.averageFrameTime = this.frameTimeHistory.length > 0 ? 
        frameTimeSum / this.frameTimeHistory.length : 0;
      
      // Set current frame time
      this.stats.frameTime = this.frameTimeHistory.length > 0 ? 
        this.frameTimeHistory[this.frameTimeHistory.length - 1] : 0;
      
      // Gather memory stats if available and enabled
      if (this.trackMemory && window.performance && window.performance.memory) {
        this.stats.memory = {
          totalJSHeapSize: window.performance.memory.totalJSHeapSize,
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
        };
      }
      
      // Log debug info if enabled
      if (this.debug) {
        const memory = this.stats.memory ? 
          `Mem: ${Math.round(this.stats.memory.usedJSHeapSize / 1024 / 1024)}MB` : 
          'Memory stats not available';
        
        console.log(
          `Performance: FPS=${this.stats.fps.toFixed(1)}, ` +
          `Frame time=${this.stats.averageFrameTime.toFixed(2)}ms, ${memory}`
        );
      }
    }
    
    /**
     * Set the object counts
     * @param {Object} counts - Object with sprite, texture, and structure counts
     */
    setObjectCounts(counts) {
      if (!this.isInitialized) return;
      
      if (counts.sprites !== undefined) {
        this.stats.objectCounts.sprites = counts.sprites;
      }
      
      if (counts.textures !== undefined) {
        this.stats.objectCounts.textures = counts.textures;
      }
      
      if (counts.structures !== undefined) {
        this.stats.objectCounts.structures = counts.structures;
      }
    }
    
    /**
     * Get performance statistics
     * @returns {Object} - Performance statistics
     */
    getStats() {
      return { ...this.stats };
    }
    
    /**
     * Get timing statistics for a specific operation
     * @param {string} name - Name of the operation
     * @returns {Object|null} - Timing statistics or null if not found
     */
    getMeasureStats(name) {
      return this.stats.measuredTimes[name] || null;
    }
    
    /**
     * Destroy the performance monitor and clean up resources
     */
    destroy() {
      this.resetStats();
      this.isInitialized = false;
    }
  }
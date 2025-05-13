// src/dungeonRenderer/utils/VisibilityCulling.js - IMPROVED VERSION
/**
 * VisibilityCulling - Handles efficient visibility culling for dungeon rendering
 * Determines which elements need to be rendered based on camera position
 */
export class VisibilityCulling {
  constructor() {
    this.lastCameraPosition = { x: 0, y: 0 };
    this.cameraUpdateThreshold = { x: 0, y: 0 };
    this.debug = false;
  }

  /**
   * Initialize the culling system
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.debug = options.debug || false;
    return this;
  }

  /**
   * Check if visibility should be updated based on camera movement
   * @param {Phaser.Cameras.Scene2D.Camera} camera - The camera to check
   * @param {Object} lastPosition - The last camera position that triggered an update
   * @returns {boolean} - True if visibility should be updated
   */
  shouldUpdateVisibility(camera, lastPosition) {
    // Skip if camera hasn't moved
    if (
      camera.scrollX === lastPosition.x &&
      camera.scrollY === lastPosition.y
    ) {
      return false;
    }

    // Calculate how far the camera has moved since last update
    const deltaX = Math.abs(camera.scrollX - lastPosition.x);
    const deltaY = Math.abs(camera.scrollY - lastPosition.y);

    // IMPROVED: Use smaller threshold for more frequent updates
    // Changed from 1/16th to 1/32nd of the camera dimensions
    const thresholdX = camera.width / 32;
    const thresholdY = camera.height / 32;

    // Also update if total movement exceeds a certain pixel threshold
    // This helps with rapid movement scenarios
    const absoluteThreshold = 64; // pixels

    // Update if camera moved more than threshold in either direction
    // or if total movement exceeds absolute threshold
    const shouldUpdate =
      deltaX > thresholdX ||
      deltaY > thresholdY ||
      deltaX + deltaY > absoluteThreshold;

    // Store the thresholds for debugging
    this.cameraUpdateThreshold = { x: thresholdX, y: thresholdY };

    if (this.debug && shouldUpdate) {
      console.log(
        `Camera moved: ${Math.round(deltaX)}px, ${Math.round(
          deltaY
        )}px, updating visibility`
      );
    }

    return shouldUpdate;
  }

  /**
   * Check if a structure is visible in the camera view
   * @param {Object} structureBounds - Structure bounds in tiles
   * @param {Object} cameraBounds - Camera bounds in pixels
   * @param {number} tileSize - Size of tiles in pixels
   * @returns {boolean} - True if structure is visible
   */
  isStructureVisible(structureBounds, cameraBounds, tileSize) {
    // Convert structure bounds to pixels
    const pixelBounds = {
      left: structureBounds.x * tileSize,
      right: (structureBounds.x + structureBounds.width) * tileSize,
      top: structureBounds.y * tileSize,
      bottom: (structureBounds.y + structureBounds.height) * tileSize,
    };

    // IMPROVED: Add larger buffer to cameraBounds
    const bufferedCameraBounds = {
      left: cameraBounds.left - tileSize * 10, // Increased from 5 to 10
      right: cameraBounds.right + tileSize * 10, // Increased from 5 to 10
      top: cameraBounds.top - tileSize * 10, // Increased from 5 to 10
      bottom: cameraBounds.bottom + tileSize * 10, // Increased from 5 to 10
    };

    // Check if the structure intersects with the buffered camera view
    const isVisible = !(
      pixelBounds.right < bufferedCameraBounds.left ||
      pixelBounds.left > bufferedCameraBounds.right ||
      pixelBounds.bottom < bufferedCameraBounds.top ||
      pixelBounds.top > bufferedCameraBounds.bottom
    );

    return isVisible;
  }

  /**
   * Get the bounds of visible tiles with a buffer
   * @param {Phaser.Cameras.Scene2D.Camera} camera - The camera to check
   * @param {number} tileSize - Size of tiles in pixels
   * @param {number} buffer - Buffer size in tiles
   * @returns {Object} - Bounds of visible tiles
   */
  getVisibleTileBounds(camera, tileSize, buffer = 4) {
    // IMPROVED: Increase buffer from 2 to 4 tiles
    // Convert camera bounds to tile coordinates
    const visibleBounds = {
      left: Math.floor(camera.scrollX / tileSize) - buffer,
      right: Math.ceil((camera.scrollX + camera.width) / tileSize) + buffer,
      top: Math.floor(camera.scrollY / tileSize) - buffer,
      bottom: Math.ceil((camera.scrollY + camera.height) / tileSize) + buffer,
    };

    // Ensure bounds are not negative
    visibleBounds.left = Math.max(0, visibleBounds.left);
    visibleBounds.top = Math.max(0, visibleBounds.top);

    return visibleBounds;
  }

  /**
   * Check if a tile position is visible
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {Object} visibleBounds - Bounds of visible tiles
   * @returns {boolean} - True if tile is visible
   */
  isTileVisible(tileX, tileY, visibleBounds) {
    return (
      tileX >= visibleBounds.left &&
      tileX <= visibleBounds.right &&
      tileY >= visibleBounds.top &&
      tileY <= visibleBounds.bottom
    );
  }

  /**
   * Get debug information for visibility culling
   * @returns {Object} - Debug info
   */
  getDebugInfo() {
    return {
      lastCameraPosition: this.lastCameraPosition,
      cameraUpdateThreshold: this.cameraUpdateThreshold,
    };
  }
}

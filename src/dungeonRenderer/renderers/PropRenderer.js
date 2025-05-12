// src/dungeonRenderer/renderers/PropRenderer.js
/**
 * PropRenderer - Handles rendering of props (torches, chests, etc.)
 * Creates individual interactive sprite objects for props
 */
export class PropRenderer {
  constructor(scene, textureCache) {
    this.scene = scene;
    this.textureCache = textureCache;
    this.group = scene.add.group();
    this.props = new Map(); // Map of prop ID to sprite
    this.visibleProps = new Set(); // Set of visible prop IDs
    this.tileSize = 64;
    this.debug = false;

    // Prop definitions - maps prop values to visual representation
    this.propDefinitions = {
      3: { type: "chest", color: 0xaa8800, interactive: true },
      12: { type: "torch", color: 0xff9900, light: true },
      21: { type: "ladder", color: 0xdddddd, interactive: true },
      // Add more as needed
    };

    // Object pool for prop reuse
    this.propPool = {
      torch: [],
      chest: [],
      ladder: [],
      generic: [],
    };
  }

  /**
   * Initialize the renderer
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    this.tileSize = options.tileSize || 64;
    this.debug = options.debug || false;
    this.group.setDepth(20);
    return this;
  }

  /**
   * Render props within a specific structure's bounds
   * @param {Object} mapData - Map data from server
   * @param {Object} structureData - Structure data containing bounds
   * @param {number} tileSize - Size of tiles in pixels
   */
  renderPropsInStructure(mapData, structureData, tileSize) {
    if (!mapData || !mapData.layers || !mapData.layers.props) return;

    this.tileSize = tileSize || this.tileSize;
    const bounds = structureData.bounds;

    // Process all tiles within the structure bounds
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        // Check if there's a prop at this position
        if (
          y >= 0 &&
          y < mapData.layers.props.length &&
          x >= 0 &&
          mapData.layers.props[y] &&
          mapData.layers.props[y][x] > 0
        ) {
          // Create prop if it doesn't exist
          const propId = `prop_${x}_${y}`;
          if (!this.props.has(propId)) {
            this.createProp(x, y, mapData.layers.props[y][x]);
          }
        }
      }
    }
  }

  /**
   * Create a prop at the specified position
   * @param {number} x - Tile x position
   * @param {number} y - Tile y position
   * @param {number} propValue - Prop value from the map data
   */
  createProp(x, y, propValue) {
    // Skip empty props
    if (propValue === 0) return;

    // Generate unique ID for this prop
    const propId = `prop_${x}_${y}`;

    // Return if prop already exists
    if (this.props.has(propId)) return;

    // Get prop definition or use default
    const propDef = this.propDefinitions[propValue] || {
      type: "generic",
      color: 0xffffff,
    };

    // World position in pixels
    const worldX = x * this.tileSize + this.tileSize / 2;
    const worldY = y * this.tileSize + this.tileSize / 2;

    // Create the prop
    let prop = this.createPropObject(worldX, worldY, propDef, propValue);
    prop.propId = propId;
    prop.propType = propDef.type;
    prop.propValue = propValue;
    prop.tileX = x;
    prop.tileY = y;

    // Store the prop
    this.props.set(propId, prop);

    // Add to group
    this.group.add(prop);

    // Initially visible
    prop.setVisible(true);

    if (this.debug) {
      console.log(`Created prop ${propDef.type} at (${x},${y})`);
    }

    return prop;
  }

  /**
   * Create a prop object based on its definition
   * @param {number} x - World x position
   * @param {number} y - World y position
   * @param {Object} propDef - Prop definition
   * @param {number} propValue - Original prop value
   * @returns {Object} - Created prop object
   */
  createPropObject(x, y, propDef, propValue) {
    // Try to reuse from pool
    const pool = this.propPool[propDef.type] || this.propPool.generic;
    let prop = null;

    if (pool.length > 0) {
      // Reuse prop from pool
      prop = pool.pop();
      prop.setPosition(x, y);
      prop.setVisible(true);

      // If prop has a light effect, reactivate it
      if (prop.light) {
        prop.light.setPosition(x, y);
        prop.light.setVisible(true);
      }

      return prop;
    }

    // Create new prop based on type
    switch (propDef.type) {
      case "torch":
        // Check if we have a torch texture
        if (this.scene.textures.exists("torch")) {
          prop = this.scene.add.image(x, y, "torch");
          prop.setDisplaySize(this.tileSize * 0.8, this.tileSize * 0.8);
        } else {
          // Fallback to circle
          prop = this.scene.add.circle(x, y, this.tileSize / 4, propDef.color);
        }

        // Add light effect if enabled
        if (propDef.light) {
          const light = this.scene.add.circle(
            x,
            y,
            this.tileSize * 2,
            propDef.color,
            0.2
          );
          light.setDepth(15); // Between floor and props

          // Animate light
          this.scene.tweens.add({
            targets: light,
            alpha: 0.1,
            radius: this.tileSize * 2.5,
            duration: 1000,
            yoyo: true,
            repeat: -1,
          });

          prop.light = light;
        }
        break;

      case "chest":
        // Check if we have a chest texture
        if (this.scene.textures.exists("chest")) {
          prop = this.scene.add.image(x, y, "chest");
          prop.setDisplaySize(this.tileSize * 0.7, this.tileSize * 0.5);
        } else {
          // Fallback to rectangle
          prop = this.scene.add.rectangle(
            x,
            y,
            this.tileSize * 0.7,
            this.tileSize * 0.5,
            propDef.color
          );
        }

        // Make interactive if needed
        if (propDef.interactive) {
          prop.setInteractive();
        }
        break;

      case "ladder":
        // Check if we have a ladder texture
        if (this.scene.textures.exists("ladder")) {
          prop = this.scene.add.image(x, y, "ladder");
          prop.setDisplaySize(this.tileSize * 0.8, this.tileSize * 0.8);
        } else {
          // Fallback to shape
          const graphics = this.scene.add.graphics();
          graphics.fillStyle(propDef.color, 1);
          graphics.fillRect(
            -this.tileSize / 4,
            -this.tileSize / 3,
            this.tileSize / 2,
            this.tileSize / 1.5
          );

          // Draw rungs
          graphics.fillStyle(0x000000, 1);
          const rungs = 3;
          const rungHeight = this.tileSize / 1.5 / (rungs + 1);
          for (let i = 1; i <= rungs; i++) {
            graphics.fillRect(
              -this.tileSize / 4,
              -this.tileSize / 3 + rungHeight * i - 2,
              this.tileSize / 2,
              4
            );
          }

          // Create texture
          const key = `ladder_${propValue}`;
          if (!this.scene.textures.exists(key)) {
            graphics.generateTexture(key, this.tileSize, this.tileSize);
            graphics.destroy();
          }

          prop = this.scene.add.image(x, y, key);
        }

        // Make interactive if needed
        if (propDef.interactive) {
          prop.setInteractive();
        }
        break;

      default:
        // Generic prop as a square
        prop = this.scene.add.rectangle(
          x,
          y,
          this.tileSize * 0.5,
          this.tileSize * 0.5,
          propDef.color
        );
    }

    return prop;
  }

  /**
   * Update visibility of props based on camera bounds
   * @param {Object} cameraBounds - Camera bounds in pixels
   */
  updateVisibility(cameraBounds) {
    // Clear visible props set
    this.visibleProps.clear();

    // Check each prop
    this.props.forEach((prop, id) => {
      // Check if prop is in view
      const isVisible = !(
        prop.x + prop.width / 2 < cameraBounds.left ||
        prop.x - prop.width / 2 > cameraBounds.right ||
        prop.y + prop.height / 2 < cameraBounds.top ||
        prop.y - prop.height / 2 > cameraBounds.bottom
      );

      // Update visibility
      prop.setVisible(isVisible);

      // If prop has a light effect, update that too
      if (prop.light) {
        prop.light.setVisible(isVisible);
      }

      // Track visible props
      if (isVisible) {
        this.visibleProps.add(id);
      }
    });

    if (this.debug) {
      console.log(
        `Visible props: ${this.visibleProps.size}/${this.props.size}`
      );
    }
  }

  /**
   * Get the count of visible props
   * @returns {number} - Number of visible props
   */
  getVisibleCount() {
    return this.visibleProps.size;
  }

  /**
   * Recycle a prop into the object pool
   * @param {string} propId - Prop ID
   */
  recycleProp(propId) {
    const prop = this.props.get(propId);
    if (!prop) return;

    // Hide the prop
    prop.setVisible(false);

    // Hide light if present
    if (prop.light) {
      prop.light.setVisible(false);
    }

    // Add to appropriate pool
    const pool = this.propPool[prop.propType] || this.propPool.generic;
    pool.push(prop);

    // Remove from tracked props
    this.props.delete(propId);
    this.visibleProps.delete(propId);
  }

  /**
   * Clear all props
   */
  clear() {
    // Destroy all props
    this.props.forEach((prop) => {
      // Destroy light if present
      if (prop.light) {
        prop.light.destroy();
      }

      // Destroy the prop
      prop.destroy();
    });

    // Clear the collections
    this.props.clear();
    this.visibleProps.clear();

    // Clear object pools
    Object.values(this.propPool).forEach((pool) => {
      pool.forEach((prop) => {
        if (prop.light) prop.light.destroy();
        prop.destroy();
      });
      pool.length = 0;
    });

    // Clear the group
    this.group.clear(true, true);
  }

  /**
   * Destroy the renderer and clean up resources
   */
  destroy() {
    this.clear();

    if (this.group) {
      this.group.destroy(true);
      this.group = null;
    }
  }
}

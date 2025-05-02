// src/data/DungeonTemplates.js

/**
 * Room template handling for client-side dungeon rendering
 */

/**
 * Tile types for rendering
 */
export const TILE_TYPES = {
  WALL: 'W',
  FLOOR: '.',
  DOOR: 'D',
  SPAWN: 'S',
  CHEST: 'C',
  TORCH: 'T'
};

/**
 * Template cache for network efficiency
 */
const templateCache = new Map();

/**
 * Register a template in the cache
 * @param {string} id - Template ID
 * @param {Object} template - Template data
 */
export function registerTemplate(id, template) {
  templateCache.set(id, template);
}

/**
 * Register multiple templates at once
 * @param {Object} templates - Object with template ID keys and data values
 */
export function registerTemplates(templates) {
  Object.entries(templates).forEach(([id, template]) => {
    registerTemplate(id, template);
  });
}

/**
 * Get a template by ID, falling back to defaults if not found
 * @param {string} id - Template ID
 * @returns {Object|null} - Template data
 */
export function getTemplateById(id) {
  if (templateCache.has(id)) {
    return templateCache.get(id);
  }
  
  return null;
}

/**
 * Clear the template cache
 */
export function clearTemplateCache() {
  templateCache.clear();
}

/**
 * Get color for a tile type based on room type
 * @param {string} tileChar - Tile character from layout
 * @param {string} roomType - Room type (small, medium, large, spawn)
 * @returns {number} - Phaser color value
 */
export function getTileColor(tileChar, roomType = 'small') {
  // Base colors for tiles
  const baseColors = {
    [TILE_TYPES.WALL]: 0x666666,    // Gray walls
    [TILE_TYPES.FLOOR]: 0x333333,   // Dark floor
    [TILE_TYPES.DOOR]: 0x8888aa,    // Blue-gray door
    [TILE_TYPES.TORCH]: 0xffaa00,   // Orange torch
    [TILE_TYPES.CHEST]: 0xffff00,   // Yellow chest
    [TILE_TYPES.SPAWN]: 0x8800ff    // Purple spawn point
  };
  
  // Color adjustments based on room type
  const colorModifiers = {
    'small': { saturation: 1.0, brightness: 1.0 },    // Normal
    'medium': { saturation: 1.1, brightness: 1.0 },   // Slightly more saturated
    'large': { saturation: 1.2, brightness: 1.1 },    // More saturated and brighter
    'spawn': { saturation: 1.0, brightness: 1.4 }     // Much brighter for spawn rooms
  };
  
  // Get base color
  const baseColor = baseColors[tileChar] || baseColors[TILE_TYPES.FLOOR];
  
  // Apply modifiers if room type has them
  const modifier = colorModifiers[roomType] || colorModifiers.small;
  
  // Apply color transformations
  return adjustColor(baseColor, modifier.saturation, modifier.brightness);
}

/**
 * Adjust color based on saturation and brightness
 * @param {number} color - Base color
 * @param {number} saturation - Saturation multiplier
 * @param {number} brightness - Brightness multiplier
 * @returns {number} - Adjusted color
 */
function adjustColor(color, saturation, brightness) {
  // Extract RGB components
  const r = ((color >> 16) & 0xff);
  const g = ((color >> 8) & 0xff);
  const b = (color & 0xff);
  
  // Convert to HSL
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Apply modifiers
  const newS = Math.min(1, s * saturation);
  const newL = Math.min(1, l * brightness);
  
  // Convert back to RGB
  const [newR, newG, newB] = hslToRgb(h, newS, newL);
  
  // Reconstruct color
  return (newR << 16) | (newG << 8) | newB;
}

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {Array} - [h, s, l] values
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    
    h /= 6;
  }
  
  return [h, s, l];
}

/**
 * Convert HSL to RGB
 * @param {number} h - Hue (0-1)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {Array} - [r, g, b] values (0-255)
 */
function hslToRgb(h, s, l) {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255)
  ];
}

/**
 * Generate a basic layout for a room without a template
 * @param {number} width - Room width
 * @param {number} height - Room height
 * @returns {Array} - Room layout
 */
export function generateBasicLayout(width, height) {
  const layout = [];
  
  for (let y = 0; y < height; y++) {
    let row = '';
    
    for (let x = 0; x < width; x++) {
      // Wall at the edges, floor in the middle
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row += 'W';
      } else {
        row += '.';
      }
    }
    
    layout.push(row);
  }
  
  return layout;
}
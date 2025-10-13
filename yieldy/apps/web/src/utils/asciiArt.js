/**
 * ASCII Art Library for Cultiv8
 * Terminal-inspired visual assets and utilities
 */

// ========================================
// PART A: CULTIV8 LOGO VARIANTS
// ========================================

export const CULTIV8_LOGO_LARGE = `
 ██████╗██╗   ██╗██╗  ████████╗██╗██╗   ██╗ █████╗ 
██╔════╝██║   ██║██║  ╚══██╔══╝██║██║   ██║██╔══██╗
██║     ██║   ██║██║     ██║   ██║██║   ██║╚█████╔╝
██║     ██║   ██║██║     ██║   ██║╚██╗ ██╔╝██╔══██╗
╚██████╗╚██████╔╝███████╗██║   ██║ ╚████╔╝ ╚█████╔╝
 ╚═════╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝  ╚═══╝   ╚════╝ 
`;

export const CULTIV8_LOGO_MEDIUM = `
 ██████╗██╗   ██╗██╗  ████████╗██╗██╗   ██╗ █████╗ 
██╔════╝██║   ██║██║  ╚══██╔══╝██║██║   ██║██╔══██╗
██║     ██║   ██║██║     ██║   ██║██║   ██║╚█████╔╝
╚██████╗╚██████╔╝███████╗██║   ██║ ╚████╔╝ ╚█████╔╝
 ╚═════╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝  ╚═══╝   ╚════╝ 
`;

export const CULTIV8_LOGO_SMALL = `
╔═╗╦ ╦╦  ╔╦╗╦╦  ╦╔═╗
║  ║ ║║   ║ ║╚╗╔╝║═║
╚═╝╚═╝╩═╝ ╩ ╩ ╚╝ ╚═╝
`;

export const CULTIV8_LOGO_TINY = 'CULTIV8';

// ========================================
// PART B: STATUS ICONS & SYMBOLS
// ========================================

export const STATUS_ICONS = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  loading: '⟳',
  active: '●',
  inactive: '○',
  pending: '◐',
  paused: '❚❚',
  play: '▶',
  stop: '■',
  refresh: '↻',
  upload: '↑',
  download: '↓',
  check: '✓',
  cross: '✗',
  plus: '+',
  minus: '-',
  multiply: '×',
  divide: '÷',
};

export const CONNECTION = {
  online: '[●LIVE]',
  offline: '[○OFFLINE]',
  connecting: '[◐CONNECTING]',
  error: '[✗ERROR]',
  syncing: '[↻SYNCING]',
};

export const RISK_LEVELS = {
  veryLow: '[●○○○○] VERY LOW',
  low: '[●●○○○] LOW',
  medium: '[●●●○○] MEDIUM',
  high: '[●●●●○] HIGH',
  veryHigh: '[●●●●●] CRITICAL',
};

export const TIER_BADGES = {
  community: '[USER]',
  pro: '[PRO]',
  institutional: '[INST]',
  enterprise: '[ENTERPRISE]',
};

// ========================================
// PART C: LOADING ANIMATIONS
// ========================================

export const SPINNERS = {
  braille: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  blocks: ['▖', '▘', '▝', '▗'],
  dots: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  line: ['|', '/', '─', '\\'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bar: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
  square: ['◰', '◳', '◲', '◱'],
  triangle: ['◢', '◣', '◤', '◥'],
};

export const PROGRESS_BLOCKS = {
  empty: '░',
  partial: '▒',
  filled: '▓',
  full: '█',
  quarter: '▓',
};

// ========================================
// PART D: BOX DRAWING CHARACTERS
// ========================================

export const BOX_CHARS = {
  // Single line
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  cross: '┼',
  teeUp: '┴',
  teeDown: '┬',
  teeLeft: '┤',
  teeRight: '├',
  
  // Double line
  doubleTopLeft: '╔',
  doubleTopRight: '╗',
  doubleBottomLeft: '╚',
  doubleBottomRight: '╝',
  doubleHorizontal: '═',
  doubleVertical: '║',
  doubleCross: '╬',
  
  // Heavy
  heavyHorizontal: '━',
  heavyVertical: '┃',
  heavyTopLeft: '┏',
  heavyTopRight: '┓',
  heavyBottomLeft: '┗',
  heavyBottomRight: '┛',
  
  // Rounded
  roundedTopLeft: '╭',
  roundedTopRight: '╮',
  roundedBottomLeft: '╰',
  roundedBottomRight: '╯',
};

/**
 * Create a box with specified dimensions and style
 * @param {number} width - Box width in characters
 * @param {number} height - Box height in lines
 * @param {string} style - 'single', 'double', 'heavy', or 'rounded'
 * @returns {string} ASCII box
 */
export function createBox(width, height, style = 'single') {
  const chars = {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    heavy: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  };

  const c = chars[style] || chars.single;
  
  const top = c.tl + c.h.repeat(width - 2) + c.tr;
  const middle = c.v + ' '.repeat(width - 2) + c.v;
  const bottom = c.bl + c.h.repeat(width - 2) + c.br;
  
  return [top, ...Array(Math.max(0, height - 2)).fill(middle), bottom].join('\n');
}

// ========================================
// PART E: BANNERS & DECORATIONS
// ========================================

export const BANNERS = {
  startup: (tvl = '0', apy = '0.00') => `
╔═══════════════════════════════════════════════════════════════╗
║ CULTIV8 AUTONOMOUS YIELD AGENT v1.0                           ║
║ STATUS: OPERATIONAL | TVL: $${tvl.padStart(10)} | APY: ${apy}%${' '.repeat(Math.max(0, 5 - apy.length))}          ║
╚═══════════════════════════════════════════════════════════════╝
  `,
  
  error: (message = 'SYSTEM ERROR') => `
┌───────────────────────────────────────────────────────────────┐
│ [✗] ${message.padEnd(59)}│
│ Please check logs or contact support                          │
└───────────────────────────────────────────────────────────────┘
  `,
  
  success: (message = 'OPERATION SUCCESSFUL') => `
┌───────────────────────────────────────────────────────────────┐
│ [✓] ${message.padEnd(59)}│
└───────────────────────────────────────────────────────────────┘
  `,
  
  warning: (message = 'WARNING') => `
┌───────────────────────────────────────────────────────────────┐
│ [⚠] ${message.padEnd(59)}│
└───────────────────────────────────────────────────────────────┘
  `,
};

export const DIVIDERS = {
  single: '─'.repeat(60),
  double: '═'.repeat(60),
  heavy: '━'.repeat(60),
  dashed: '┄'.repeat(60),
  dotted: '┈'.repeat(60),
  withLabel: (label) => {
    const totalLen = 60;
    const labelLen = label.length + 4; // Add spaces around
    const sideLen = Math.floor((totalLen - labelLen) / 2);
    return '─'.repeat(sideLen) + `  ${label}  ` + '─'.repeat(totalLen - sideLen - labelLen);
  },
};

export const HEADERS = {
  section: (title) => `
╔═══════════════════════════════════════════════════════════════╗
║ ${title.toUpperCase().padEnd(61)}║
╚═══════════════════════════════════════════════════════════════╝
  `,
  
  subsection: (title) => `
┌───────────────────────────────────────────────────────────────┐
│ ${title.toUpperCase().padEnd(61)}│
└───────────────────────────────────────────────────────────────┘
  `,
};

// ========================================
// PART F: UTILITY FUNCTIONS
// ========================================

/**
 * Center text within a given width
 */
export function centerText(text, width) {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text + ' '.repeat(width - padding - text.length);
}

/**
 * Create a progress/loading bar
 */
export function createLoadingBar(progress, width = 20) {
  const percent = Math.min(100, Math.max(0, progress));
  const filled = Math.floor((percent / 100) * width);
  const empty = width - filled;
  return `[${PROGRESS_BLOCKS.full.repeat(filled)}${PROGRESS_BLOCKS.empty.repeat(empty)}] ${percent}%`;
}

/**
 * Wrap text in a box
 */
export function wrapInBox(text, padding = 2, style = 'single') {
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map(l => l.length));
  const width = maxLength + (padding * 2) + 2;
  
  const c = {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    heavy: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  }[style] || { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
  
  const top = c.tl + c.h.repeat(width - 2) + c.tr;
  const bottom = c.bl + c.h.repeat(width - 2) + c.br;
  
  const wrappedLines = lines.map(line => {
    const padded = line.padEnd(maxLength);
    return c.v + ' '.repeat(padding) + padded + ' '.repeat(padding) + c.v;
  });
  
  return [top, ...wrappedLines, bottom].join('\n');
}

/**
 * Typewriter effect generator
 */
export function* typewriterEffect(text, delay = 50) {
  for (let i = 1; i <= text.length; i++) {
    yield text.slice(0, i);
    if (delay > 0) {
      // Caller should handle delay
    }
  }
}

/**
 * Create data table in ASCII
 */
export function createTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    const headerLen = h.length;
    const maxDataLen = Math.max(...rows.map(r => String(r[i] || '').length));
    return Math.max(headerLen, maxDataLen);
  });
  
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + colWidths.length * 3 + 1;
  
  // Top border
  let table = '┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐\n';
  
  // Header row
  table += '│' + headers.map((h, i) => ' ' + h.padEnd(colWidths[i]) + ' ').join('│') + '│\n';
  
  // Header separator
  table += '├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤\n';
  
  // Data rows
  rows.forEach((row, rowIndex) => {
    table += '│' + row.map((cell, i) => ' ' + String(cell || '').padEnd(colWidths[i]) + ' ').join('│') + '│\n';
  });
  
  // Bottom border
  table += '└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘\n';
  
  return table;
}

/**
 * Format number with ASCII styling
 */
export function formatNumber(num, prefix = '$', decimals = 2) {
  const formatted = Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatted}`;
}

/**
 * Create percentage bar
 */
export function createPercentageBar(value, max, width = 20, filled = '█', empty = '░') {
  const percent = (value / max) * 100;
  const filledCount = Math.floor((percent / 100) * width);
  const emptyCount = width - filledCount;
  return filled.repeat(filledCount) + empty.repeat(emptyCount);
}

// ========================================
// ADDITIONAL ASSETS
// ========================================

export const INFINITY_SYMBOL = '∞';

export const GRAPH_CHARS = {
  verticalBar: '│',
  horizontalBar: '─',
  point: '●',
  line: '─',
  upTrend: '╱',
  downTrend: '╲',
};

export const ARROW_CHARS = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  upDown: '↕',
  leftRight: '↔',
  upRight: '↗',
  downRight: '↘',
  downLeft: '↙',
  upLeft: '↖',
};

export const BLOCK_ELEMENTS = {
  full: '█',
  sevenEighths: '▉',
  threeQuarters: '▊',
  fiveEighths: '▋',
  half: '▌',
  threeEighths: '▍',
  quarter: '▎',
  eighth: '▏',
  light: '░',
  medium: '▒',
  dark: '▓',
};

// ========================================
// PRE-MADE TEMPLATES
// ========================================

export const TEMPLATES = {
  metricCard: (label, value, unit = '') => `
┌─────────────────┐
│ ${label.toUpperCase().padEnd(15)}│
│                 │
│  ${String(value).padStart(10)} ${unit.padEnd(3)}│
└─────────────────┘
  `.trim(),

  statusLine: (label, status, value = '') => {
    const statusIcon = STATUS_ICONS[status] || '○';
    return `${statusIcon} ${label.padEnd(20)} ${value}`;
  },
  
  separator: (char = '─', length = 60) => char.repeat(length),
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Pad text to fit in box
 */
export function padToWidth(text, width, align = 'left') {
  if (text.length >= width) return text.slice(0, width);
  
  const padding = width - text.length;
  
  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    default:
      return text + ' '.repeat(padding);
  }
}

/**
 * Create horizontal rule with optional label
 */
export function createHR(length = 60, label = null) {
  if (!label) {
    return BOX_CHARS.horizontal.repeat(length);
  }
  
  const labelWithSpaces = ` ${label} `;
  const sideLength = Math.floor((length - labelWithSpaces.length) / 2);
  const leftSide = BOX_CHARS.horizontal.repeat(sideLength);
  const rightSide = BOX_CHARS.horizontal.repeat(length - sideLength - labelWithSpaces.length);
  
  return leftSide + labelWithSpaces + rightSide;
}

/**
 * Format timestamp in terminal style
 */
export function formatTerminalTime(date = new Date()) {
  return `[${date.toLocaleTimeString('en-US', { hour12: false })}]`;
}

/**
 * Create ASCII art from text (simple block letters)
 */
export function textToAscii(text) {
  // Simple implementation - would need full ASCII font map for production
  return text.toUpperCase().split('').map(char => {
    // Basic character mapping (simplified)
    return char === ' ' ? '  ' : `█ `;
  }).join('');
}

// ========================================
// EXPORT ALL
// ========================================

export default {
  // Logos
  CULTIV8_LOGO_LARGE,
  CULTIV8_LOGO_MEDIUM,
  CULTIV8_LOGO_SMALL,
  CULTIV8_LOGO_TINY,
  
  // Icons
  STATUS_ICONS,
  CONNECTION,
  RISK_LEVELS,
  TIER_BADGES,
  
  // Animations
  SPINNERS,
  PROGRESS_BLOCKS,
  
  // Box drawing
  BOX_CHARS,
  createBox,
  
  // Banners
  BANNERS,
  DIVIDERS,
  HEADERS,
  
  // Utilities
  centerText,
  createLoadingBar,
  wrapInBox,
  typewriterEffect,
  createTable,
  formatNumber,
  createPercentageBar,
  padToWidth,
  createHR,
  formatTerminalTime,
  textToAscii,
  
  // Additional
  INFINITY_SYMBOL,
  GRAPH_CHARS,
  ARROW_CHARS,
  BLOCK_ELEMENTS,
  TEMPLATES,
};


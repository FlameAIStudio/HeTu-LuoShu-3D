
export enum Polarity {
  YANG = 'YANG', // White, Odd
  YIN = 'YIN'    // Black, Even
}

export interface HeTuPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  polarity: Polarity;
  group: 'north' | 'south' | 'east' | 'west' | 'center';
  numberValue: number; // The number this dot belongs to (e.g., part of the '7' group)
}

export enum AnimationState {
  STATIC = 'STATIC',         // Cube form
  MORPHING = 'MORPHING',     // Transition Cube -> Galaxy
  RUNNING = 'RUNNING',       // Galaxy spinning
  RETURNING = 'RETURNING',   // Transition Galaxy/Helix -> Cube
  PAUSED = 'PAUSED',         // Frozen in Galaxy form
  
  // New Helix States
  HELIX_MORPHING = 'HELIX_MORPHING', // Transition Cube -> Helix
  HELIX_RUNNING = 'HELIX_RUNNING',   // Helix spinning
  HELIX_PAUSED = 'HELIX_PAUSED'      // Frozen in Helix form
}

export enum GalaxyPointType {
  CORE = 'CORE',
  RING = 'RING',
  ARM = 'ARM'
}

export interface GalaxyPointConfig {
  type: GalaxyPointType;
  r: number;          // Radius
  thetaStart: number; // Initial Angle (Base + Local Twist)
  speedFactor: number;// Multiplier for differential rotation
  zAmp: number;       // Z wobble amplitude
  zFreq: number;      // Z wobble frequency
  
  // Helix specific overrides (optional, can reuse above or add new)
  yOffset?: number;   // For vertical stacking in Helix
}

// --- LO SHU TYPES ---

export enum ViewMode {
  HETU = 'HETU',
  LOSHU = 'LOSHU'
}

export enum LoShuMorphState {
  PLANE = 'PLANE',
  SPHERE = 'SPHERE',
  PROJECTION = 'PROJECTION'
}

export interface LoShuPointData {
  id: string;
  numberValue: number; // 1-9
  polarity: Polarity;
  
  // Coordinates
  planePos: [number, number, number];  // x, y, 0
  spherePos: [number, number, number]; // x, y, z
  
  // Metadata for Trigrams/Direction
  trigram?: string;
  direction?: string;
}

export interface LoShuLayerState {
  dots: boolean;
  numbers: boolean;
  trigrams: boolean;
  directions: boolean;
  lines: boolean;
}

import { HeTuPoint, Polarity, GalaxyPointConfig, GalaxyPointType, LoShuPointData } from './types';
import * as THREE from 'three';

// --- CUBIC STRUCTURE CONFIGURATION (v1.0 Frozen) ---

const L = 20;        // Length of the Cube Side
const Z_HEAVEN = -L / 2;  // Back Face
const Z_EARTH = L / 2;    // Front Face
const Z_CENTER = 0;       // Pivot Layer

const SPACING = 1.2;      // Dot spacing
const EDGE_MARGIN = 2.0;  // How far from the absolute edge the dots sit

// Coordinates for faces
const TOP_Y = L / 2 - EDGE_MARGIN;
const BOTTOM_Y = -(L / 2 - EDGE_MARGIN);
const LEFT_X = -(L / 2 - EDGE_MARGIN);   // Negative X
const RIGHT_X = L / 2 - EDGE_MARGIN;     // Positive X

// Helper to create a point
const createPoint = (
  id: string,
  x: number,
  y: number,
  z: number,
  polarity: Polarity,
  group: HeTuPoint['group'],
  numberValue: number
): HeTuPoint => ({
  id,
  x,
  y,
  z,
  polarity,
  group,
  numberValue,
});

export const generateHeTuPoints = (): HeTuPoint[] => {
  const points: HeTuPoint[] = [];

  // ==========================================
  // 1. HEAVEN LAYER (Z = -L/2, Back) - Yang/White
  // ==========================================
  // SOUTH (Fire) - Top Edge - 7 White
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * SPACING;
    points.push(createPoint(`heaven-7-${i}`, x, TOP_Y, Z_HEAVEN, Polarity.YANG, 'south', 7));
  }
  // NORTH (Water) - Bottom Edge - 1 White
  points.push(createPoint(`heaven-1-0`, 0, BOTTOM_Y, Z_HEAVEN, Polarity.YANG, 'north', 1));
  // WEST (Metal) - Right Edge (Visual Left from Back is +X)
  for (let i = 0; i < 9; i++) {
    const y = (i - 4) * SPACING;
    points.push(createPoint(`heaven-9-${i}`, RIGHT_X, y, Z_HEAVEN, Polarity.YANG, 'west', 9));
  }
  // EAST (Wood) - Left Edge (Visual Right from Back is -X)
  for (let i = 0; i < 3; i++) {
    const y = (i - 1) * SPACING;
    points.push(createPoint(`heaven-3-${i}`, LEFT_X, y, Z_HEAVEN, Polarity.YANG, 'east', 3));
  }

  // ==========================================
  // 2. EARTH LAYER (Z = +L/2, Front) - Yin/Black
  // ==========================================
  // SOUTH (Fire) - Top Edge - 2 Black
  for (let i = 0; i < 2; i++) {
    const x = (i - 0.5) * SPACING;
    points.push(createPoint(`earth-2-${i}`, x, TOP_Y, Z_EARTH, Polarity.YIN, 'south', 2));
  }
  // NORTH (Water) - Bottom Edge - 6 Black
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * SPACING;
    points.push(createPoint(`earth-6-${i}`, x, BOTTOM_Y, Z_EARTH, Polarity.YIN, 'north', 6));
  }
  // EAST (Wood) - Left Edge - 8 Black
  for (let i = 0; i < 8; i++) {
    const y = (i - 3.5) * SPACING;
    points.push(createPoint(`earth-8-${i}`, LEFT_X, y, Z_EARTH, Polarity.YIN, 'east', 8));
  }
  // WEST (Metal) - Right Edge - 4 Black
  for (let i = 0; i < 4; i++) {
    const y = (i - 1.5) * SPACING;
    points.push(createPoint(`earth-4-${i}`, RIGHT_X, y, Z_EARTH, Polarity.YIN, 'west', 4));
  }

  // ==========================================
  // 3. CENTER PIVOT LAYER (Z = 0) - Soil
  // ==========================================
  // 5 White (Heaven) - Cross Shape (+)
  points.push(createPoint('center-5-mid', 0, 0, Z_CENTER, Polarity.YANG, 'center', 5));
  points.push(createPoint('center-5-top', 0, SPACING, Z_CENTER, Polarity.YANG, 'center', 5));
  points.push(createPoint('center-5-btm', 0, -SPACING, Z_CENTER, Polarity.YANG, 'center', 5));
  points.push(createPoint('center-5-lft', -SPACING, 0, Z_CENTER, Polarity.YANG, 'center', 5));
  points.push(createPoint('center-5-rgt', SPACING, 0, Z_CENTER, Polarity.YANG, 'center', 5));

  // 10 Black (Earth) - Split into Top and Bottom rows
  const CENTER_ROW_Y = 3 * SPACING;
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * SPACING;
    points.push(createPoint(`center-10-top-${i}`, x, CENTER_ROW_Y, Z_CENTER, Polarity.YIN, 'center', 10));
  }
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * SPACING;
    points.push(createPoint(`center-10-btm-${i}`, x, -CENTER_ROW_Y, Z_CENTER, Polarity.YIN, 'center', 10));
  }

  return points;
};

export const CUBE_SIZE = L;

// --- SORTING HELPER FOR FLUIDITY ---
export const sortHeTuPoints = (points: HeTuPoint[], sequence: number[]): HeTuPoint[] => {
  const descendingGroups = [4, 6, 9]; 

  const filtered = points.filter(p => sequence.includes(p.numberValue));
  
  filtered.sort((a, b) => {
    const idxA = sequence.indexOf(a.numberValue);
    const idxB = sequence.indexOf(b.numberValue);
    if (idxA !== idxB) return idxA - idxB;
    
    // Intra-group sorting
    if (descendingGroups.includes(a.numberValue)) {
       return b.id.localeCompare(a.id);
    }
    return a.id.localeCompare(b.id);
  });
  
  return filtered;
};

// --- GALAXY ANIMATION CONFIGURATION ---

export const generateGalaxyMap = (points: HeTuPoint[]): Record<string, GalaxyPointConfig> => {
  const map: Record<string, GalaxyPointConfig> = {};
  
  // 1. CENTER ASSEMBLY
  const centerCore = points.filter(p => p.group === 'center' && p.polarity === Polarity.YANG);
  centerCore.forEach(p => {
    const r = Math.sqrt(p.x * p.x + p.y * p.y);
    const theta = Math.atan2(p.y, p.x);
    map[p.id] = { type: GalaxyPointType.CORE, r, thetaStart: theta, speedFactor: 0, zAmp: 0, zFreq: 0 };
  });

  const earthPoints = points.filter(p => p.group === 'center' && p.polarity === Polarity.YIN);
  const ringRadius = 2.5; 
  earthPoints.forEach((p, i) => {
    const angle = (i / earthPoints.length) * Math.PI * 2;
    map[p.id] = { type: GalaxyPointType.RING, r: ringRadius, thetaStart: angle, speedFactor: 0, zAmp: 0, zFreq: 0 };
  });

  // 2. DUAL ARMS
  const yangSequenceValues = [1, 3, 7, 9];
  const yinSequenceValues = [2, 4, 6, 8]; 
  
  const SPIRAL_START_R = 5.8; 
  const SPIRAL_GROWTH_PER_RAD = 2.8; 
  const DOT_ARC_SPACING = 0.8;
  const GROUP_ARC_GAP = 1.8; 

  const createSpiralArm = (targetSequence: number[], armOffsetAngle: number) => {
    const armPoints = sortHeTuPoints(points, targetSequence);

    let currentPhi = 0;
    let lastNumberVal = -1;

    armPoints.forEach((p, i) => {
      const r = SPIRAL_START_R + SPIRAL_GROWTH_PER_RAD * currentPhi;
      let gap = 0;
      if (lastNumberVal !== -1) {
        gap = (p.numberValue !== lastNumberVal) ? GROUP_ARC_GAP : DOT_ARC_SPACING;
      }
      if (i > 0) currentPhi += gap / r;
      
      const finalR = SPIRAL_START_R + SPIRAL_GROWTH_PER_RAD * currentPhi;
      const finalTheta = armOffsetAngle - currentPhi;

      map[p.id] = {
        type: GalaxyPointType.ARM,
        r: finalR,
        thetaStart: finalTheta, 
        speedFactor: 0.8,
        zAmp: 0.0 + (currentPhi * 0.2), 
        zFreq: 1
      };
      lastNumberVal = p.numberValue;
    });
  };

  createSpiralArm(yangSequenceValues, -Math.PI / 2);
  createSpiralArm(yinSequenceValues, Math.PI / 2);

  return map;
};

// --- HELIX (DNA) ANIMATION CONFIGURATION ---

export const generateHelixMap = (points: HeTuPoint[]): Record<string, GalaxyPointConfig> => {
  const map: Record<string, GalaxyPointConfig> = {};

  // 1. CENTER AXIS (Static in Helix Mode)
  const centerCore = points.filter(p => p.group === 'center' && p.polarity === Polarity.YANG);
  centerCore.forEach(p => {
    const r = Math.sqrt(p.x * p.x + p.y * p.y);
    const theta = Math.atan2(p.y, p.x);
    map[p.id] = { 
      type: GalaxyPointType.CORE, 
      r, 
      thetaStart: theta, 
      speedFactor: 0, 
      zAmp: 0, 
      zFreq: 0,
      yOffset: 0 
    };
  });

  const centerRing = points.filter(p => p.group === 'center' && p.polarity === Polarity.YIN);
  const ringRadius = 2.5;
  centerRing.forEach((p, i) => {
    const angle = (i / centerRing.length) * Math.PI * 2;
    map[p.id] = { 
      type: GalaxyPointType.RING, 
      r: ringRadius, 
      thetaStart: angle, 
      speedFactor: 0, 
      zAmp: 0, 
      zFreq: 0,
      yOffset: 0
    };
  });

  // 2. CONICAL DOUBLE HELIX (VORTEX SHAPE)
  const HELIX_R_BOTTOM = 5.5;  
  const HELIX_R_TOP = 15.0;    
  
  const HELIX_DOT_STEP = 0.8;
  const HELIX_GROUP_GAP = 3.5;
  const RAD_PER_UNIT_HEIGHT = 0.35;

  const assignHelixPosition = (sequence: number[], phaseOffset: number, speedDir: number) => {
    const strandPoints = sortHeTuPoints(points, sequence);

    // First pass: Calculate total height
    let totalH = 0;
    let tempLastVal = -1;
    strandPoints.forEach(p => {
      if (tempLastVal !== -1) {
        totalH += (p.numberValue !== tempLastVal) ? HELIX_GROUP_GAP : HELIX_DOT_STEP;
      }
      tempLastVal = p.numberValue;
    });

    let currentH = 0;
    let lastNumberVal = -1;
    
    const startY = -totalH / 2;

    strandPoints.forEach((p) => {
      if (lastNumberVal !== -1) {
        if (p.numberValue !== lastNumberVal) {
           currentH += HELIX_GROUP_GAP; 
        } else {
           currentH += HELIX_DOT_STEP;
        }
      }

      // Normalized Height Progress
      const progress = totalH > 0 ? (currentH / totalH) : 0.5;

      // Conical Radius Calculation
      const currentR = HELIX_R_BOTTOM + (HELIX_R_TOP - HELIX_R_BOTTOM) * progress;
      
      const finalY = startY + currentH;
      const angle = phaseOffset + (currentH * RAD_PER_UNIT_HEIGHT);

      map[p.id] = {
        type: GalaxyPointType.ARM,
        r: currentR,        
        thetaStart: angle, 
        speedFactor: speedDir, // Dynamic speed direction
        zAmp: 0,
        zFreq: 0,
        yOffset: finalY 
      };

      lastNumberVal = p.numberValue;
    });
  };

  // Yang: 1 (Bottom) -> 9 (Top) -> Rotate CCW (-1)
  assignHelixPosition([1, 3, 7, 9], 0, -1.0);          
  
  // Yin: 2 (Bottom) -> 8 (Top) -> Rotate CCW (-1, same as Yang)
  assignHelixPosition([2, 4, 6, 8], Math.PI, -1.0);    

  return map;
};

// ============================================================================
// LO SHU CONSTANTS & GENERATION (STRICT GEOMETRY)
// ============================================================================

export const LOSHU_GRID_SIZE = 12; // Used for Plane Mode
export const SPHERE_RADIUS = 18;   // R for Sphere Mode

const TRIGRAMS: Record<number, string> = {
  1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离'
};
// Updated directions based on 3D view: 3 is Left, 7 is Right
const DIRECTIONS: Record<number, string> = {
  1: '北', 2: '西南', 3: '东', 4: '东南', 5: '中', 6: '西北', 7: '西', 8: '东北', 9: '南'
};

// --- STRICT SPHERICAL ANCHORS ---
// Coordinate System:
// +Y = South (Top - Fire)
// -Y = North (Bottom - Water)
// -X = East (Left - Wood)
// +X = West (Right - Metal)
// +Z = Front (Viewer)
// -Z = Back

// To create the "Quantum Motion" / "Vortex" effect seen in the reference,
// the Corner numbers (2, 4, 6, 8) must form a tetrahedral structure inscribed in the sphere.
// 2 and 6 are pulled to the FRONT (+Z).
// 4 and 8 are pushed to the BACK (-Z).
// This ensures that opposites (2-8 and 4-6) pass through the center volume diagonally.

const R = SPHERE_RADIUS;

// Defines coordinates for corners of a cube inscribed in sphere
// Magnitude for each component = R / sqrt(3)
const D = R * 0.577; 

// Rotated 45 degrees on XZ plane for 3 and 7 to match the twisted corners
// 0.707 = 1/sqrt(2)
const D_CROSS = R * 0.707;

const LOSHU_ANCHORS: Record<number, THREE.Vector3> = {
  // POLES
  9: new THREE.Vector3(0, R, 0),       // South (Top)
  1: new THREE.Vector3(0, -R, 0),      // North (Bottom)
  
  // EQUATORIALS (Twisted)
  // 3 (East/Left) moves to Back-Left to align with 4 & 8
  3: new THREE.Vector3(-D_CROSS, 0, -D_CROSS),
  
  // 7 (West/Right) moves to Front-Right to align with 2 & 6
  7: new THREE.Vector3(D_CROSS, 0, D_CROSS),
  
  // CORNERS (Tetrahedral Twist)
  
  // 4 (SE - Top Left visually): Back (-Z)
  // Position: Left (-X), Top (+Y), Back (-Z)
  4: new THREE.Vector3(-D, D, -D),
  
  // 2 (SW - Top Right visually): Front (+Z)
  // Position: Right (+X), Top (+Y), Front (+Z)
  2: new THREE.Vector3(D, D, D),
  
  // 8 (NE - Bottom Left visually): Back (-Z)
  // Position: Left (-X), Bottom (-Y), Back (-Z)
  8: new THREE.Vector3(-D, -D, -D),
  
  // 6 (NW - Bottom Right visually): Front (+Z)
  // Position: Right (+X), Bottom (-Y), Front (+Z)
  6: new THREE.Vector3(D, -D, D),

  // CORE
  5: new THREE.Vector3(0, 0, 0),       // Center (Core)
};

// --- ROTATION HELPERS ---
const rotate2D = (x: number, y: number, angleRad: number): [number, number] => {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return [x * cos - y * sin, x * sin + y * cos];
};

// --- PATH GENERATION (SLERP + Core Dive) ---
// Generates points for the energy tube. 
// CRITICAL: Use SLERP (Spherical Linear Interpolation) for all surface-to-surface connections
// to ensure the tube "paves" the sphere and doesn't cut through it.
// UPDATED: Now supports a custom sequence and handles open paths correctly.
export const generateLoShuEnergyPath = (
  sequence: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1],
  radiusScale: number = 1.15,
  segmentsPerLeg: number = 64
): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < sequence.length - 1; i++) {
    const startNum = sequence[i];
    const endNum = sequence[i + 1];
    
    const startAnchor = LOSHU_ANCHORS[startNum];
    const endAnchor = LOSHU_ANCHORS[endNum];

    // Determine types
    const isStartCenter = startAnchor.lengthSq() < 0.1;
    const isEndCenter = endAnchor.lengthSq() < 0.1;

    // Normal vectors (Projected to radius)
    // NOTE: radiusScale is applied so tube sits slightly inside or on surface
    const getPos = (anchor: THREE.Vector3) => {
       if (anchor.lengthSq() < 0.1) return new THREE.Vector3(0,0,0);
       return anchor.clone().normalize().multiplyScalar(SPHERE_RADIUS * radiusScale);
    };

    const vStart = getPos(startAnchor);
    const vEnd = getPos(endAnchor);

    for (let j = 0; j < segmentsPerLeg; j++) {
      const t = j / segmentsPerLeg;
      
      let vec = new THREE.Vector3();

      if (isStartCenter || isEndCenter) {
        // LINEAR (Dive/Ascent)
        // 4->5 or 5->6
        vec.copy(vStart).lerp(vEnd, t);
      } else {
        // SPHERICAL (Surface Paving)
        // 1->2->3...
        // Use manual SLERP since Three.js Vector3 doesn't have it
        const nStart = vStart.clone().normalize();
        const nEnd = vEnd.clone().normalize();
        
        // Compute angle between them
        const dot = Math.max(-1, Math.min(1, nStart.dot(nEnd)));
        const theta = Math.acos(dot);
        
        if (Math.abs(theta) < 0.0001) {
            // Linear approximation for very small angles
            vec.copy(nStart).lerp(nEnd, t);
        } else {
            const sinTheta = Math.sin(theta);
            const w1 = Math.sin((1 - t) * theta) / sinTheta;
            const w2 = Math.sin(t * theta) / sinTheta;
            
            vec.copy(nStart).multiplyScalar(w1).add(nEnd.clone().multiplyScalar(w2));
        }
        
        // Scale back to radius
        vec.normalize().multiplyScalar(SPHERE_RADIUS * radiusScale);
      }

      points.push(vec);
    }
  }
  
  // Close or finish the loop with the actual final point
  const lastNum = sequence[sequence.length - 1];
  const lastAnchor = LOSHU_ANCHORS[lastNum];
  let pFinal: THREE.Vector3;
  if (lastAnchor.lengthSq() < 0.1) {
      pFinal = new THREE.Vector3(0,0,0);
  } else {
      pFinal = lastAnchor.clone().normalize().multiplyScalar(SPHERE_RADIUS * radiusScale);
  }
  points.push(pFinal);
  
  return points;
};

// --- DOT GENERATION ---

export const generateLoShuPoints = (): LoShuPointData[] => {
  const points: LoShuPointData[] = [];
  
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const gap = 1.3;

  numbers.forEach((num) => {
    const anchorPos = LOSHU_ANCHORS[num];
    const isYang = num % 2 !== 0;

    // 1. Define Pattern in 2D Local Space
    let offsets: [number, number][] = [];

    if (num === 1) offsets.push([0, 0]);
    else if (num === 2) { 
       offsets.push([-gap/1.5, -gap/1.5], [gap/1.5, gap/1.5]); 
    }
    else if (num === 3) { 
       offsets.push([0, gap], [0, 0], [0, -gap]); 
    }
    else if (num === 4) { 
       offsets.push([0, gap * 1.2], [gap * 1.2, 0], [0, -gap * 1.2], [-gap * 1.2, 0]);
    }
    else if (num === 5) { 
       // Center 5: Condensed cross
       offsets.push([0, 0], [0, gap*0.6], [0, -gap*0.6], [-gap*0.6, 0], [gap*0.6, 0]);
    }
    else if (num === 6) { 
       const w = gap * 0.8; const h = gap * 0.8;
       let raw = [[-w, h*2], [w, h*2], [w, 0], [w, -h*2], [-w, -h*2], [-w, 0]];
       offsets = raw.map(o => rotate2D(o[0], o[1], Math.PI / 4)) as [number, number][];
    }
    else if (num === 7) { 
       for(let k=3; k>=-3; k--) offsets.push([0, k * gap * 0.6]);
    }
    else if (num === 8) { 
       const w = gap * 0.8; const h = gap * 0.6;
       let raw = [[-w, h*3], [w, h*3], [w, h], [w, -h], [w, -h*3], [-w, -h*3], [-w, -h], [-w, h]];
       offsets = raw.map(o => rotate2D(o[0], o[1], -Math.PI / 4)) as [number, number][];
    }
    else if (num === 9) { 
       for(let k=-4; k<=4; k++) offsets.push([k * gap * 0.6, 0]);
    }

    // 2. Project Points
    // Special handling for 5: It stays at Center (0,0,0)
    const isCenter = num === 5;

    let quaternion = new THREE.Quaternion();
    
    if (!isCenter) {
       const targetNormal = anchorPos.clone().normalize();
       quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), targetNormal);
    } 
    // If center, identity quaternion is fine (flat on Z=0 plane inside sphere)

    // 3. Generate Points
    offsets.forEach((off, i) => {
      let spherePosVec: THREE.Vector3;

      if (isCenter) {
         // Keep at center, just use offsets in XY plane
         spherePosVec = new THREE.Vector3(off[0], off[1], 0);
      } else {
         const localVec = new THREE.Vector3(off[0], off[1], R);
         localVec.normalize().multiplyScalar(R);
         spherePosVec = localVec.applyQuaternion(quaternion);
      }

      // Plane Position (Old Lo Shu Grid)
      const gx = (num===3||num===4||num===8)?-1 : (num===7||num===2||num===6)?1 : 0;
      const gy = (num===9||num===4||num===2)?1 : (num===1||num===8||num===6)?-1 : 0;
      const planeBaseX = gx * LOSHU_GRID_SIZE;
      const planeBaseY = gy * LOSHU_GRID_SIZE;
      const planePos: [number, number, number] = [planeBaseX + off[0], planeBaseY + off[1], 0];

      points.push({
        id: `ls-${num}-${i}`,
        numberValue: num,
        polarity: isYang ? Polarity.YANG : Polarity.YIN,
        planePos: planePos,
        spherePos: [spherePosVec.x, spherePosVec.y, spherePosVec.z],
        trigram: i === 0 ? TRIGRAMS[num] : undefined,
        direction: i === 0 ? DIRECTIONS[num] : undefined
      });
    });
  });

  return points;
};
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import { generateHeTuPoints, generateGalaxyMap, generateHelixMap, sortHeTuPoints, CUBE_SIZE } from '../constants';
import { Polarity, AnimationState, GalaxyPointType, HeTuPoint, GalaxyPointConfig } from '../types';
import * as THREE from 'three';
import { easing } from 'maath';

interface HeTuSceneProps {
  alignTrigger: number;
  animState: AnimationState;
  autoRotate: boolean;
}

const SPIN_SIGN = -1; 
const GLOBAL_SPEED = 1.0; 

// -----------------------------------------------------------------------------
// Shared Logic
// -----------------------------------------------------------------------------

// Calculate target position based on Config Type
const getTargetPosition = (
  gConfig: GalaxyPointConfig,
  time: number
): THREE.Vector3 => {
  // Common rotation logic
  const thetaNow = gConfig.thetaStart + (SPIN_SIGN * gConfig.speedFactor * time);
  
  if (gConfig.yOffset !== undefined) {
    // Helix Mode (Y-axis aligned)
    // x = r * cos, z = r * sin, y = fixed Y offset
    const x = gConfig.r * Math.cos(thetaNow);
    const z = gConfig.r * Math.sin(thetaNow);
    const y = gConfig.yOffset;
    return new THREE.Vector3(x, y, z);
  } else {
    // Galaxy Mode (Z-axis wobble, Flat-ish)
    if (gConfig.type === GalaxyPointType.CORE || gConfig.type === GalaxyPointType.RING) {
      // Static-ish ring/core
      const tx = gConfig.r * Math.cos(gConfig.thetaStart); // Core/Ring doesn't spin in Galaxy mode
      const ty = gConfig.r * Math.sin(gConfig.thetaStart);
      return new THREE.Vector3(tx, ty, 0);
    } else {
      // Arms spin
      const x = gConfig.r * Math.cos(thetaNow);
      const y = gConfig.r * Math.sin(thetaNow);
      const z = Math.sin(thetaNow * gConfig.zFreq) * gConfig.zAmp;
      return new THREE.Vector3(x, y, z);
    }
  }
};

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const PointLine = ({ 
  points, 
  galaxyMap,
  helixMap,
  sequence, 
  color, 
  timeRef, 
  morphRef, 
  modeRef
}: { 
  points: HeTuPoint[], 
  galaxyMap: Record<string, GalaxyPointConfig>,
  helixMap: Record<string, GalaxyPointConfig>,
  sequence: number[],
  color: string,
  timeRef: React.MutableRefObject<number>,
  morphRef: React.MutableRefObject<number>,
  helixMorphRef?: React.MutableRefObject<number>, // Optional/Unused
  modeRef: React.MutableRefObject<'GALAXY' | 'HELIX' | 'NONE'>
}) => {
  const lineRef = useRef<any>(null);

  // 1. Sort Points using the shared logic to ensure smooth connectivity
  const sortedPoints = useMemo(() => {
    return sortHeTuPoints(points, sequence);
  }, [points, sequence]);

  // 2. Vertex Mapping
  const SEGMENTS_PER_LINK = 16; 
  const totalVertices = (sortedPoints.length - 1) * SEGMENTS_PER_LINK + 1;

  const vertexMap = useMemo(() => {
    const map = [];
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const pA = sortedPoints[i];
      const pB = sortedPoints[i+1];
      for (let j = 0; j < SEGMENTS_PER_LINK; j++) {
        map.push({ pA, pB, t: j / SEGMENTS_PER_LINK });
      }
    }
    const last = sortedPoints[sortedPoints.length - 1];
    map.push({ pA: last, pB: last, t: 0 });
    return map;
  }, [sortedPoints]);

  useFrame(() => {
    if (lineRef.current && lineRef.current.geometry) {
      const time = timeRef.current;
      const morph = morphRef.current; // 0 -> 1 (Cube -> Target)
      const isHelix = modeRef.current === 'HELIX';

      const flatPositions: number[] = [];

      for (let i = 0; i < vertexMap.length; i++) {
        const { pA, pB, t } = vertexMap[i];
        
        // Cube Pos
        const cx = pA.x + (pB.x - pA.x) * t;
        const cy = pA.y + (pB.y - pA.y) * t;
        const cz = pA.z + (pB.z - pA.z) * t;

        // Target Pos
        let tx, ty, tz;
        if (isHelix) {
          // POLAR INTERPOLATION FOR HELIX
          const confA = helixMap[pA.id];
          const confB = helixMap[pB.id];

          // Interpolate parameters
          const r = confA.r + (confB.r - confA.r) * t;
          const yA = confA.yOffset ?? 0;
          const yB = confB.yOffset ?? 0;
          const y = yA + (yB - yA) * t;

          const thetaA = confA.thetaStart;
          const thetaB = confB.thetaStart;
          const theta = thetaA + (thetaB - thetaA) * t;

          // Apply rotation (assuming consistent speed)
          const thetaNow = theta + (SPIN_SIGN * confA.speedFactor * time);
          
          tx = r * Math.cos(thetaNow);
          ty = y;
          tz = r * Math.sin(thetaNow);
        } else {
          // GALAXY / DEFAULT (Cartesian Lerp)
          const confA = galaxyMap[pA.id];
          const confB = galaxyMap[pB.id];
          const vA = getTargetPosition(confA, time);
          const vB = getTargetPosition(confB, time);
          tx = vA.x + (vB.x - vA.x) * t;
          ty = vA.y + (vB.y - vA.y) * t;
          tz = vA.z + (vB.z - vA.z) * t;
        }

        // Mix
        flatPositions.push(
          cx + (tx - cx) * morph,
          cy + (ty - cy) * morph,
          cz + (tz - cz) * morph
        );
      }

      lineRef.current.geometry.setPositions(flatPositions);
      
      if (lineRef.current.material) {
        lineRef.current.material.opacity = morph * 0.8;
        lineRef.current.visible = morph > 0.01;
      }
    }
  });

  return (
    <Line 
      ref={lineRef}
      points={new Array(totalVertices).fill([0,0,0])} 
      color={color} 
      lineWidth={2} 
      transparent 
      opacity={0} 
    />
  );
};

const AnimatedPoints = ({ animState }: { animState: AnimationState }) => {
  const points = useMemo(() => generateHeTuPoints(), []);
  const galaxyMap = useMemo(() => generateGalaxyMap(points), [points]);
  const helixMap = useMemo(() => generateHelixMap(points), [points]);
  
  const meshRefs = useRef<Record<string, THREE.Mesh>>({});

  const timeRef = useRef(0);
  const morphRef = useRef(0); // General Morph: 0 (Cube) -> 1 (Any Target)
  
  // Track which mode we are targeting for interpolation
  const modeRef = useRef<'GALAXY' | 'HELIX' | 'NONE'>('NONE');

  useFrame((state, delta) => {
    // 1. Determine Target Mode & Morph Level
    let targetMorph = 0;
    
    if (animState === AnimationState.STATIC) {
      targetMorph = 0;
    } else if (animState === AnimationState.RETURNING) {
      targetMorph = 0;
    } else if (
      animState === AnimationState.HELIX_MORPHING || 
      animState === AnimationState.HELIX_RUNNING || 
      animState === AnimationState.HELIX_PAUSED
    ) {
      modeRef.current = 'HELIX';
      targetMorph = 1;
    } else {
      // RUNNING, MORPHING, PAUSED (Galaxy)
      modeRef.current = 'GALAXY';
      targetMorph = 1;
    }

    easing.damp(morphRef, 'current', targetMorph, 0.8, delta);

    // 2. Advance Time (only if Running)
    const isRunning = animState === AnimationState.RUNNING || animState === AnimationState.HELIX_RUNNING;
    if (isRunning) {
      timeRef.current += delta * GLOBAL_SPEED;
    }

    // 3. Update Points
    points.forEach((pt) => {
      const mesh = meshRefs.current[pt.id];
      if (!mesh) return;

      // Calculate Cube Position
      const cx = pt.x;
      const cy = pt.y;
      const cz = pt.z;

      // Calculate Target Position based on Mode
      let tx, ty, tz;
      if (modeRef.current === 'HELIX') {
        const v = getTargetPosition(helixMap[pt.id], timeRef.current);
        tx = v.x; ty = v.y; tz = v.z;
      } else {
        const v = getTargetPosition(galaxyMap[pt.id], timeRef.current);
        tx = v.x; ty = v.y; tz = v.z;
      }

      // Lerp
      mesh.position.set(
        cx + (tx - cx) * morphRef.current,
        cy + (ty - cy) * morphRef.current,
        cz + (tz - cz) * morphRef.current
      );
    });
  });

  // Colors
  const COLOR_YANG = "#ffffff";
  const COLOR_YIN = "#101010"; 

  return (
    <group>
      {points.map((point) => (
        <mesh 
          key={point.id} 
          ref={(el) => { if (el) meshRefs.current[point.id] = el; }}
        >
          <sphereGeometry args={[0.4, 32, 32]} />
          <meshStandardMaterial
            color={point.polarity === Polarity.YANG ? COLOR_YANG : COLOR_YIN}
            emissive={point.polarity === Polarity.YANG ? COLOR_YANG : "#000000"}
            emissiveIntensity={0.6}
            roughness={0.2}
            metalness={0.5}
          />
        </mesh>
      ))}

      {/* Yang Tail: 1 (Bottom) -> 9 (Top) */}
      <PointLine 
        points={points} 
        galaxyMap={galaxyMap} 
        helixMap={helixMap}
        sequence={[1, 3, 7, 9]} 
        color={COLOR_YANG}
        timeRef={timeRef} 
        morphRef={morphRef}
        modeRef={modeRef}
      />
      
      {/* Yin Tail: 2 (Bottom) -> 8 (Top) */}
      <PointLine 
        points={points} 
        galaxyMap={galaxyMap} 
        helixMap={helixMap}
        sequence={[2, 4, 6, 8]} 
        color={COLOR_YIN} 
        timeRef={timeRef} 
        morphRef={morphRef}
        modeRef={modeRef}
      />
    </group>
  );
};

const CubeBoundary = ({ animState }: { animState: AnimationState }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const isVisible = animState === AnimationState.STATIC || animState === AnimationState.RETURNING;
      const targetOpacity = isVisible ? 0.2 : 0.0;
      // @ts-ignore
      easing.damp(meshRef.current.material, 'opacity', targetOpacity, 0.5, delta);
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
      <meshBasicMaterial color="#bae6fd" wireframe transparent opacity={0.2} />
    </mesh>
  );
};

const CameraRig = ({ alignTrigger, animState }: { alignTrigger: number, animState: AnimationState }) => {
  const { controls } = useThree();
  const controlsRef = useRef<any>(null);
  const isAligning = useRef(false);
  const targetPos = new THREE.Vector3(0, 0, CUBE_SIZE * 2.5); 
  
  const galaxyZoom = 8;
  const cubeZoom = 15;

  useEffect(() => {
    if (alignTrigger > 0) isAligning.current = true;
  }, [alignTrigger]);

  useFrame((state, delta) => {
    if (isAligning.current && controlsRef.current) {
      state.camera.position.lerp(targetPos, 0.05);
      if (state.camera.position.distanceTo(targetPos) < 0.1) {
        state.camera.position.copy(targetPos);
        state.camera.lookAt(0, 0, 0);
        isAligning.current = false;
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }

    const isExpanded = animState !== AnimationState.STATIC && animState !== AnimationState.RETURNING;
    const targetZoom = isExpanded ? galaxyZoom : cubeZoom;
    easing.damp(state.camera, 'zoom', targetZoom, 1.5, delta);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.5}
      // autoRotate handled by SceneRotator now
      minZoom={5}
      maxZoom={50}
    />
  );
};

// Controls rotation of the entire object group around the Z-axis
interface SceneRotatorProps {
  children?: React.ReactNode;
  autoRotate: boolean;
  alignTrigger: number;
}

const SceneRotator = ({ children, autoRotate, alignTrigger }: SceneRotatorProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useEffect(() => {
    // Reset rotation when align is triggered
    if (groupRef.current && alignTrigger > 0) {
      groupRef.current.rotation.set(0, 0, 0);
    }
  }, [alignTrigger]);

  useFrame((_, delta) => {
    if (groupRef.current && autoRotate) {
      // Rotate around Z axis (face rotating 360 degrees)
      groupRef.current.rotation.z -= delta * 0.5;
    }
  });

  return <group ref={groupRef}>{children}</group>;
};

// -----------------------------------------------------------------------------
// Scene Composition
// -----------------------------------------------------------------------------

export const HeTuScene: React.FC<HeTuSceneProps> = ({ alignTrigger, animState, autoRotate }) => {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      orthographic
      camera={{ position: [25, -25, 30], zoom: 15 }} 
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      {/* Fog matched to lighter Midnight Blue edge (#172554) */}
      <fog attach="fog" args={['#172554', 40, 150]} />
      <ambientLight intensity={0.5} color="#ffffff" /> 
      <directionalLight position={[20, 30, 40]} intensity={2.2} color="#ffffff" castShadow />
      <spotLight position={[-30, 10, -10]} intensity={1.0} color="#e0f2fe" angle={0.6} penumbra={1} />
      <pointLight position={[0, -30, 0]} intensity={1.0} color="#3b82f6" />

      <SceneRotator autoRotate={autoRotate} alignTrigger={alignTrigger}>
        <CubeBoundary animState={animState} />
        <AnimatedPoints animState={animState} />
      </SceneRotator>
      
      <CameraRig alignTrigger={alignTrigger} animState={animState} />
    </Canvas>
  );
};
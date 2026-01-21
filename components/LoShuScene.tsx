import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Html, shaderMaterial } from '@react-three/drei';
import { generateLoShuPoints, SPHERE_RADIUS, LOSHU_GRID_SIZE } from '../constants';
import { Polarity, LoShuMorphState, LoShuLayerState, LoShuPointData } from '../types';
import * as THREE from 'three';
import { easing } from 'maath';

interface LoShuSceneProps {
  morphState: LoShuMorphState;
  layerState: LoShuLayerState;
  isRunning: boolean;       // Controls "Flying Star" (Energy Flow)
  isSphereRotating: boolean; // Controls "Run" (Sphere Rotation)
}

// -----------------------------------------------------------------------------
// SHADER MATERIAL: ELECTRIC ARC (WARP LIGHTNING)
// -----------------------------------------------------------------------------

const EnergyFlowMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#39ff14"), // Electric Neon Green
    uCoreColor: new THREE.Color("#ffffff"), // Pure White Core
    uOpacity: 1.0,
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader
  `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uCoreColor;
    uniform float uOpacity;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    // Pseudo-random function
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // 2D Noise
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      float viewDot = abs(dot(vNormal, viewDir));
      float fresnel = pow(1.0 - viewDot, 2.0); // Edge glow
      
      // ----------------------------------------------------
      // ELECTRIC BOLT EFFECT (SLOWED DOWN)
      // ----------------------------------------------------
      float time = uTime * 2.0; // Reduced speed (was 6.0)
      
      // Bolt 1: Main jagged line
      // Scale X (Length) vs Y (Circumference)
      vec2 nCoord1 = vec2(vUv.x * 3.0 - time, vUv.y * 6.0);
      float n1 = noise(nCoord1);
      // Create a thin line where noise crosses 0.5
      float bolt1 = 0.05 / (abs(n1 - 0.5) + 0.05); 
      bolt1 = pow(bolt1, 2.0); // Sharpen

      // Bolt 2: Secondary sparks (faster, higher frequency)
      vec2 nCoord2 = vec2(vUv.x * 8.0 + time * 1.5, vUv.y * 12.0);
      float n2 = noise(nCoord2);
      float bolt2 = 0.02 / (abs(n2 - 0.5) + 0.05);
      
      // Pulse / Surge (SLOWED DOWN)
      float flow = fract(vUv.x * 0.8 - uTime * 0.5); // Reduced speed (was 2.0)
      float surge = smoothstep(0.0, 0.1, flow) * smoothstep(0.6, 0.0, flow);
      float surgeBrightness = 1.0 + surge * 3.0;

      // Combine
      float brightness = (bolt1 + bolt2 * 0.5) * surgeBrightness;
      
      // Add Fresnel for Volume
      brightness += fresnel * 0.3;

      // Color Mixing
      // Map brightness to color ramp
      vec3 finalColor = mix(uColor, uCoreColor, clamp(brightness - 0.5, 0.0, 1.0));
      finalColor *= brightness * 1.5; // Overdrive intensity for Bloom

      // Alpha Masking
      // Hide dark areas to see through the "mesh" (energy arc)
      float alpha = uOpacity * smoothstep(0.1, 0.5, brightness);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
);

extend({ EnergyFlowMaterial });

// -----------------------------------------------------------------------------
// HELPER: CALCULATE GROUP CENTERS
// -----------------------------------------------------------------------------
const useGroupCenters = (points: LoShuPointData[]) => {
  return useMemo(() => {
    const centers: Record<number, { plane: THREE.Vector3, sphere: THREE.Vector3, trigram?: string, direction?: string }> = {};
    const counts: Record<number, number> = {};

    points.forEach(pt => {
      if (!centers[pt.numberValue]) {
        centers[pt.numberValue] = { 
            plane: new THREE.Vector3(), 
            sphere: new THREE.Vector3(), 
            trigram: pt.trigram,
            direction: pt.direction 
        };
        counts[pt.numberValue] = 0;
      }
      
      centers[pt.numberValue].plane.add(new THREE.Vector3(...pt.planePos));
      centers[pt.numberValue].sphere.add(new THREE.Vector3(...pt.spherePos));
      counts[pt.numberValue]++;
    });

    Object.keys(centers).forEach(key => {
      const k = parseInt(key);
      centers[k].plane.divideScalar(counts[k]);
      centers[k].sphere.divideScalar(counts[k]);
    });
    
    return centers;
  }, [points]);
};

// -----------------------------------------------------------------------------
// SUB-COMPONENTS
// -----------------------------------------------------------------------------

// 1. Planar Direction Labels
const PlanarDirectionLabels = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  const offset = LOSHU_GRID_SIZE * 2.2;
  const labelClass = "text-cyan-500/80 font-bold text-sm md:text-base tracking-widest uppercase font-serif drop-shadow-md select-none whitespace-nowrap";
  const subLabelClass = "text-cyan-800/60 font-bold text-xs tracking-widest uppercase font-serif drop-shadow-sm select-none whitespace-nowrap";
  return (
    <group>
      <Html position={[0, offset, 0]} center zIndexRange={[0, 0]}><div className={labelClass}>南 (South)</div></Html>
      <Html position={[0, -offset, 0]} center zIndexRange={[0, 0]}><div className={labelClass}>北 (North)</div></Html>
      <Html position={[-offset, 0, 0]} center zIndexRange={[0, 0]}><div className={labelClass}>东 (East)</div></Html>
      <Html position={[offset, 0, 0]} center zIndexRange={[0, 0]}><div className={labelClass}>西 (West)</div></Html>
      <Html position={[offset, offset, 0]} center zIndexRange={[0, 0]}><div className={subLabelClass}>西南</div></Html>
      <Html position={[-offset, offset, 0]} center zIndexRange={[0, 0]}><div className={subLabelClass}>东南</div></Html>
      <Html position={[offset, -offset, 0]} center zIndexRange={[0, 0]}><div className={subLabelClass}>西北</div></Html>
      <Html position={[-offset, -offset, 0]} center zIndexRange={[0, 0]}><div className={subLabelClass}>东北</div></Html>
    </group>
  );
};

// 2. Reference Guides (Wireframe Sphere)
const SphereReferenceGuides = ({ visible }: { visible: boolean }) => {
  const meshRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (meshRef.current && meshRef.current.children[0]) {
      const targetOpacity = visible ? 0.05 : 0;
      const mesh = meshRef.current.children[0] as THREE.Mesh;
      if (mesh.material) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, delta * 2);
        mat.visible = mat.opacity > 0.01;
      }
    }
  });

  return (
    <group ref={meshRef}>
      <mesh>
        <sphereGeometry args={[SPHERE_RADIUS, 32, 32]} />
        <meshBasicMaterial color="#083344" wireframe transparent opacity={0} />
      </mesh>
    </group>
  );
};

// 3. Glass Energy Sphere (Darker container for the light show)
const GlassSphere = ({ visible }: { visible: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame((_, delta) => {
    if (materialRef.current) {
        const targetOpacity = visible ? 0.1 : 0;
        materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, targetOpacity, delta * 2);
        if (meshRef.current) {
            meshRef.current.visible = materialRef.current.opacity > 0.01;
        }
    }
  });

  return (
     <mesh ref={meshRef}>
        <sphereGeometry args={[SPHERE_RADIUS * 0.98, 64, 64]} />
        <meshPhysicalMaterial 
            ref={materialRef}
            color="#000000" 
            emissive="#06b6d4"
            emissiveIntensity={0.1}
            roughness={0.0}
            metalness={0.2}
            transmission={0.95} 
            thickness={0.5}
            transparent={true}
            side={THREE.DoubleSide}
            depthWrite={false}
        />
     </mesh>
  );
};

// 4. Energy Tube (The Holographic Conduit)
const EnergyTube = ({ 
    points, 
    visible, 
    morphState,
    isRunning 
}: { 
    points: THREE.Vector3[], 
    visible: boolean, 
    morphState: LoShuMorphState,
    isRunning: boolean 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  const opacityRef = useRef(0);

  const curve = useMemo(() => {
      if (points.length < 2) return null;
      return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.2);
  }, [points]);

  const geometry = useMemo(() => {
      if (!curve) return null;
      // Radius 0.45 - Thick enough to see, thin enough to look high-tech
      return new THREE.TubeGeometry(curve, 400, 0.45, 12, true);
  }, [curve]);

  useFrame((state, delta) => {
     const isSphere = morphState === LoShuMorphState.SPHERE;
     const targetOpacity = (visible && isSphere) ? 1 : 0;
     
     opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 3);
     
     if (meshRef.current && materialRef.current) {
         materialRef.current.uOpacity = opacityRef.current;
         meshRef.current.visible = opacityRef.current > 0.01;

         if (isRunning) {
            materialRef.current.uTime += delta;
         }
     }
  });

  if (!geometry) return null;

  return (
      <mesh ref={meshRef} geometry={geometry} renderOrder={20}>
          {/* @ts-ignore */}
          <energyFlowMaterial 
            ref={materialRef} 
            transparent 
            depthWrite={false} // CRITICAL for glow overlap
            depthTest={true}
            blending={THREE.AdditiveBlending} // CRITICAL for "Light" effect (Colors sum up)
            side={THREE.DoubleSide}
          />
      </mesh>
  );
};


// 5. Energy Path Logic
const EnergySystem = ({ centers, visible, morphState, isRunning }: { centers: any, visible: boolean, morphState: LoShuMorphState, isRunning: boolean }) => {
  const pathPoints = useMemo(() => {
    if (!centers[1] || !centers[9]) return [];

    const R = SPHERE_RADIUS;
    const segments = 12;

    const createArc = (start: THREE.Vector3, end: THREE.Vector3, control: THREE.Vector3) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const p = new THREE.Vector3()
                .addScaledVector(start, (1 - t) * (1 - t))
                .addScaledVector(control, 2 * (1 - t) * t)
                .addScaledVector(end, t * t);
            p.normalize().multiplyScalar(R * 1.05); 
            pts.push(p);
        }
        return pts;
    };

    const getShortestPathControl = (s: THREE.Vector3, e: THREE.Vector3, scale = 1.1) => {
        return new THREE.Vector3().addVectors(s, e).normalize().multiplyScalar(R * scale);
    };

    const fullPath: THREE.Vector3[] = [];
    const addPoints = (pts: THREE.Vector3[]) => {
         if (fullPath.length > 0) fullPath.push(...pts.slice(1));
         else fullPath.push(...pts);
    };

    // 1 -> 2
    addPoints(createArc(centers[1].sphere, centers[2].sphere, new THREE.Vector3(0, 0, R * 1.8)));
    // 2 -> 3
    addPoints(createArc(centers[2].sphere, centers[3].sphere, new THREE.Vector3(R * 1.5, R * 0.6, -R * 1.5)));
    // 3 -> 4
    addPoints(createArc(centers[3].sphere, centers[4].sphere, getShortestPathControl(centers[3].sphere, centers[4].sphere, 1.2)));
    // 4 -> 5 -> 6 (Internal Dive)
    {
        const p4 = centers[4].sphere.clone();
        const p5 = centers[5].sphere.clone();
        const p6 = centers[6].sphere.clone();
        
        const pts45 = [];
        for(let i=0; i<=segments; i++) pts45.push(new THREE.Vector3().lerpVectors(p4, p5, i/segments));
        addPoints(pts45);

        const pts56 = [];
        for(let i=0; i<=segments; i++) pts56.push(new THREE.Vector3().lerpVectors(p5, p6, i/segments));
        addPoints(pts56);
    }
    // 6 -> 7
    addPoints(createArc(centers[6].sphere, centers[7].sphere, getShortestPathControl(centers[6].sphere, centers[7].sphere, 1.2)));
    // 7 -> 8
    addPoints(createArc(centers[7].sphere, centers[8].sphere, new THREE.Vector3(R * 1.5, -R * 1.2, -R * 1.5)));
    // 8 -> 9
    addPoints(createArc(centers[8].sphere, centers[9].sphere, new THREE.Vector3(-R * 1.8, 0, -R * 0.5)));
    // 9 -> 1
    addPoints(createArc(centers[9].sphere, centers[1].sphere, new THREE.Vector3(R * 1.6, 0, -R * 1.2)));

    return fullPath;

  }, [centers]);

  return (
    <EnergyTube points={pathPoints} visible={visible} morphState={morphState} isRunning={isRunning} />
  );
};

// 6. The Dots
const DotGroup = ({ points, morphVal, layerState }: { points: LoShuPointData[], morphVal: React.MutableRefObject<number>, layerState: LoShuLayerState }) => {
    const meshRefs = useRef<Record<string, THREE.Mesh>>({});

    useFrame(() => {
        const m = morphVal.current;
        points.forEach(pt => {
            const mesh = meshRefs.current[pt.id];
            if (mesh) {
                const cx = pt.planePos[0]; const cy = pt.planePos[1]; const cz = pt.planePos[2];
                const tx = pt.spherePos[0]; const ty = pt.spherePos[1]; const tz = pt.spherePos[2];
                
                mesh.position.set(cx + (tx - cx) * m, cy + (ty - cy) * m, cz + (tz - cz) * m);
                
                if (mesh.material && !Array.isArray(mesh.material)) {
                    (mesh.material as THREE.Material).opacity = layerState.dots ? 1 : 0;
                }
                mesh.visible = layerState.dots;
            }
        });
    });

    return (
        <group>
            {points.map(pt => (
                <mesh key={pt.id} ref={el => { if(el) meshRefs.current[pt.id] = el; }}>
                    <sphereGeometry args={[0.5, 32, 32]} />
                    <meshStandardMaterial 
                        color={pt.polarity === Polarity.YANG ? "#ffffff" : "#101010"}
                        emissive={pt.polarity === Polarity.YANG ? "#ffffff" : "#000000"}
                        emissiveIntensity={pt.polarity === Polarity.YANG ? 0.5 : 0}
                        transparent
                    />
                </mesh>
            ))}
        </group>
    );
};

// 7. The Labels
const LabelGroup = ({ centers, morphVal, layerState, morphState }: { centers: any, morphVal: React.MutableRefObject<number>, layerState: LoShuLayerState, morphState: LoShuMorphState }) => {
    return (
        <group>
            {Object.entries(centers).map(([key, data]: [string, any]) => (
                <SingleLabel 
                    key={key} 
                    num={parseInt(key)} 
                    data={data} 
                    morphVal={morphVal} 
                    layerState={layerState} 
                    morphState={morphState} 
                />
            ))}
        </group>
    );
};

const SingleLabel = ({ num, data, morphVal, layerState, morphState }: any) => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (groupRef.current) {
            const m = morphVal.current;
            const p = data.plane;
            const s = data.sphere;
            const dir = s.clone().normalize();
            const spherePos = dir.multiplyScalar(23);

            groupRef.current.position.set(
                p.x + (spherePos.x - p.x) * m,
                p.y + (spherePos.y - p.y) * m,
                p.z + (spherePos.z - p.z) * m
            );
        }
    });

    const showAny = layerState.numbers || layerState.trigrams || (layerState.directions && morphState !== LoShuMorphState.PLANE);
    if (!showAny) return null;

    return (
        <group ref={groupRef}>
            <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
                {(layerState.numbers || layerState.trigrams) && (
                    <group>
                        <mesh position={[0, 0, -0.5]}>
                            <circleGeometry args={[2.5, 32]} />
                            <meshBasicMaterial color="#000000" transparent opacity={0.5} blending={THREE.NormalBlending} depthWrite={false} />
                        </mesh>
                        <mesh position={[0, 0, -0.6]}>
                            <circleGeometry args={[2.8, 32]} />
                            <meshBasicMaterial color="#0891b2" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
                        </mesh>
                    </group>
                )}

                {layerState.numbers && (
                    <Text
                        position={[0, 0.5, 0]}
                        fontSize={4}
                        color="#fbbf24" // Gold
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0}
                    >
                        {num}
                    </Text>
                )}

                {layerState.trigrams && data.trigram && (
                    <>
                        {layerState.numbers && (
                             <mesh position={[0, -1.5, 0]}>
                                <planeGeometry args={[2.0, 0.05]} />
                                <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} />
                             </mesh>
                        )}
                        <Text
                            position={[0, layerState.numbers ? -2.4 : 0, 0]}
                            fontSize={1.4}
                            color="#67e8f9" // Cyan
                            anchorX="center"
                            anchorY="middle"
                        >
                            {data.trigram}
                        </Text>
                    </>
                )}

                {layerState.directions && data.direction && morphState !== LoShuMorphState.PLANE && (
                    <Text
                        position={[0, layerState.numbers ? -3.8 : -2.0, 0]}
                        fontSize={0.8}
                        color="#94a3b8"
                        anchorX="center"
                        anchorY="top"
                    >
                        {data.direction}
                    </Text>
                )}
            </Billboard>
        </group>
    );
};

// 8. Scene Rotator - MODIFIED: Rotates when `isSphereRotating` is true
const LoShuRotator = ({ isSphereRotating, children }: { isSphereRotating: boolean, children?: React.ReactNode }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((_, delta) => {
        if (groupRef.current && isSphereRotating) {
            // Increased speed from 0.1 to 0.3 based on user request
            groupRef.current.rotation.y -= delta * 0.3; 
        }
    });
    return <group ref={groupRef}>{children}</group>;
};

// 9. Camera Controller
const LoShuCameraController = ({ morphState }: { morphState: LoShuMorphState }) => {
    const { camera, controls } = useThree();
    
    useEffect(() => {
        let targetPos = new THREE.Vector3(0, 0, 50);
        let targetZoom = 10;
        
        if (morphState === LoShuMorphState.PLANE) {
             targetPos.set(0, 0, 60);
             targetZoom = 10;
        } else if (morphState === LoShuMorphState.SPHERE) {
             targetPos.set(40, 30, 40);
             targetZoom = 15;
        } else if (morphState === LoShuMorphState.PROJECTION) {
             targetPos.set(0, 0, 60);
             targetZoom = 25;
        }

        camera.position.copy(targetPos);
        camera.zoom = targetZoom;
        camera.lookAt(0,0,0);
        camera.updateProjectionMatrix();

        if (controls) {
            // @ts-ignore
            controls.target.set(0, 0, 0);
            // @ts-ignore
            controls.update();
        }
    }, [morphState, camera, controls]);

    return null;
};

// -----------------------------------------------------------------------------
// INTERNAL SCENE CONTENT COMPONENT
// -----------------------------------------------------------------------------
const SceneContent = ({ 
  morphState, 
  layerState, 
  isRunning, 
  isSphereRotating,
  points, 
  centers 
}: { 
  morphState: LoShuMorphState, 
  layerState: LoShuLayerState, 
  isRunning: boolean, 
  isSphereRotating: boolean,
  points: LoShuPointData[], 
  centers: any 
}) => {
  const morphVal = useRef(0);
  useFrame((_, delta) => {
     const target = (morphState === LoShuMorphState.SPHERE || morphState === LoShuMorphState.PROJECTION) ? 1 : 0;
     easing.damp(morphVal, 'current', target, 1.2, delta);
  });

  return (
    <>
      <PlanarDirectionLabels visible={morphState === LoShuMorphState.PLANE && layerState.directions} />

      <LoShuRotator isSphereRotating={isSphereRotating && morphState !== LoShuMorphState.PLANE}>
          {/* Main wireframe guide */}
          <SphereReferenceGuides visible={morphState !== LoShuMorphState.PLANE} />
          
          {/* Glass Energy Sphere - Allows seeing internal tubes (4-5-6) */}
          <GlassSphere visible={morphState === LoShuMorphState.SPHERE || morphState === LoShuMorphState.PROJECTION} />
          
          <DotGroup points={points} morphVal={morphVal} layerState={layerState} />
          
          {/* Volumetric Energy Tube (Electric Cyan Beam) */}
          <EnergySystem centers={centers} visible={layerState.lines} morphState={morphState} isRunning={isRunning} />
          
          <LabelGroup centers={centers} morphVal={morphVal} layerState={layerState} morphState={morphState} />
      </LoShuRotator>

      <LoShuCameraController morphState={morphState} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.05} enableZoom={true} enablePan={false} />
    </>
  );
};

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export const LoShuScene: React.FC<LoShuSceneProps> = ({ morphState, layerState, isRunning, isSphereRotating }) => {
  const points = useMemo(() => generateLoShuPoints(), []);
  const centers = useGroupCenters(points);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      orthographic
      camera={{ position: [0, 0, 50], zoom: 10 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <fog attach="fog" args={['#0f172a', 40, 150]} />
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[10, 20, 30]} intensity={1.5} color="#ffffff" />
      
      <SceneContent 
        morphState={morphState} 
        layerState={layerState} 
        isRunning={isRunning} 
        isSphereRotating={isSphereRotating}
        points={points} 
        centers={centers} 
      />
    </Canvas>
  );
};
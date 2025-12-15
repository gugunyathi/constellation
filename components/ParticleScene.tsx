import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Image as DreiImage, useCursor, useVideoTexture, Text } from '@react-three/drei';
import * as THREE from 'three';
import { generateParticles } from '../utils/shapes';
import { AppState, ShapeType, GestureData, MediaItem } from '../types';

interface ParticleSystemProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  handOpenness: React.MutableRefObject<number>;
  gestureData: React.MutableRefObject<GestureData>;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
}

interface GallerySystemProps extends ParticleSystemProps {
  controlsRef: React.MutableRefObject<any>;
}

// Add controlsRef to MusicInterface as well for disabling rotation during drag
interface MusicInterfaceProps extends ParticleSystemProps {
    controlsRef: React.MutableRefObject<any>;
}

// ----------------------------------------------------------------------
// VIDEO COMPONENT
// ----------------------------------------------------------------------
const VideoPlane = ({ url, opacity }: { url: string, opacity: number }) => {
  const texture = useVideoTexture(url, {
    muted: false,
    loop: true,
    start: true,
    crossOrigin: "Anonymous",
  });
  
  return (
    <mesh>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent opacity={opacity} />
    </mesh>
  );
};

// ----------------------------------------------------------------------
// MUSIC INTERFACE SYSTEM (3D BUTTONS & GESTURES)
// ----------------------------------------------------------------------
const MusicInterfaceSystem: React.FC<MusicInterfaceProps> = ({ appState, setAppState, gestureData, controlsRef }) => {
    const { isPlaying, currentTrackIndex, audioTracks } = appState;
    const groupRef = useRef<THREE.Group>(null);
    const cursorRef = useRef<THREE.Mesh>(null);
    
    // Drag & Interaction State
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef(new THREE.Vector3());
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);
    const wasPinching = useRef(false);

    // Helpers for raycasting
    const vec = useMemo(() => new THREE.Vector3(), []);
    const dir = useMemo(() => new THREE.Vector3(), []);
    const planeNormal = useMemo(() => new THREE.Vector3(0, 0, 1), []);
    const planePoint = useMemo(() => new THREE.Vector3(0, 0, 6), []); // Initial Z plane

    useFrame((state) => {
        if (!groupRef.current) return;
        
        const { isPinching, position } = gestureData.current;
        const currentZ = groupRef.current.position.z;
        planePoint.set(0, 0, currentZ);

        // 1. Calculate Cursor Position in 3D (Projected onto the plane of the controls)
        let ndcX, ndcY;
        
        if (appState.interactionMode === 'hand') {
            // Hand mode: use gestureData.position derived from MediaPipe
            ndcX = (position.x * 2) - 1;
            ndcY = -(position.y * 2) + 1;
        } else {
            // Mouse mode: use R3F pointer
            ndcX = state.pointer.x;
            ndcY = state.pointer.y;
        }

        // Unproject to find world direction
        vec.set(ndcX, ndcY, 0.5).unproject(state.camera);
        dir.copy(vec).sub(state.camera.position).normalize();
        
        // Ray-Plane Intersection: P = O + tD
        // t = (PlanePoint - CameraPos) . Normal / (Direction . Normal)
        const denom = dir.dot(planeNormal);
        let cursorPos = new THREE.Vector3();
        
        if (Math.abs(denom) > 0.0001) {
            const t = planePoint.clone().sub(state.camera.position).dot(planeNormal) / denom;
            cursorPos.copy(state.camera.position).add(dir.multiplyScalar(t));
        }

        // Update Visual Cursor (Only visible in Hand Mode)
        if (cursorRef.current) {
            cursorRef.current.position.copy(cursorPos);
            // Pulse color on pinch
            (cursorRef.current.material as THREE.MeshBasicMaterial).color.set(isPinching ? "#00ffff" : "#ffffff");
        }

        // 2. Interaction Logic
        // Calculate cursor position relative to the group (Local Space)
        const localCursor = cursorPos.clone().sub(groupRef.current.position);
        
        // Define Hit Zones (Local coords)
        const hitZones = [
            { id: 'prev', x: -3.5, y: 0, r: 1.5 },
            { id: 'play', x: 0, y: 0, r: 2.0 },
            { id: 'next', x: 3.5, y: 0, r: 1.5 }
        ];

        let foundHover = null;
        if (!isDragging) {
            for (const zone of hitZones) {
                const dx = localCursor.x - zone.x;
                const dy = localCursor.y - zone.y;
                if (Math.sqrt(dx*dx + dy*dy) < zone.r) {
                    foundHover = zone.id;
                    break;
                }
            }
        }
        setHoveredButton(foundHover);

        // Disable Orbit Controls if hovering UI or Dragging (Mouse or Hand)
        if (controlsRef.current) {
             const isInteracting = foundHover !== null || isDragging;
             // Only disable if using mouse to prevent orbit while clicking
             // For hand, orbit is manual via gesture so it matters less, but good practice
             controlsRef.current.enabled = !isInteracting;
        }

        // 3. State Machine: Click vs Drag
        if (isPinching && !wasPinching.current) {
            // PINCH START
            if (foundHover) {
                // Click Action
                handleButtonClick(foundHover);
            } else {
                // Start Dragging Group
                setIsDragging(true);
                dragOffset.current.copy(groupRef.current.position).sub(cursorPos);
            }
        } else if (!isPinching && wasPinching.current) {
            // PINCH END
            setIsDragging(false);
        }

        if (isDragging && isPinching) {
            // Update Position
            const newPos = cursorPos.clone().add(dragOffset.current);
            // Clamp Z to avoid flying too far (optional)
            // newPos.z = 6; 
            groupRef.current.position.copy(newPos);
        }

        wasPinching.current = isPinching;
    });

    const handleButtonClick = (id: string) => {
        if (id === 'play') {
            setAppState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
        } else if (id === 'next') {
            setAppState(prev => ({ 
                ...prev, 
                currentTrackIndex: (prev.currentTrackIndex + 1) % prev.audioTracks.length,
                isPlaying: true
            }));
        } else if (id === 'prev') {
            setAppState(prev => ({ 
                ...prev, 
                currentTrackIndex: (prev.currentTrackIndex - 1 + prev.audioTracks.length) % prev.audioTracks.length,
                isPlaying: true
            }));
        }
    };

    // Helper to create button
    const MusicButton = ({ position, text, id, size = 1, color = "#fff" }: any) => {
        const isHovered = hoveredButton === id;
        const scale = isHovered ? 1.2 : 1.0;
        
        return (
            <group position={position} scale={[scale, scale, scale]}>
                 <mesh visible={false}>
                     <planeGeometry args={[size * 1.5, size * 1.5]} />
                     <meshBasicMaterial />
                 </mesh>
                 <Text
                    font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                    fontSize={size}
                    color={isHovered ? "#00ffff" : color}
                    anchorX="center"
                    anchorY="middle"
                 >
                    {text}
                 </Text>
            </group>
        );
    };

    return (
        <>
            <group ref={groupRef} position={[0, -2, 6]}>
                {/* Play/Pause */}
                <MusicButton 
                    id="play"
                    position={[0, 0, 0]} 
                    text={isPlaying ? "❚❚" : "▶"} 
                    size={2.5}
                />
                
                {/* Prev */}
                <MusicButton 
                    id="prev"
                    position={[-3.5, 0, 0]} 
                    text="⏮" 
                    size={1.5}
                />

                {/* Next */}
                <MusicButton 
                    id="next"
                    position={[3.5, 0, 0]} 
                    text="⏭" 
                    size={1.5}
                />

                {/* Drag Handle Indicator (Subtle background pill) */}
                <mesh position={[0, 0, -0.5]}>
                    <planeGeometry args={[10, 4]} />
                    <meshBasicMaterial color="black" transparent opacity={isDragging ? 0.4 : 0.0} />
                </mesh>

                {/* Track Info Floating Text */}
                <Text
                    position={[0, -2, 0]}
                    fontSize={0.5}
                    color="#ffffff"
                    anchorX="center"
                    maxWidth={10}
                    textAlign="center"
                >
                    {audioTracks[currentTrackIndex]?.name || "No Track"}
                </Text>
            </group>

            {/* Virtual Cursor (Hand Mode Only) */}
            {appState.interactionMode === 'hand' && (
                <mesh ref={cursorRef}>
                    <sphereGeometry args={[0.2, 16, 16]} />
                    <meshBasicMaterial color="white" transparent opacity={0.6} depthTest={false} />
                </mesh>
            )}
        </>
    );
};

// ----------------------------------------------------------------------
// GALLERY SYSTEM (MEDIA ITEMS)
// ----------------------------------------------------------------------
const GallerySystem: React.FC<GallerySystemProps> = ({ appState, handOpenness, gestureData, controlsRef, analyserRef }) => {
  const { galleryItems, shape, speed, controlMode, isVisualizerActive } = appState;
  const [hovered, setHover] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  
  const rotationRef = useRef(new THREE.Euler(0, 0, 0));
  const velocityRef = useRef({ x: 0, y: 0 }); // Inertia
  
  // Audio Visualizer Data Storage
  const frequencyData = useRef(new Uint8Array(0));
  
  const TARGET_GALLERY_COUNT = 200;

  // Replicate items to fill the target count
  const { displayItems, count } = useMemo(() => {
    if (galleryItems.length === 0) return { displayItems: [], count: 0 };
    const totalCount = Math.max(galleryItems.length, TARGET_GALLERY_COUNT);
    const items = [];
    for (let i = 0; i < totalCount; i++) {
      items.push(galleryItems[i % galleryItems.length]);
    }
    return { displayItems: items, count: totalCount };
  }, [galleryItems]);

  useCursor(hovered !== null);

  // Generate base positions
  const basePositions = useMemo(() => {
    return generateParticles(shape, count);
  }, [count, shape]);

  // Store refs to the meshes
  const meshRefs = useRef<(THREE.Mesh | THREE.Group | null)[]>([]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = focused === null;
    }
  }, [focused, controlsRef]);

  useFrame((state, delta) => {
    // 0. Audio Visualizer Setup
    let audioBass = 0;
    let audioMid = 0;
    
    if (isVisualizerActive && analyserRef.current) {
        const analyser = analyserRef.current;
        if (frequencyData.current.length !== analyser.frequencyBinCount) {
             frequencyData.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(frequencyData.current);
        
        // Calculate basic bands (FFT size 256 -> 128 bins)
        // Bass: ~0-10 bins
        let bassSum = 0;
        for(let i=0; i<10; i++) bassSum += frequencyData.current[i];
        audioBass = (bassSum / 10) / 255; // 0.0 - 1.0

        // Mid/High
        let midSum = 0;
        for(let i=10; i<50; i++) midSum += frequencyData.current[i];
        audioMid = (midSum / 40) / 255; 
    }

    // 1. Gesture & Physics
    // If controlMode is music, we ignore gesture inputs for physics to prevent spinning while changing volume
    const isPhysicsActive = controlMode === 'particles';
    
    const { velocity, pinchDistance, rotation: gestureRot, isPinching } = gestureData.current;
    
    if (isPhysicsActive) {
        // Apply inertia from gesture velocity
        if (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001) {
           velocityRef.current.x += velocity.x * 0.02;
           velocityRef.current.y += velocity.y * 0.02;
        }
    }
    
    // Decay inertia
    velocityRef.current.x *= 0.95;
    velocityRef.current.y *= 0.95;

    // Apply rotation
    rotationRef.current.y += (speed * 0.1 + velocityRef.current.x * 2.5) * delta;
    rotationRef.current.x += (velocityRef.current.y * 2.5) * delta;
    
    // Add gesture tilt
    if (isPhysicsActive) {
        const currentTilt = rotationRef.current.z;
        rotationRef.current.z = THREE.MathUtils.lerp(currentTilt, gestureRot, 0.1);
    }

    // Expansion logic
    const openVal = handOpenness.current;
    let baseExpansion = 0.5 + (openVal * 2.0);
    
    // Visualizer Boost
    if (isVisualizerActive) {
        baseExpansion += (audioBass * 0.8); // Pulse expansion with bass
    }
    
    // Pinch gravity (attraction)
    const gravity = (isPinching && isPhysicsActive) ? (1.0 - pinchDistance) * 3 : 0; 
    const finalExpansion = Math.max(0.1, baseExpansion - gravity);

    // 2. Animate Items
    for (let i = 0; i < count; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];

      const ex = bx * finalExpansion;
      const ey = by * finalExpansion;
      const ez = bz * finalExpansion;

      // Apply Global Rotation Matrix
      const euler = rotationRef.current;
      const pos = new THREE.Vector3(ex, ey, ez);
      pos.applyEuler(euler);

      // Target Logic
      const isFocused = focused === i;
      const targetPos = new THREE.Vector3();
      const targetScale = new THREE.Vector3();
      const targetQuat = new THREE.Quaternion();

      if (isFocused) {
        const camDir = new THREE.Vector3();
        state.camera.getWorldDirection(camDir);
        
        targetPos.copy(state.camera.position).add(camDir.multiplyScalar(4));
        targetScale.set(4, 4, 4); 
        targetQuat.copy(state.camera.quaternion);
        
        // Mouse tilt parallax
        const mouseX = state.pointer.x;
        const mouseY = state.pointer.y;
        const tiltQ = new THREE.Quaternion();
        tiltQ.setFromEuler(new THREE.Euler(mouseY * 0.3, -mouseX * 0.3, 0));
        targetQuat.multiply(tiltQ);
      } else {
        targetPos.copy(pos);
        // Slightly zoom on hover (1.2x)
        let s = hovered === i ? 1.2 : 1.0;
        
        // Visualizer Scale Jitter
        if (isVisualizerActive && !hovered) {
             const noise = Math.sin(state.clock.elapsedTime * 10 + i) * audioMid;
             s += noise * 0.5;
        }

        targetScale.set(s, s, s);
        
        const dummy = new THREE.Object3D();
        dummy.position.copy(targetPos);
        dummy.lookAt(0, 0, 0); 
        targetQuat.copy(dummy.quaternion);
      }

      const lerpSpeed = isFocused ? 0.1 : 0.05;
      mesh.position.lerp(targetPos, lerpSpeed);
      mesh.scale.lerp(targetScale, lerpSpeed);
      mesh.quaternion.slerp(targetQuat, lerpSpeed);
      
      // Opacity handling
      mesh.traverse((child) => {
         if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            if (mat) {
               const targetOpacity = (focused !== null && !isFocused) ? 0.05 : 1.0;
               mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
               mat.transparent = true;
            }
         }
      });
    }
  });

  const handleClick = (index: number, e: any) => {
    e.stopPropagation();
    setFocused(focused === index ? null : index);
  };

  return (
    <group onClick={(e) => { e.stopPropagation(); setFocused(null); }}> 
      {displayItems.map((item, i) => {
         const isFocused = focused === i;
         const isVideo = item.type === 'video';
         
         const content = (isVideo && isFocused) 
            ? <VideoPlane url={item.url} opacity={1} />
            : <DreiImage
                url={isVideo && item.thumbnail ? item.thumbnail : item.url}
                transparent
                side={THREE.DoubleSide}
                opacity={1} // Managed by useFrame
              />;

         return (
           <group 
             key={`item-${i}-${item.id}`} 
             ref={(el) => (meshRefs.current[i] = el)}
             onClick={(e) => handleClick(i, e)}
             onPointerOver={(e) => { e.stopPropagation(); setHover(i); }}
             onPointerOut={(e) => setHover(null)}
           >
              {content}
           </group>
         );
      })}
    </group>
  );
};

// ----------------------------------------------------------------------
// PARTICLE SYSTEM (POINTS)
// ----------------------------------------------------------------------
const ParticleSystem: React.FC<ParticleSystemProps> = ({ appState, handOpenness, gestureData, analyserRef }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const { shape, particleCount, color, secondaryColor, speed, controlMode, isVisualizerActive, isPlaying } = appState;

  const targetPositions = useMemo(() => generateParticles(shape, particleCount), [shape, particleCount]);
  const currentPositions = useMemo(() => new Float32Array(particleCount * 3), [particleCount]);
  const frequencyData = useRef(new Uint8Array(0));

  const colors = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(secondaryColor);
    for (let i = 0; i < particleCount; i++) {
      const mixed = c1.clone().lerp(c2, Math.random());
      arr[i * 3] = mixed.r;
      arr[i * 3 + 1] = mixed.g;
      arr[i * 3 + 2] = mixed.b;
    }
    return arr;
  }, [particleCount, color, secondaryColor]);

  const rotationRef = useRef(new THREE.Euler(0, 0, 0));
  const velocityRef = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    
    // Audio Data Collection
    let audioBass = 0;
    const hasAudio = isVisualizerActive && analyserRef.current && isPlaying;
    let usingSimulation = false;

    if (hasAudio && analyserRef.current) {
        const analyser = analyserRef.current;
        if (frequencyData.current.length !== analyser.frequencyBinCount) {
             frequencyData.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(frequencyData.current);
        
        // Compute overall bass for generic pulse
        let bassSum = 0;
        for(let i=0; i<10; i++) bassSum += frequencyData.current[i];
        
        // Check if data is dead (all zeros) but we are playing
        // This indicates a CORS issue with remote audio
        // In this case, use Simulation Fallback
        const totalSum = frequencyData.current.reduce((a, b) => a + b, 0);
        if (bassSum === 0 && totalSum === 0) {
            usingSimulation = true;
            // Fake the bass for the pulse using sine wave
            audioBass = (Math.sin(state.clock.elapsedTime * 8) + 1) * 0.2;
        } else {
            audioBass = (bassSum / 10) / 255; 
        }
    }

    // Gesture Physics
    const isPhysicsActive = controlMode === 'particles';
    const { velocity, pinchDistance, rotation: gestureRot, isPinching } = gestureData.current;
    
    if (isPhysicsActive) {
        if (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001) {
           velocityRef.current.x += velocity.x * 0.02;
           velocityRef.current.y += velocity.y * 0.02;
        }
    }
    
    velocityRef.current.x *= 0.95;
    velocityRef.current.y *= 0.95;

    rotationRef.current.y += (delta * 0.1 * speed) + (velocityRef.current.x * 2.5 * delta);
    rotationRef.current.x += (velocityRef.current.y * 2.5) * delta;
    
    if (isPhysicsActive) {
        const currentTilt = rotationRef.current.z;
        rotationRef.current.z = THREE.MathUtils.lerp(currentTilt, gestureRot, 0.1);
    }

    pointsRef.current.rotation.copy(rotationRef.current);

    // Standard Particle Animation Vars
    const openVal = handOpenness.current;
    const smoothTime = 2.0 * delta; 
    let baseExpansion = 0.2 + (openVal * 2.8);
    if (isVisualizerActive) baseExpansion += (audioBass * 1.5);
    const gravity = (isPinching && isPhysicsActive) ? (1.0 - pinchDistance) * 5 : 0;
    const finalExpansion = Math.max(0.01, baseExpansion - gravity);
    
    // MUSIC PLAYER TEMPLATE SPECIFIC LOGIC
    const isMusicShape = shape === ShapeType.MUSIC_PLAYER;
    const numBars = 8; // Updated to 8
    const particlesPerBar = Math.floor(particleCount / numBars);

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const tx = targetPositions[i3];
      const ty = targetPositions[i3 + 1];
      const tz = targetPositions[i3 + 2];

      let cx = positions[i3];
      let cy = positions[i3 + 1];
      let cz = positions[i3 + 2];

      let targetX, targetY, targetZ;

      if (isMusicShape) {
         // Equalizer Logic
         targetX = tx; 
         targetZ = tz; 

         let eqScale = 0.1; 

         if (hasAudio) {
             const barIndex = Math.floor(i / particlesPerBar);
             if (barIndex < numBars) {
                 let audioLevel = 0;

                 if (usingSimulation) {
                     // Fallback Simulation for remote non-CORS tracks
                     const time = state.clock.elapsedTime;
                     // Create a wave that moves through the bars
                     const offset = barIndex * 0.5;
                     audioLevel = (Math.sin(time * 8 + offset) + 1) * 0.4;
                     // Add some high frequency jitter
                     audioLevel += Math.random() * 0.1;
                 } else {
                     // Real Frequency Data - BIN AVERAGING
                     // Map 8 bars to ~64 bins
                     const binsPerBar = 8; // 8 * 8 = 64
                     const startBin = barIndex * binsPerBar;
                     let sum = 0;
                     for(let k=0; k<binsPerBar; k++) {
                         sum += frequencyData.current[startBin + k] || 0;
                     }
                     audioLevel = (sum / binsPerBar) / 255.0;
                 }
                 
                 // Apply to scale: Base + Boost
                 eqScale = 0.1 + (audioLevel * 2.5);
             }
         }
         
         // Y Mapping: Scale up from bottom (-12) to match taller bars
         const baseY = -12;
         const relativeY = ty - baseY;
         targetY = baseY + (relativeY * eqScale);

      } else {
         // Standard Logic
         targetX = tx * finalExpansion;
         targetY = ty * finalExpansion;
         targetZ = tz * finalExpansion;
      }

      const time = state.clock.elapsedTime * speed;
      const noise = Math.sin(time + i) * 0.1 * finalExpansion;

      cx += (targetX + noise - cx) * smoothTime;
      cy += (targetY + noise - cy) * smoothTime;
      cz += (targetZ + noise - cz) * smoothTime;

      positions[i3] = cx;
      positions[i3 + 1] = cy;
      positions[i3 + 2] = cz;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} key={particleCount}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={currentPositions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={particleCount} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.15} vertexColors transparent opacity={0.8} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

// ----------------------------------------------------------------------
// MAIN SCENE
// ----------------------------------------------------------------------
const ParticleScene: React.FC<ParticleSystemProps> = ({ appState, setAppState, handOpenness, gestureData, analyserRef }) => {
  const controlsRef = useRef<any>(null);
  
  const hasItems = appState.galleryItems.length > 0;
  const showImages = hasItems && (appState.renderMode === 'images' || appState.renderMode === 'mixed');
  const showParticles = appState.renderMode === 'particles' || appState.renderMode === 'mixed';
  
  // Show music interface only if Music Player shape is active
  const showMusicInterface = appState.shape === ShapeType.MUSIC_PLAYER;

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 15], fov: 60 }} dpr={[1, 2]}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        {showMusicInterface && (
            <MusicInterfaceSystem 
                appState={appState}
                setAppState={setAppState}
                handOpenness={handOpenness}
                gestureData={gestureData}
                analyserRef={analyserRef}
                controlsRef={controlsRef}
            />
        )}

        {showImages && (
          <GallerySystem 
            appState={appState} 
            setAppState={setAppState}
            handOpenness={handOpenness} 
            gestureData={gestureData}
            controlsRef={controlsRef}
            analyserRef={analyserRef}
          />
        )}
        
        {showParticles && (
          <ParticleSystem 
            appState={appState} 
            setAppState={setAppState}
            handOpenness={handOpenness} 
            gestureData={gestureData}
            analyserRef={analyserRef}
          />
        )}

        <OrbitControls 
          ref={controlsRef}
          enablePan={false} 
          enableZoom={true} 
          maxDistance={40}
          minDistance={2}
          autoRotate={false} 
        />
      </Canvas>
    </div>
  );
};

export default ParticleScene;
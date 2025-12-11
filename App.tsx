
import React, { useState, useRef, useEffect } from 'react';
import ParticleScene from './components/ParticleScene';
import Controls from './components/Controls';
import HandTracker from './components/HandTracker';
import MusicPlayer from './components/MusicPlayer';
import { AppState, ShapeType, GestureData } from './types';

const App: React.FC = () => {
  // Initial State
  const [appState, setAppState] = useState<AppState>({
    shape: ShapeType.SPHERE,
    color: '#00ffff',
    secondaryColor: '#ff00ff',
    particleCount: 3000,
    speed: 1.0,
    interactionMode: 'mouse', // Default to mouse initially
    controlMode: 'particles', // Default to particle control
    galleryItems: [],
    renderMode: 'particles',
    
    // Music State
    audioTracks: [
      {
        id: 'demo-1',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        type: 'audio',
        name: 'Demo Track 1 (SoundHelix)'
      },
      {
        id: 'demo-2',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
        type: 'audio',
        name: 'Demo Track 2 (SoundHelix)'
      },
      {
        id: 'demo-3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
        type: 'audio',
        name: 'Demo Track 3 (SoundHelix)'
      }
    ],
    currentTrackIndex: 0,
    isPlaying: false, // Prevent autoplay error
    volume: 0.5,
    isVisualizerActive: false
  });

  // This ref is shared between the HandTracker (writer) and ParticleScene/MusicPlayer (readers)
  const handOpennessRef = useRef<number>(0.5);
  const gestureDataRef = useRef<GestureData>({
    velocity: { x: 0, y: 0 },
    pinchDistance: 0,
    rotation: 0,
    isPinching: false
  });

  // Shared Audio Analyzer Ref
  const analyserRef = useRef<AnalyserNode | null>(null);

  const handleHandUpdate = (isOpen: boolean, openness: number, gesture: GestureData) => {
    // Smooth smoothing
    handOpennessRef.current = handOpennessRef.current + (openness - handOpennessRef.current) * 0.1;
    gestureDataRef.current = gesture;
  };

  // Mouse fallback
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (appState.interactionMode === 'mouse') {
        const normalizedY = 1 - (e.clientY / window.innerHeight);
        handOpennessRef.current = normalizedY;

        // Calculate normalized velocity (-1 to 1)
        // Divide by window dimensions to match HandTracker normalized coords
        const vx = (e.clientX - lastX) / window.innerWidth;
        const vy = (e.clientY - lastY) / window.innerHeight;
        
        lastX = e.clientX;
        lastY = e.clientY;

        // Basic mouse gesture emulation
        gestureDataRef.current = {
            // Scale up slightly so mouse feels responsive
            velocity: { x: vx * 20, y: vy * 20 }, 
            rotation: (e.clientX / window.innerWidth - 0.5) * 1.0, // Tilt based on X position
            pinchDistance: e.buttons === 1 ? 0.0 : 1.0, // Click simulates pinch (0 distance)
            isPinching: e.buttons === 1
        };
      }
    };
    
    // Initialize last positions on first move
    const initMouse = (e: MouseEvent) => {
        lastX = e.clientX;
        lastY = e.clientY;
        window.removeEventListener('mousemove', initMouse);
    };
    window.addEventListener('mousemove', initMouse);
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [appState.interactionMode]);

  return (
    <div className="relative w-full h-full bg-black">
      <ParticleScene 
        appState={appState} 
        handOpenness={handOpennessRef} 
        gestureData={gestureDataRef}
        analyserRef={analyserRef}
      />
      
      <MusicPlayer 
         appState={appState}
         setAppState={setAppState}
         gestureDataRef={gestureDataRef}
         analyserRef={analyserRef}
      />

      <Controls appState={appState} setAppState={setAppState} />
      
      <HandTracker 
        isActive={appState.interactionMode === 'hand'} 
        onHandUpdate={handleHandUpdate} 
      />

      {/* Instructions Overlay if Hand Mode is active */}
      {appState.interactionMode === 'hand' && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 pointer-events-none text-white/50 text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm z-10 text-center">
            {appState.controlMode === 'particles' ? (
                <>
                    <p>Open hand to expand • Fist to contract</p>
                    <p className="text-xs mt-1 opacity-70">Swipe to spin • Pinch to attract • Tilt to rotate</p>
                </>
            ) : (
                <>
                    <p className="text-green-300">Music Mode Active</p>
                    <p className="text-xs mt-1 opacity-70">Swipe Up/Down: Volume • Swipe Side: Skip • Pinch: Play/Pause</p>
                </>
            )}
        </div>
      )}
    </div>
  );
};

export default App;

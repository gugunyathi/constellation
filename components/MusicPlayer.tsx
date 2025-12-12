
import React, { useEffect, useRef, useState } from 'react';
import { AppState, GestureData, ShapeType } from '../types';

interface MusicPlayerProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  gestureDataRef: React.MutableRefObject<GestureData>;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  handOpennessRef: React.MutableRefObject<number>;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ appState, setAppState, gestureDataRef, analyserRef, handOpennessRef }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { audioTracks, currentTrackIndex, isPlaying, volume, controlMode, interactionMode, shape } = appState;
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const currentTrack = audioTracks[currentTrackIndex];
  
  // Debounce refs for gesture control
  const lastActionTime = useRef<number>(0);
  const wasPinching = useRef<boolean>(false);
  const wasOpen = useRef<boolean>(true);

  // Initialize Audio Context and Analyser
  useEffect(() => {
    if (!audioRef.current || contextRef.current) return;

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256; 
        analyser.smoothingTimeConstant = 0.8;

        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        contextRef.current = ctx;
        sourceRef.current = source;
        analyserRef.current = analyser;
    } catch (e) {
        console.error("Audio Context Init Error:", e);
    }
  }, [analyserRef]);

  // Sync Audio Element with State
  useEffect(() => {
    if (!audioRef.current) return;
    
    // Volume
    audioRef.current.volume = volume;

    // Play/Pause
    if (isPlaying) {
      if (contextRef.current && contextRef.current.state === 'suspended') {
        contextRef.current.resume();
      }
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name === 'NotAllowedError') {
             console.log("Autoplay blocked by browser policy. Pausing.");
             setAppState(prev => ({ ...prev, isPlaying: false }));
          }
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, volume, currentTrack, setAppState]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (currentTrack) {
        audioRef.current.src = currentTrack.url;
        if (isPlaying) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    if (e.name === 'NotAllowedError') {
                         setAppState(prev => ({ ...prev, isPlaying: false }));
                    }
                });
            }
        }
    }
  }, [currentTrack]); 

  // Gesture Control Loop
  useEffect(() => {
    // Enable gestures if in Music Control Mode OR if using the Music Template
    const isMusicTemplate = shape === ShapeType.MUSIC_PLAYER;
    const isControlMode = controlMode === 'music';

    if ((!isMusicTemplate && !isControlMode) || interactionMode !== 'hand') return;

    let animationFrameId: number;

    const checkGestures = () => {
      const now = Date.now();
      const { velocity, isPinching, rotation } = gestureDataRef.current;
      const openness = handOpennessRef.current;
      const speedMag = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      
      // -----------------------------
      // 1. PINCH & THROW (Remove Song) - Specific to Music Template
      // -----------------------------
      if (isMusicTemplate && isPinching && speedMag > 1.5 && (now - lastActionTime.current > 1500)) {
           // Detected Throw
           setAppState(prev => {
               if (prev.audioTracks.length <= 1) return prev; // Don't remove last track
               
               const newTracks = prev.audioTracks.filter((_, i) => i !== prev.currentTrackIndex);
               const newIndex = prev.currentTrackIndex % newTracks.length;
               
               return {
                   ...prev,
                   audioTracks: newTracks,
                   currentTrackIndex: newIndex,
                   isPlaying: true
               };
           });
           lastActionTime.current = now;
           return; // Exit to prevent other triggers
      }

      // -----------------------------
      // 2. PLAY / PAUSE
      // -----------------------------
      if (isMusicTemplate) {
          // Open Palm (>0.8) -> Play
          if (openness > 0.8 && !isPlaying && (now - lastActionTime.current > 500)) {
              setAppState(prev => ({ ...prev, isPlaying: true }));
              lastActionTime.current = now;
          }
          // Fist (<0.2) -> Pause
          else if (openness < 0.2 && isPlaying && (now - lastActionTime.current > 500)) {
              setAppState(prev => ({ ...prev, isPlaying: false }));
              lastActionTime.current = now;
          }
      } else {
          // Standard Toggle (Control Mode)
          if (isPinching && !wasPinching.current && (now - lastActionTime.current > 1000)) {
            setAppState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
            lastActionTime.current = now;
          }
      }

      // -----------------------------
      // 3. SKIP / PREV (Horizontal Swipe)
      // -----------------------------
      if (now - lastActionTime.current > 800) {
        // Lower threshold for better sensitivity (0.6 -> 0.5)
        if (velocity.x > 0.5) {
           // Physical Swipe Right -> Next
           setAppState(prev => ({ 
               ...prev, 
               currentTrackIndex: (prev.currentTrackIndex + 1) % prev.audioTracks.length,
               isPlaying: true 
            }));
           lastActionTime.current = now;
        } else if (velocity.x < -0.5) {
           // Physical Swipe Left -> Prev
           setAppState(prev => ({ 
               ...prev, 
               currentTrackIndex: (prev.currentTrackIndex - 1 + prev.audioTracks.length) % prev.audioTracks.length,
               isPlaying: true
            }));
           lastActionTime.current = now;
        }
      }
      
      // -----------------------------
      // 4. SEEK / FF / RW (Twist)
      // -----------------------------
      if (isMusicTemplate && audioRef.current) {
         if (rotation > 0.6) {
             // Twist Right -> FF
             audioRef.current.currentTime += 0.2;
         } else if (rotation < -0.6) {
             // Twist Left -> RW
             audioRef.current.currentTime -= 0.2;
         }
      }
      
      // -----------------------------
      // 5. VOLUME (Vertical Swipe) - Only in Control Mode, not Template (conflicts with throw/general)
      // -----------------------------
      if (isControlMode && !isMusicTemplate) {
          if (Math.abs(velocity.y) > 0.2) { // Slightly higher threshold to prevent accidental volume change
             setAppState(prev => {
                 const change = velocity.y * 0.05; 
                 return { ...prev, volume: Math.max(0, Math.min(1, prev.volume + change)) };
             });
          }
      }

      wasPinching.current = isPinching;
      wasOpen.current = openness > 0.8;
      
      animationFrameId = requestAnimationFrame(checkGestures);
    };

    animationFrameId = requestAnimationFrame(checkGestures);
    return () => cancelAnimationFrame(animationFrameId);
  }, [controlMode, interactionMode, shape, isPlaying, setAppState]);

  const handleEnded = () => {
    setAppState(prev => {
        const newIndex = (prev.currentTrackIndex + 1) % prev.audioTracks.length;
        return { ...prev, currentTrackIndex: newIndex };
    });
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const target = e.target as HTMLAudioElement;
    console.error("Audio Error:", target.error?.code);
  };

  return (
    <audio 
        ref={audioRef} 
        onEnded={handleEnded}
        onError={handleError}
    />
  );
};

export default MusicPlayer;

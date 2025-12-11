
import React, { useEffect, useRef, useState } from 'react';
import { AppState, GestureData } from '../types';

interface MusicPlayerProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  gestureDataRef: React.MutableRefObject<GestureData>;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ appState, setAppState, gestureDataRef, analyserRef }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { audioTracks, currentTrackIndex, isPlaying, volume, controlMode, interactionMode } = appState;
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const currentTrack = audioTracks[currentTrackIndex];
  
  // Debounce refs for gesture control
  const lastActionTime = useRef<number>(0);
  const wasPinching = useRef<boolean>(false);

  // Initialize Audio Context and Analyser
  useEffect(() => {
    if (!audioRef.current || contextRef.current) return;

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256; // Defines data resolution. 128 bins.
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
    
    return () => {
        // Cleanup if necessary, though usually we want the context to persist
    };
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
             // Autoplay prevented. We revert state to "Paused" to keep UI in sync.
             console.log("Autoplay blocked by browser policy. Pausing.");
             setAppState(prev => ({ ...prev, isPlaying: false }));
          } else {
             // Silent catch for interruption errors
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
  }, [currentTrack]); // Only reload if track object changes

  // Gesture Control Loop
  useEffect(() => {
    if (controlMode !== 'music' || interactionMode !== 'hand') return;

    let animationFrameId: number;

    const checkGestures = () => {
      const now = Date.now();
      const { velocity, isPinching } = gestureDataRef.current;
      
      // 1. Play/Pause (Pinch Toggle)
      // Debounce pinch to avoid rapid toggling
      if (isPinching && !wasPinching.current && (now - lastActionTime.current > 1000)) {
        setAppState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
        lastActionTime.current = now;
      }
      wasPinching.current = isPinching;

      // 2. Volume Control (Vertical Swipe / Hand Height)
      // Using velocity Y to adjust volume smoothly
      if (Math.abs(velocity.y) > 0.1) {
         setAppState(prev => {
             const change = velocity.y * 0.05; // Sensitivity
             return { ...prev, volume: Math.max(0, Math.min(1, prev.volume + change)) };
         });
      }

      // 3. Skip / Prev (Horizontal Swipe)
      // High threshold for swipe to prevent accidental skips
      if (now - lastActionTime.current > 1000) {
        if (velocity.x > 0.8) {
           // Prev
           setAppState(prev => {
               const newIndex = (prev.currentTrackIndex - 1 + prev.audioTracks.length) % prev.audioTracks.length;
               return { ...prev, currentTrackIndex: newIndex, isPlaying: true };
           });
           lastActionTime.current = now;
        } else if (velocity.x < -0.8) {
           // Next
           setAppState(prev => {
               const newIndex = (prev.currentTrackIndex + 1) % prev.audioTracks.length;
               return { ...prev, currentTrackIndex: newIndex, isPlaying: true };
           });
           lastActionTime.current = now;
        }
      }

      animationFrameId = requestAnimationFrame(checkGestures);
    };

    animationFrameId = requestAnimationFrame(checkGestures);

    return () => cancelAnimationFrame(animationFrameId);
  }, [controlMode, interactionMode, setAppState]);

  const handleEnded = () => {
    // Auto play next
    setAppState(prev => {
        const newIndex = (prev.currentTrackIndex + 1) % prev.audioTracks.length;
        return { ...prev, currentTrackIndex: newIndex };
    });
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const target = e.target as HTMLAudioElement;
    console.error("Audio Error:", target.error?.code, target.error?.message);
    // Optionally try next track if one fails
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

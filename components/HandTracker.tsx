
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureData, HandTrackerProps } from '../types';

const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  
  // Track previous state for velocity calculation
  const prevHandCenter = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    const loadLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        landmarkerRef.current = landmarker;
        setLoaded(true);
      } catch (err) {
        console.error("Failed to load MediaPipe:", err);
      }
    };
    
    if (isActive) {
      loadLandmarker();
    }
    
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive]);

  useEffect(() => {
    if (!loaded || !isActive) return;

    const enableCam = async () => {
      if (!videoRef.current) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 240 } // Low res for performance
        });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      } catch (err) {
        console.error("Webcam access denied:", err);
      }
    };

    enableCam();

    let lastVideoTime = -1;
    const predictWebcam = () => {
      if (!landmarkerRef.current || !videoRef.current) return;
      
      const video = videoRef.current;
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const startTimeMs = performance.now();
        const results = landmarkerRef.current.detectForVideo(video, startTimeMs);
        
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Landmarks: 
          // 0: Wrist
          // 4: Thumb Tip
          // 8: Index Tip
          // 9: Middle MCP (Knuckle)
          // 12: Middle Tip
          
          const wrist = landmarks[0];
          const indexTip = landmarks[8];
          const thumbTip = landmarks[4];
          const middleTip = landmarks[12];
          const middleMCP = landmarks[9];
          
          // 1. Calculate Openness
          // Dist from wrist to tips
          const getDist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
          
          const distIndex = getDist(wrist, indexTip);
          const distMiddle = getDist(wrist, middleTip);
          const distThumb = getDist(wrist, thumbTip);
          const avgDist = (distIndex + distMiddle + distThumb) / 3;
          
          // Map average distance to 0-1 range (heuristic)
          let openness = (avgDist - 0.2) * 2.5;
          openness = Math.max(0, Math.min(1, openness));

          // 2. Calculate Pinch
          const pinchDist = getDist(thumbTip, indexTip);
          const isPinching = pinchDist < 0.05;

          // 3. Calculate Rotation (Roll)
          // Angle of vector from wrist to Middle MCP
          const dx = middleMCP.x - wrist.x;
          const dy = middleMCP.y - wrist.y;
          // Invert X because webcam is mirrored
          const rotation = Math.atan2(dy, -dx) - (Math.PI / 2); // Normalize so vertical is 0

          // 4. Calculate Velocity & Position
          // Center of palm approx
          const cx = (wrist.x + middleMCP.x) / 2;
          const cy = (wrist.y + middleMCP.y) / 2;
          
          let vx = 0;
          let vy = 0;
          
          if (prevHandCenter.current) {
              // Scale up velocity to match mouse-like magnitude
              // x is flipped for mirror effect
              vx = (prevHandCenter.current.x - cx) * 20; 
              vy = (prevHandCenter.current.y - cy) * 20;
          }
          prevHandCenter.current = { x: cx, y: cy };

          const gesture: GestureData = {
              velocity: { x: vx, y: vy },
              pinchDistance: pinchDist,
              rotation: rotation,
              isPinching: isPinching,
              position: { x: 1 - cx, y: cy } // Mirror X for screen coordinates (0-1)
          };
          
          onHandUpdate(openness > 0.3, openness, gesture);

        } else {
            // No hand detected
            onHandUpdate(false, 0.5, {
                velocity: { x: 0, y: 0 },
                pinchDistance: 1,
                rotation: 0,
                isPinching: false,
                position: { x: 0.5, y: 0.5 }
            });
            prevHandCenter.current = null;
        }
      }
      requestRef.current = requestAnimationFrame(predictWebcam);
    };

    return () => {
        if(videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [loaded, isActive, onHandUpdate]);

  if (!isActive) return null;

  return (
    <div className="absolute bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-50 bg-black">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        className="w-full h-full object-cover transform -scale-x-100" 
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white bg-black/80">
          Loading AI...
        </div>
      )}
    </div>
  );
};

export default HandTracker;
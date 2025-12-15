import * as THREE from 'three';
import { ShapeType } from '../types';

export const generateParticles = (type: ShapeType, count: number): Float32Array => {
  const positions = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    let x = 0, y = 0, z = 0;
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;

    switch (type) {
      case ShapeType.SPHERE: {
        const r = 4;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }
      
      case ShapeType.HEART: {
        // Heart curve 3D
        const t = Math.random() * Math.PI * 2;
        const u = Math.random() * Math.PI;
        // Basic heart approximation
        const r = 2.5; 
        // Based on a parametric heart formula
        x = r * 16 * Math.pow(Math.sin(t), 3);
        y = r * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        // Extrude slightly in Z for 3D volume
        z = (Math.random() - 0.5) * 4 * Math.sin(t); 
        break;
      }

      case ShapeType.FLOWER: {
        // Rose curve 3D
        const k = 4; // Petals
        const r = 5 * Math.cos(k * theta);
        x = r * Math.cos(theta);
        y = r * Math.sin(theta);
        z = (Math.random() - 0.5) * 2;
        // Warp slightly to look like a cup
        z += (Math.pow(r/5, 2)) * 2;
        break;
      }

      case ShapeType.SATURN: {
        const isRing = Math.random() > 0.4;
        if (isRing) {
          // Ring
          const angle = Math.random() * Math.PI * 2;
          const radius = 6 + Math.random() * 3;
          x = radius * Math.cos(angle);
          z = radius * Math.sin(angle);
          y = (Math.random() - 0.5) * 0.2;
        } else {
          // Planet
          const r = 3;
          x = r * Math.sin(phi) * Math.cos(theta);
          y = r * Math.sin(phi) * Math.sin(theta);
          z = r * Math.cos(phi);
        }
        // Tilt
        const tilt = 0.4;
        const tempY = y * Math.cos(tilt) - z * Math.sin(tilt);
        const tempZ = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = tempY;
        z = tempZ;
        break;
      }

      case ShapeType.BUDDHA: {
        // Simple stacked spheres approximation for a meditating figure
        const section = Math.random();
        
        if (section < 0.2) {
          // Head
          const r = 0.8;
          x = r * Math.sin(phi) * Math.cos(theta);
          y = 2.5 + r * Math.sin(phi) * Math.sin(theta);
          z = r * Math.cos(phi);
        } else if (section < 0.5) {
          // Body/Chest
          const r = 1.5; 
          // Scale sphere to be slightly wider
          x = r * 1.2 * Math.sin(phi) * Math.cos(theta);
          y = 1.0 + r * Math.sin(phi) * Math.sin(theta);
          z = r * 0.8 * Math.cos(phi);
        } else {
          // Base/Legs (Crossed) - represented as a flattened wide sphere/torus mix
          const angle = Math.random() * Math.PI * 2;
          const rad = 2.5 * Math.sqrt(Math.random());
          x = rad * Math.cos(angle);
          z = rad * Math.sin(angle);
          y = -1.5 + (Math.random() * 1.5);
          // Curve edges down
          y -= Math.pow(rad/3, 2);
        }
        break;
      }

      case ShapeType.SPIRAL: {
        const r = i / count * 8;
        const angle = i * 0.1;
        x = r * Math.cos(angle);
        y = (i / count - 0.5) * 10;
        z = r * Math.sin(angle);
        break;
      }

      case ShapeType.FIREWORKS: {
        // Explosion origin
        const r = Math.pow(Math.random(), 1/3) * 6;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }

      case ShapeType.GALLERY: {
        // A cloud of memories - spherical distribution but more spread out
        const r = 6 + Math.random() * 4;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
        break;
      }
      
      case ShapeType.MUSIC_PLAYER: {
        // Graphic Equalizer: 8 Bars (Updated)
        // We arrange particles into 8 vertical columns (bars)
        const numBars = 8;
        // Ensure even distribution
        const particlesPerBar = Math.floor(count / numBars);
        
        // Determine which bar this particle belongs to
        // We cluster them by index so they are contiguous in memory
        const barIndex = Math.floor(i / particlesPerBar);
        
        if (barIndex < numBars) {
            const particleInBarIndex = i % particlesPerBar;
            const normalizedHeight = particleInBarIndex / particlesPerBar; // 0.0 to 1.0
            
            // Layout: Line along X axis
            const spacing = 2.5; // Wider spacing for fewer bars
            const totalWidth = numBars * spacing;
            const startX = -totalWidth / 2;
            
            x = startX + (barIndex * spacing) + (spacing * 0.5);
            
            // Y: From bottom (-12) upwards (Height 24)
            const barHeight = 24; // 3x taller
            y = -12 + (normalizedHeight * barHeight);
            
            // Z: Give it some depth so it's a 3D bar, not a line
            z = (Math.random() - 0.5) * 2.0;
            
        } else {
            // Leftover particles (remainder) - put them in a cloud above
            x = (Math.random() - 0.5) * 20;
            y = 10 + Math.random() * 5;
            z = (Math.random() - 0.5) * 10;
        }
        break;
      }

      default:
        x = (Math.random() - 0.5) * 10;
        y = (Math.random() - 0.5) * 10;
        z = (Math.random() - 0.5) * 10;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
  }

  return positions;
};

export enum ShapeType {
  SPHERE = 'Sphere',
  HEART = 'Heart',
  FLOWER = 'Flower',
  SATURN = 'Saturn',
  BUDDHA = 'Buddha',
  SPIRAL = 'Spiral',
  FIREWORKS = 'Fireworks',
  GALLERY = 'Gallery',
  MUSIC_PLAYER = 'Music'
}

export type MediaType = 'image' | 'video' | 'audio';

export interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  thumbnail?: string; // Used for video preview or low-res placeholder
  name?: string;
  file?: File; // Keep reference if needed
}

export interface GestureData {
  velocity: { x: number, y: number };
  pinchDistance: number;
  rotation: number;
  isPinching: boolean;
  position: { x: number, y: number }; // Normalized 0-1 (Screen Coordinates)
}

export interface SensitivitySettings {
  movement: number;
  rotation: number;
  pinch: number;
}

export interface AppState {
  shape: ShapeType;
  color: string;
  secondaryColor: string;
  particleCount: number;
  speed: number;
  interactionMode: 'mouse' | 'hand';
  controlMode: 'particles' | 'music'; // New: Switch between particle and music control
  galleryItems: MediaItem[];
  renderMode: 'particles' | 'images' | 'mixed';
  
  // Music State
  audioTracks: MediaItem[];
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  isVisualizerActive: boolean; // Controls if particles react to audio
}

export interface HandData {
  isOpen: boolean;
  openness: number; // 0 to 1
  position: { x: number; y: number };
}

export interface ThemeResponse {
  shape: ShapeType;
  primaryColor: string;
  secondaryColor: string;
  speed: number;
  particleCount: number;
  reasoning: string;
}

export interface HandTrackerProps {
  onHandUpdate: (isOpen: boolean, openness: number, gesture: GestureData) => void;
  isActive: boolean;
}

export enum ShapeType {
  SPHERE = 'Sphere',
  HEART = 'Heart',
  FLOWER = 'Flower',
  SATURN = 'Saturn',
  BUDDHA = 'Buddha',
  SPIRAL = 'Spiral',
  FIREWORKS = 'Fireworks',
  GALLERY = 'Gallery'
}

export type MediaType = 'image' | 'video';

export interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  thumbnail?: string; // Used for video preview or low-res placeholder
  file?: File; // Keep reference if needed
}

export interface GestureData {
  velocity: { x: number, y: number };
  pinchDistance: number;
  rotation: number;
  isPinching: boolean;
}

export interface AppState {
  shape: ShapeType;
  color: string;
  secondaryColor: string;
  particleCount: number;
  speed: number;
  interactionMode: 'mouse' | 'hand';
  galleryItems: MediaItem[];
  renderMode: 'particles' | 'images' | 'mixed';
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

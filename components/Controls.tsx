
import React, { useState, useRef, useEffect } from 'react';
import { ShapeType, AppState, MediaItem } from '../types';
import { Camera, MousePointer2, Sparkles, Loader2, Palette, ImagePlus, Upload, MousePointerClick, Grid3X3, Images, Layers, FolderOpen, PlayCircle, Download, Music, Mic2, SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, Hand, Activity, ListMusic, X } from 'lucide-react';
import { generateThemeFromPrompt } from '../services/geminiService';
import { generateVideoThumbnail } from '../utils/media';

interface ControlsProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const Controls: React.FC<ControlsProps> = ({ appState, setAppState }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showPlaylist, setShowPlaylist] = useState(false);
  
  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleShapeChange = (shape: ShapeType) => {
    setAppState(prev => ({ ...prev, shape }));
  };

  const toggleMode = () => {
    setAppState(prev => ({
      ...prev,
      interactionMode: prev.interactionMode === 'mouse' ? 'hand' : 'mouse'
    }));
  };

  const toggleControlMode = () => {
    setAppState(prev => ({
        ...prev,
        controlMode: prev.controlMode === 'particles' ? 'music' : 'particles'
    }));
  };

  const cycleRenderMode = () => {
    setAppState(prev => {
        if (prev.renderMode === 'particles') return { ...prev, renderMode: 'images' };
        if (prev.renderMode === 'images') return { ...prev, renderMode: 'mixed' };
        return { ...prev, renderMode: 'particles' };
    });
  };

  const getRenderModeLabel = () => {
      switch(appState.renderMode) {
          case 'images': return 'Gallery Only';
          case 'mixed': return 'Mixed Mode';
          default: return 'Particles Only';
      }
  };

  const getRenderModeIcon = () => {
      switch(appState.renderMode) {
          case 'images': return <Images size={12}/>;
          case 'mixed': return <Layers size={12}/>;
          default: return <Grid3X3 size={12}/>;
      }
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessingMedia(true);
    const newItems: MediaItem[] = [];
    const MAX_FILES = 200; 
    
    const fileArray = Array.from(files).slice(0, MAX_FILES);

    for (const file of fileArray) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (isImage || isVideo) {
        const url = URL.createObjectURL(file);
        let thumbnail = undefined;

        if (isVideo) {
          try {
            thumbnail = await generateVideoThumbnail(file);
          } catch (e) {
            console.warn("Failed to generate thumb for", file.name);
          }
        }

        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          url,
          type: isVideo ? 'video' : 'image',
          thumbnail,
          file,
          name: file.name
        });
      }
    }

    setAppState(prev => ({
      ...prev,
      galleryItems: [...prev.galleryItems, ...newItems],
      renderMode: 'mixed', 
      shape: ShapeType.GALLERY
    }));
    
    setIsProcessingMedia(false);
  };

  const processAudioFiles = (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const newTracks: MediaItem[] = [];
      Array.from(files).forEach(file => {
          if (file.type.startsWith('audio/')) {
              newTracks.push({
                  id: `audio-${Date.now()}-${Math.random()}`,
                  url: URL.createObjectURL(file),
                  type: 'audio',
                  file,
                  name: file.name.replace(/\.[^/.]+$/, "") // Remove extension
              });
          }
      });

      setAppState(prev => ({
          ...prev,
          audioTracks: [...prev.audioTracks, ...newTracks],
          isPlaying: true, // Auto play on upload
          currentTrackIndex: prev.audioTracks.length // Start playing the first new track
      }));
  };

  const removeTrack = (index: number) => {
      setAppState(prev => {
          const newTracks = prev.audioTracks.filter((_, i) => i !== index);
          let newIndex = prev.currentTrackIndex;
          if (index < newIndex) newIndex--;
          if (newIndex >= newTracks.length) newIndex = 0;
          
          return {
              ...prev,
              audioTracks: newTracks,
              currentTrackIndex: newIndex,
              isPlaying: newTracks.length > 0 ? prev.isPlaying : false
          };
      });
  };

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setAiError('');
    
    try {
      const theme = await generateThemeFromPrompt(prompt);
      setAppState(prev => ({
        ...prev,
        shape: theme.shape,
        color: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        particleCount: Math.min(Math.max(theme.particleCount, 1000), 10000), // Clamp
        speed: theme.speed
      }));
    } catch (e) {
      setAiError('Failed to generate theme.');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentTrack = appState.audioTracks[appState.currentTrackIndex];

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-6">
      
      {/* Top Bar */}
      <div className="pointer-events-auto flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tighter drop-shadow-lg">Zen<span className="text-blue-400">Particles</span></h1>
          <p className="text-white/60 text-sm mt-1">Interactive 3D Generative Gallery</p>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            {/* Control Mode Switcher */}
            {appState.interactionMode === 'hand' && (
                <button
                onClick={toggleControlMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md transition-all border ${
                    appState.controlMode === 'music' 
                    ? 'bg-green-500/20 border-green-400 text-green-100' 
                    : 'bg-blue-500/20 border-blue-400 text-blue-100'
                }`}
                >
                {appState.controlMode === 'music' ? <Music size={18} /> : <Hand size={18} />}
                <span>{appState.controlMode === 'music' ? 'Music Gestures' : 'Particle Gestures'}</span>
                </button>
            )}

            <button
                onClick={toggleMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md transition-all border ${
                appState.interactionMode === 'hand' 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-100' 
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
            >
                {appState.interactionMode === 'hand' ? <Camera size={18} /> : <MousePointer2 size={18} />}
                <span>{appState.interactionMode === 'hand' ? 'Camera On' : 'Mouse On'}</span>
            </button>
          </div>

          {installPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md transition-all border bg-purple-600/80 border-purple-400 text-white hover:bg-purple-600"
            >
              <Download size={18} />
              <span>Install App</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="pointer-events-auto w-full max-w-sm bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-white shadow-2xl space-y-6 max-h-[80vh] overflow-y-auto">
        
        {/* Shape Selector */}
        <div>
          <label className="text-xs uppercase tracking-wider text-white/50 font-semibold mb-3 block">Templates</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.values(ShapeType).map((s) => (
              <button
                key={s}
                onClick={() => handleShapeChange(s)}
                className={`p-2 text-xs rounded-lg transition-all border ${
                  appState.shape === s
                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                    : 'bg-white/5 border-transparent hover:bg-white/10 text-white/70'
                }`}
              >
                {s === ShapeType.GALLERY ? 'Cloud' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Music Player Section */}
        <div className="border-t border-white/10 pt-4">
             <div className="flex items-center justify-between mb-3">
                 <label className="text-xs uppercase tracking-wider text-green-300/80 font-semibold flex items-center gap-2">
                   <Music size={14}/> Music Player
                 </label>
                 <button 
                   onClick={() => audioInputRef.current?.click()}
                   className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded border border-white/20 transition-colors"
                 >
                   + Add Songs
                 </button>
                 <input 
                   ref={audioInputRef} 
                   type="file" 
                   accept="audio/*" 
                   multiple 
                   className="hidden" 
                   onChange={(e) => processAudioFiles(e.target.files)}
                 />
             </div>

             {appState.audioTracks.length === 0 ? (
                 <div className="text-center p-4 border border-dashed border-white/10 rounded-lg text-white/30 text-xs">
                     No music loaded. Add audio files to play.
                 </div>
             ) : (
                 <div className="bg-black/30 rounded-lg p-3 space-y-3">
                    {/* Track Info */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded flex items-center justify-center relative overflow-hidden">
                            <Mic2 size={20} className="text-white/80 z-10" />
                            {appState.isVisualizerActive && appState.isPlaying && (
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            )}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <h3 className="text-sm font-medium truncate">{currentTrack?.name || 'Unknown Track'}</h3>
                            <p className="text-xs text-white/50">{appState.currentTrackIndex + 1} of {appState.audioTracks.length}</p>
                        </div>
                        
                        <button
                           onClick={() => setAppState(prev => ({...prev, isVisualizerActive: !prev.isVisualizerActive}))}
                           title="Toggle Visualizer"
                           className={`p-2 rounded-full transition-all ${
                               appState.isVisualizerActive 
                               ? 'bg-pink-500 text-white shadow-[0_0_10px_rgba(236,72,153,0.5)]' 
                               : 'bg-white/5 text-white/30 hover:bg-white/10'
                           }`}
                        >
                            <Activity size={16} />
                        </button>
                        
                        <button
                            onClick={() => setShowPlaylist(!showPlaylist)}
                            title="Playlist"
                            className={`p-2 rounded-full transition-all ${
                                showPlaylist
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/5 text-white/30 hover:bg-white/10'
                            }`}
                        >
                            <ListMusic size={16} />
                        </button>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        <button 
                          onClick={() => setAppState(prev => ({...prev, currentTrackIndex: (prev.currentTrackIndex - 1 + prev.audioTracks.length) % prev.audioTracks.length}))}
                          className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <SkipBack size={18} />
                        </button>
                        <button 
                           onClick={() => setAppState(prev => ({...prev, isPlaying: !prev.isPlaying}))}
                           className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform"
                        >
                            {appState.isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-0.5"/>}
                        </button>
                        <button 
                          onClick={() => setAppState(prev => ({...prev, currentTrackIndex: (prev.currentTrackIndex + 1) % prev.audioTracks.length}))}
                          className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <SkipForward size={18} />
                        </button>
                    </div>

                    {/* Volume */}
                    <div className="flex items-center gap-2">
                        {appState.volume === 0 ? <VolumeX size={14} className="text-white/50"/> : <Volume2 size={14} className="text-white/50"/>}
                        <input 
                           type="range" 
                           min="0" 
                           max="1" 
                           step="0.05" 
                           value={appState.volume}
                           onChange={(e) => setAppState(prev => ({...prev, volume: parseFloat(e.target.value)}))}
                           className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                        />
                    </div>
                    
                    {/* Playlist View */}
                    {showPlaylist && (
                        <div className="mt-2 bg-black/40 rounded border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                            {appState.audioTracks.map((track, idx) => (
                                <div 
                                    key={track.id}
                                    onClick={() => setAppState(prev => ({...prev, currentTrackIndex: idx, isPlaying: true}))}
                                    className={`flex items-center justify-between p-2 text-xs cursor-pointer hover:bg-white/5 ${
                                        idx === appState.currentTrackIndex ? 'bg-white/10 text-green-300' : 'text-white/60'
                                    }`}
                                >
                                    <span className="truncate flex-1 pr-2">
                                        {idx + 1}. {track.name}
                                    </span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removeTrack(idx); }}
                                        className="text-white/20 hover:text-red-400"
                                    >
                                        <X size={12}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
             )}
             
             {appState.controlMode === 'music' && (
                 <div className="mt-2 text-[10px] text-green-400/80 bg-green-900/20 p-2 rounded border border-green-500/20">
                     Gestures Active: Swipe Up/Down (Vol), Swipe Side (Skip), Pinch (Pause)
                 </div>
             )}
        </div>

        {/* Gallery Upload */}
        <div className="border-t border-white/10 pt-4">
           <div className="flex items-center justify-between mb-3">
             <label className="text-xs uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
               <ImagePlus size={14}/> Media Gallery
             </label>
             
             {appState.galleryItems.length > 0 && (
                <button 
                  onClick={cycleRenderMode}
                  className="flex items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded border border-white/20 transition-colors min-w-[100px] justify-center"
                >
                    {getRenderModeIcon()}
                    {getRenderModeLabel()}
                </button>
             )}
           </div>

           <div className="flex gap-2">
             <button 
               onClick={() => folderInputRef.current?.click()}
               disabled={isProcessingMedia}
               className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-400/30 rounded-lg p-3 text-sm text-blue-100 flex items-center justify-center gap-2 transition-colors"
             >
               {isProcessingMedia ? <Loader2 size={16} className="animate-spin"/> : <FolderOpen size={16} />}
               Connect Gallery
             </button>
             <button 
               onClick={() => fileInputRef.current?.click()}
               disabled={isProcessingMedia}
               className="bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg p-3 text-white/70 flex items-center justify-center transition-colors"
               title="Upload specific files"
             >
               <Upload size={16} />
             </button>
           </div>
           
           {/* Inputs */}
           <input 
             ref={fileInputRef}
             type="file" 
             multiple 
             accept="image/*,video/*"
             className="hidden" 
             onChange={(e) => processFiles(e.target.files)}
           />
           <input 
             ref={folderInputRef}
             type="file"
             // @ts-ignore - webkitdirectory is a non-standard attribute but standard in browsers
             webkitdirectory=""
             directory=""
             multiple
             className="hidden"
             onChange={(e) => processFiles(e.target.files)}
           />

           {appState.galleryItems.length > 0 && (
             <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
               <span>{appState.galleryItems.length} items loaded</span>
               {appState.galleryItems.some(i => i.type === 'video') && (
                 <span className="text-white/40 ml-1 flex items-center gap-0.5">• <PlayCircle size={10}/> Video support active</span>
               )}
             </div>
           )}
        </div>

        {/* Colors */}
        <div className="border-t border-white/10 pt-4">
          <label className="text-xs uppercase tracking-wider text-white/50 font-semibold mb-3 flex items-center gap-2">
            <Palette size={14}/> Colors
          </label>
          <div className="flex gap-4">
             <div className="flex-1">
                <input 
                  type="color" 
                  value={appState.color}
                  onChange={(e) => setAppState(prev => ({...prev, color: e.target.value}))}
                  className="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-white/20"
                />
             </div>
             <div className="flex-1">
                <input 
                  type="color" 
                  value={appState.secondaryColor}
                  onChange={(e) => setAppState(prev => ({...prev, secondaryColor: e.target.value}))}
                  className="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-white/20"
                />
             </div>
          </div>
        </div>

        {/* AI Generator */}
        <div className="border-t border-white/10 pt-4">
          <label className="text-xs uppercase tracking-wider text-purple-300/80 font-semibold mb-2 flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400"/> AI Theme Generator
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. 'Cyberpunk forest', 'Sad rain'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
              className="flex-1 bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button 
              onClick={handleAiGenerate}
              disabled={isGenerating || !prompt}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            </button>
          </div>
          {aiError && <p className="text-red-400 text-xs mt-2">{aiError}</p>}
        </div>

      </div>
    </div>
  );
};

export default Controls;


/**
 * Generates a thumbnail URL for a video file.
 * Catches the frame at 1.0 second.
 */
export const generateVideoThumbnail = async (videoFile: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 1.0; // Capture frame at 1 second

    const handleSeeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(video.src);
        resolve(thumbnailUrl);
      } else {
        resolve(''); // Fail gracefully
      }
      video.remove();
    };

    const handleError = () => {
      URL.revokeObjectURL(video.src);
      resolve('');
      video.remove();
    };

    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);
    
    // Trigger loading
    video.load();
  });
};

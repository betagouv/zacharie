import { create } from 'zustand';

interface State {
  videoUrl: string;
}

interface Action {
  setVideoUrl: (videoUrl: string) => void;
}

export const useVideo = create<State & Action>()((set): State & Action => ({
  videoUrl: '',
  setVideoUrl: (videoUrl: string) => set({ videoUrl }),
}));

export default function VideoOverlay() {
  const videoUrl = useVideo((state) => state.videoUrl);
  const setVideoUrl = useVideo((state) => state.setVideoUrl);
  const onClose = () => {
    setVideoUrl('');
  };
  return (
    <div
      className={[
        'fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 transition-opacity duration-250',
        videoUrl ? 'opacity-100' : 'invisible opacity-0',
      ].join(' ')}
      onClick={onClose}
    >
      <div className="relative aspect-video w-full max-w-xl">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={videoUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <button className="absolute top-4 right-4 text-2xl text-white hover:bg-transparent" onClick={onClose}>
        &#xd7;
      </button>
    </div>
  );
}

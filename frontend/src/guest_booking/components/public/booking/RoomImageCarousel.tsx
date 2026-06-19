import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Bed } from 'lucide-react';
import { cn } from '@/core/lib/utils';

interface RoomImageCarouselProps {
    photos: any[];
    videos?: any[];
    roomName: string;
    onClick: () => void;
}

export function RoomImageCarousel({ photos, videos, roomName, onClick }: RoomImageCarouselProps) {
    const [index, setIndex] = useState(0);
    const [failedIndexes, setFailedIndexes] = useState<Set<number>>(new Set());

    const handleError = (idx: number) => {
        setFailedIndexes(prev => new Set(prev).add(idx));
    };

    // Show photos first, then any video clips, as one swipeable media set.
    const media = [
        ...(photos || []).map((p) => ({ url: p.url, isVideo: false })),
        ...(videos || []).map((v) => ({ url: v.url, isVideo: true })),
    ];
    const validPhotos = media.filter((_, i) => !failedIndexes.has(i));

    if (media.length === 0 || (failedIndexes.size > 0 && validPhotos.length === 0)) {
        return (
            <div className="w-full h-full flex items-center justify-center flex-col text-slate-400 p-4 text-center cursor-pointer" onClick={onClick}>
                <Bed className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-xs">No Photos Available</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative overflow-hidden group">
            <AnimatePresence mode="wait">
                {media[index]?.isVideo ? (
                    <motion.video
                        key={index}
                        src={media[index].url}
                        controls
                        playsInline
                        preload="metadata"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="w-full h-full object-cover bg-black"
                        onClick={(e) => e.stopPropagation()}
                        onError={() => handleError(index)}
                    />
                ) : (
                    <motion.img
                        key={index}
                        src={media[index]?.url}
                        alt={roomName}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={onClick}
                        onError={() => handleError(index)}
                    />
                )}
            </AnimatePresence>

            {media.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIndex(prev => (prev - 1 + media.length) % media.length); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/20 hover:bg-black/40 p-1.5 rounded-full text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIndex(prev => (prev + 1) % media.length); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/20 hover:bg-black/40 p-1.5 rounded-full text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                        {media.map((_, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "h-1 rounded-full transition-all duration-300",
                                    idx === index ? "w-4 bg-white" : "w-1 bg-white/50"
                                )}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

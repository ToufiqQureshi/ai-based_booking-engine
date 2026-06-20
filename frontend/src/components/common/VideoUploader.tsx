import { useState, useRef, ChangeEvent } from 'react';
import { Upload, X, Loader2, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getImageUrl } from '@/core/lib/utils';
import { supabase } from '@/core/lib/supabase';

export interface MediaVideo {
    id?: string;
    url: string;
    type?: string;   // always "video" for these entries
    mime?: string;    // video/mp4 | video/webm
}

interface VideoUploaderProps {
    videos: MediaVideo[];
    onChange: (videos: MediaVideo[]) => void;
    /** Maximum number of videos allowed (room = 2, property = 5). */
    max?: number;
}

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB — must match backend MAX_VIDEO_SIZE
const ACCEPTED = ['video/mp4', 'video/webm'];

export function VideoUploader({ videos, onChange, max = 2 }: VideoUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = async (files: File[]) => {
        setError(null);
        const remaining = max - videos.length;
        if (remaining <= 0) {
            setError(`You can upload at most ${max} video${max > 1 ? 's' : ''}.`);
            return;
        }
        // Validate type + size up front; only take as many as we have room for.
        const valid: File[] = [];
        for (const f of files) {
            if (!ACCEPTED.includes(f.type)) {
                setError('Only MP4 or WebM videos are allowed.');
                continue;
            }
            if (f.size > MAX_VIDEO_SIZE) {
                setError(`${f.name} exceeds the 100MB limit.`);
                continue;
            }
            valid.push(f);
        }
        if (valid.length === 0) return;
        if (valid.length > remaining) {
            setError(`Only ${remaining} more video${remaining > 1 ? 's' : ''} allowed — extras were skipped.`);
            valid.length = remaining;
        }

        setUploading(true);
        const added: MediaVideo[] = [];
        for (const file of valid) {
            try {
                // Upload straight to Supabase Storage (not through the API). Videos
                // are far bigger than images; routing them through the backend hit
                // the 30s request timeout / gateway body limits, so uploads failed.
                // The hotel-assets bucket's RLS allows authenticated inserts, and
                // we force a video/* content-type so the public URL can never be
                // served as executable HTML.
                const ext = file.name.split('.').pop()?.toLowerCase() || (file.type === 'video/webm' ? 'webm' : 'mp4');
                const path = `videos/${crypto.randomUUID()}.${ext}`;
                const { error: upErr } = await supabase.storage
                    .from('hotel-assets')
                    .upload(path, file, { contentType: file.type, upsert: false });
                if (upErr) throw upErr;
                const { data: pub } = supabase.storage.from('hotel-assets').getPublicUrl(path);
                added.push({
                    id: Math.random().toString(36).slice(2, 11),
                    url: pub.publicUrl,
                    type: 'video',
                    mime: file.type,
                });
            } catch (err) {
                console.error('Video upload failed for', file.name, err);
                setError(`Upload failed for ${file.name}.`);
            }
        }
        onChange([...videos, ...added]);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await handleFiles(Array.from(e.target.files));
        }
    };

    const handleDelete = (index: number) => {
        const next = [...videos];
        next.splice(index, 1);
        onChange(next);
    };

    const atLimit = videos.length >= max;

    return (
        <div className="space-y-4">
            <div
                className={cn(
                    'border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors',
                    atLimit || uploading
                        ? 'opacity-50 cursor-not-allowed border-muted-foreground/25'
                        : 'cursor-pointer border-muted-foreground/25 hover:border-primary/50'
                )}
                onClick={() => !uploading && !atLimit && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="video/mp4,video/webm"
                    onChange={handleFileSelect}
                    disabled={uploading || atLimit}
                />
                {uploading ? (
                    <div className="flex flex-col items-center py-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-sm text-muted-foreground">Uploading video…</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-primary/10 p-3 rounded-full mb-3">
                            {atLimit ? <Film className="h-6 w-6 text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
                        </div>
                        <h3 className="font-semibold text-sm mb-1">
                            {atLimit ? `Maximum ${max} videos reached` : 'Click to upload a video'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            MP4 or WebM (max. 100MB) · up to {max} video{max > 1 ? 's' : ''}
                        </p>
                    </>
                )}
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            {videos.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {videos.map((video, index) => (
                        <div key={video.id || index} className="group relative border rounded-lg overflow-hidden bg-background">
                            <video
                                src={getImageUrl(video.url)}
                                className="w-full aspect-video object-cover bg-black"
                                controls
                                preload="metadata"
                            />
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDelete(index)}
                                title="Remove video"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                            <div className="p-2 bg-muted/30">
                                <span className="text-xs text-muted-foreground">Video {index + 1}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

import { useState, useRef, ChangeEvent } from 'react';
import { Upload, X, Star, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getImageUrl } from '@/core/lib/utils';
import { RoomPhoto } from '@/core/types/api';
import { apiClient } from '@/core/api/client';

interface RoomImageUploaderProps {
    images: RoomPhoto[];
    onChange: (images: RoomPhoto[]) => void;
}

export function RoomImageUploader({ images, onChange }: RoomImageUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await handleFiles(Array.from(e.target.files));
        }
    };

    const handleFiles = async (files: File[]) => {
        const MAX_SIZE = 5 * 1024 * 1024;
        const oversized = files.filter(f => f.size > MAX_SIZE);
        if (oversized.length > 0) {
            alert(`${oversized.map(f => f.name).join(', ')} exceed the 5MB limit.`);
            files = files.filter(f => f.size <= MAX_SIZE);
            if (files.length === 0) return;
        }

        setUploading(true);
        const newImages: RoomPhoto[] = [];

        for (const file of files) {
            try {
                const formData = new FormData();
                formData.append('file', file);

                // Real upload to backend
                const response = await apiClient.post<{ url: string }>('/upload', formData);

                newImages.push({
                    id: Math.random().toString(36).substr(2, 9),
                    url: response.url, // Persistent URL from backend (relative)
                    is_primary: images.length === 0 && newImages.length === 0,
                    order: images.length + newImages.length,
                });
            } catch (error) {
                console.error("Upload failed for file", file.name, error);
            }
        }

        onChange([...images, ...newImages]);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);

        // If we deleted the primary image, make the first one primary
        if (images[index].is_primary && newImages.length > 0) {
            newImages[0].is_primary = true;
        }

        onChange(newImages);
    };

    const handleSetPrimary = (index: number) => {
        const newImages = images.map((img, i) => ({
            ...img,
            is_primary: i === index
        }));
        onChange(newImages);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await handleFiles(Array.from(e.dataTransfer.files));
        }
    };

    // Simple reorder logic (move up/down)
    const moveImage = (index: number, direction: 'up' | 'down') => {
        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === images.length - 1)
        ) return;

        const newImages = [...images];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];

        // Update order property
        onChange(newImages.map((img, i) => ({ ...img, order: i })));
    };

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                className={cn(
                    "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                    isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50",
                    uploading && "opacity-50 cursor-not-allowed"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                />

                {uploading ? (
                    <div className="flex flex-col items-center py-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-sm text-muted-foreground">Uploading images...</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-primary/10 p-3 rounded-full mb-3">
                            <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm mb-1">Click to upload or drag and drop</h3>
                        <p className="text-xs text-muted-foreground">
                            SVG, PNG, JPG or GIF (max. 5MB)
                        </p>
                    </>
                )}
            </div>

            {/* Image Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {images.map((image, index) => (
                        <div key={index} className="group relative border rounded-lg overflow-hidden bg-background">
                            <div className="aspect-video relative">
                                <img
                                    src={getImageUrl(image.url)}
                                    alt={image.caption || `Room image ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />

                                {/* Overlay actions */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => moveImage(index, 'up')}
                                        disabled={index === 0}
                                        title="Move Left"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleDelete(index)}
                                        title="Remove"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => moveImage(index, 'down')}
                                        disabled={index === images.length - 1}
                                        title="Move Right"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Primary Badge */}
                                {image.is_primary && (
                                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-current" />
                                        Primary
                                    </div>
                                )}
                            </div>

                            {/* Footer actions */}
                            <div className="p-2 flex items-center justify-between bg-muted/30">
                                <span className="text-xs text-muted-foreground">Image {index + 1}</span>
                                {!image.is_primary && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => handleSetPrimary(index)}
                                    >
                                        Set as Primary
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

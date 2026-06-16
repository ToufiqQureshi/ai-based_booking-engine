
import React, { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/core/lib/utils';
import { apiClient } from '@/core/api/client';

interface ImageUploadProps {
    onUploadComplete: (url: string) => void;
    className?: string;
    existingImage?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
    onUploadComplete,
    className,
    existingImage
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(existingImage || null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    };

    const uploadFile = async (file: File) => {
        // Validate type
        if (!file.type.startsWith('image/')) {
            alert("Please upload an image file");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        // Preview immediately
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const interval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(interval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            const response = await apiClient.post<{ url: string }>('/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            clearInterval(interval);
            setUploadProgress(100);

            if (response && response.url) {
                onUploadComplete(response.url);
            }

        } catch (error) {
            console.error("Upload failed", error);
            alert("Upload failed. Please try again.");
            setPreview(null); // Reset on failure
        } finally {
            setIsUploading(false);
        }
    };

    const clearImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onUploadComplete(''); // Clear in parent
    };

    return (
        <div className={cn("w-full", className)}>
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-lg p-6 transition-colors text-center cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-2",
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
                    preview ? "border-solid border-border bg-muted/30" : ""
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !preview && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                />

                {preview ? (
                    <div className="relative w-full h-full min-h-[180px] flex items-center justify-center">
                        <img
                            src={preview}
                            alt="Preview"
                            className="max-h-[180px] rounded-md object-contain shadow-sm"
                        />
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-8 w-8 rounded-full shadow-md"
                            onClick={clearImage}
                            type="button"
                        >
                            <X className="h-4 w-4" />
                        </Button>

                        {isUploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md">
                                <div className="w-2/3 space-y-2 text-white text-center">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                                    <Progress value={uploadProgress} className="h-2 w-full" />
                                    <p className="text-xs font-medium">Uploading...</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="bg-primary/10 p-4 rounded-full mb-2">
                            <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                                Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground">
                                SVG, PNG, JPG or GIF (max 5MB)
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { Camera, Trash2, GripVertical, Upload, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { RoomPhoto } from '@/types/api';

interface PropertyGalleryProps {
  photos: RoomPhoto[];
  onChange: (photos: RoomPhoto[]) => void;
  onSave: (photos: RoomPhoto[]) => Promise<void>;
}

export function PropertyGallery({ photos, onChange, onSave }: PropertyGalleryProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const newPhotos = [...photos];

      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);

        const response = await apiClient.post<{ url: string }>('/upload', formData);
        
        newPhotos.push({
          id: Math.random().toString(36).substring(7),
          url: response.url,
          caption: '',
          is_primary: newPhotos.length === 0,
          order: newPhotos.length
        });
      }

      onChange(newPhotos);
      toast({
        title: "Photos Uploaded",
        description: `${files.length} photos added to gallery. Click save to finalize.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Could not upload one or more photos.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (id: string) => {
    const filtered = photos.filter(p => p.id !== id);
    // Reorder and ensure primary exists
    const reordered = filtered.map((p, i) => ({
      ...p,
      order: i,
      is_primary: i === 0 ? true : p.is_primary
    }));
    onChange(reordered);
  };

  const setPrimary = (id: string) => {
    const updated = photos.map(p => ({
      ...p,
      is_primary: p.id === id
    }));
    onChange(updated);
  };

  const updateCaption = (id: string, caption: string) => {
    const updated = photos.map(p => (p.id === id ? { ...p, caption } : p));
    onChange(updated);
  };

  const handleSaveInternal = async () => {
    try {
      setIsSaving(true);
      await onSave(photos);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Property Gallery</CardTitle>
            <CardDescription>Manage photos for your property display and banner</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="relative h-9 gap-2">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Add Photos
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleUpload}
                disabled={isUploading}
              />
            </Button>
            <Button onClick={handleSaveInternal} disabled={isSaving || isUploading} className="h-9 gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Gallery
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {photos.length === 0 ? (
          <div className="border-2 border-dashed rounded-2xl p-20 flex flex-col items-center justify-center text-center bg-slate-50/50">
            <div className="p-4 bg-white rounded-full shadow-sm mb-4">
              <Camera className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No photos yet</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-2">
              Upload high-quality images of your property to show guests what makes it special.
            </p>
            <Button variant="outline" className="mt-6 relative">
              Upload First Photo
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleUpload}
              />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {photos.sort((a, b) => a.order - b.order).map((photo) => (
              <div 
                key={photo.id} 
                className={`group relative rounded-2xl overflow-hidden bg-white border shadow-sm transition-all hover:shadow-md ${photo.is_primary ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                  <img 
                    src={photo.url} 
                    alt={photo.caption || 'Property'} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {photo.is_primary && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-primary text-white text-[10px] font-bold rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-wider z-10">
                      <ImageIcon className="w-3 h-3" />
                      Main Photo
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {!photo.is_primary && (
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 rounded-full shadow-lg"
                        onClick={() => setPrimary(photo.id!)}
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button 
                      size="icon" 
                      variant="destructive" 
                      className="h-8 w-8 rounded-full shadow-lg"
                      onClick={() => removePhoto(photo.id!)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 bg-white">
                  <Input 
                    placeholder="Add a caption..." 
                    value={photo.caption || ''} 
                    onChange={(e) => updateCaption(photo.id!, e.target.value)}
                    className="h-8 text-xs border-none bg-slate-50 focus-visible:ring-1 focus-visible:ring-slate-200"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

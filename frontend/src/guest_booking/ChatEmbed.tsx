import { useParams } from 'react-router-dom';
import { ChatWidget } from '@/guest_booking/components/public/ChatWidget';
import { useEffect, useState } from 'react';

export default function ChatEmbed() {
    const { hotelSlug } = useParams();
    const [config, setConfig] = useState<any>(null);

    // Fetch config for colors
    useEffect(() => {
        if (!hotelSlug) return;
        const getApiUrl = () => {
            const hostname = window.location.hostname;
            if (hostname.includes('staybooker.ai')) {
                return 'https://api.staybooker.ai/api/v1';
            }
            if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
            return 'https://ai-basedbooking-engine-production.up.railway.app/api/v1';
        };
        const apiUrl = getApiUrl();
        fetch(`${apiUrl}/public/hotels/slug/${hotelSlug}/widget-config`)
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(() => { /* Config load optional */ });
    }, [hotelSlug]);

    // Transparent Body for Iframe
    useEffect(() => {
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.backgroundColor = '';
            document.documentElement.style.backgroundColor = '';
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, []);

    return (
        <div className="h-screen w-screen bg-transparent pointer-events-none">
            {/* Wrapper div with pointer-events-none allows clicks to pass through the empty iframe space */}
            <div className="pointer-events-auto">
                <ChatWidget
                    hotelSlug={hotelSlug || ''}
                    primaryColor={config?.widget_primary_color || '#d11026'}
                />
            </div>
        </div>
    );
}

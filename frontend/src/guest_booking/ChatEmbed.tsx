import { useParams } from 'react-router-dom';
import { ChatWidget } from '@/guest_booking/components/public/ChatWidget';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/core/api/baseUrl';

export default function ChatEmbed() {
    const { hotelSlug } = useParams();
    const [config, setConfig] = useState<any>(null);

    // Fetch config for colors
    useEffect(() => {
        if (!hotelSlug) return;
        const apiUrl = getApiBaseUrl({ embedded: true });
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

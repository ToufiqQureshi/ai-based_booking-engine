import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface WelcomeCardProps {
    message: string;
}

export function WelcomeCard({ message }: WelcomeCardProps) {
    return (
        <Card className="bg-green-50 border-green-200 mt-4">
            <CardContent className="p-4 flex items-center gap-3">
                <div className="text-2xl">🚀</div>
                <div>
                    <h3 className="font-bold text-green-800">Status Update</h3>
                    <p className="text-green-700 font-medium">
                        {message}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

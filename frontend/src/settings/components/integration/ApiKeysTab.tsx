import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Copy, Key, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    is_active: boolean;
    request_count: number;
    created_at: string;
}

interface CreatedKey {
    secret_key: string;
}

interface ApiKeysTabProps {
    apiKeys: ApiKey[];
    onCreateKey: (name: string) => Promise<CreatedKey | void>;
    onDeleteKey: (id: string) => Promise<void>;
    copyToClipboard: (text: string) => void;
}

export const ApiKeysTab = ({ apiKeys, onCreateKey, onDeleteKey, copyToClipboard }: ApiKeysTabProps) => {
    const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!newKeyName.trim()) return;
        setIsCreating(true);
        try {
            const data = await onCreateKey(newKeyName);
            if (data) setCreatedKey(data);
            setNewKeyName('');
            setShowNewKeyDialog(false);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>API Keys</CardTitle>
                        <CardDescription>
                            Manage API keys for external integrations
                        </CardDescription>
                    </div>
                    <Button onClick={() => setShowNewKeyDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create API Key
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {createdKey && (
                    <Alert className="mb-4 border-green-500 bg-green-50">
                        <AlertDescription>
                            <div className="space-y-2">
                                <p className="font-semibold text-green-800">⚠️ Save this key now! It won't be shown again.</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-2 bg-background rounded border font-mono text-sm overflow-x-auto">
                                        {createdKey.secret_key}
                                    </code>
                                    <Button
                                        size="sm"
                                        onClick={() => copyToClipboard(createdKey.secret_key)}
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCreatedKey(null)}
                                >
                                    I've saved it
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {showNewKeyDialog && (
                    <div className="mb-4 p-4 border rounded-lg space-y-4 bg-muted/30">
                        <div>
                            <Label>Key Name</Label>
                            <Input
                                placeholder="e.g., Main Website, Mobile App"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCreate} disabled={isCreating}>
                                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Create
                            </Button>
                            <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {apiKeys.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            No API keys yet. Create one to get started.
                        </p>
                    ) : (
                        apiKeys.map((key) => (
                            <div
                                key={key.id}
                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/10 transition-colors"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">{key.name}</p>
                                        <Badge variant={key.is_active ? 'default' : 'secondary'}>
                                            {key.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground font-mono mt-1">
                                        {key.key_prefix}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Created: {new Date(key.created_at).toLocaleDateString('en-GB')} •
                                        Used: {key.request_count} times
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDeleteKey(key.id)}
                                >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

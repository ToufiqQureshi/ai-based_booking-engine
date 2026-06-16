import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, RefreshCw, Link2, ArrowRightLeft, Activity } from 'lucide-react';
import apiClient from '@/core/api/client';
import { useToast } from "@/components/ui/use-toast";
import { PageShell } from '@/components/layout/PageShell';

// Types
interface ChannelSettings {
    provider: string;
    provider_hotel_id: string | null;
    is_connected: boolean;
    sync_enabled: boolean;
}

interface RoomMapping {
    id: string;
    local_room_id: string;
    channel_name: string;
    ota_room_id: string;
}

interface ChannelLog {
    id: number;
    type: string;
    message: string;
    timestamp: string;
}

interface LocalRoom {
    id: string;
    name: string;
    // other fields omitted
}

export default function ChannelSettings() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [settings, setSettings] = useState<ChannelSettings | null>(null);
    const [localRooms, setLocalRooms] = useState<LocalRoom[]>([]);
    const [mappings, setMappings] = useState<RoomMapping[]>([]);
    const [logs, setLogs] = useState<ChannelLog[]>([]);

    // UI State
    const [hotelIdInput, setHotelIdInput] = useState('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    // Initial Data Fetch
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [settingsRes, roomsRes, mappingsRes, logsRes] = await Promise.all([
                apiClient.get<ChannelSettings>('/channel-manager/settings'),
                apiClient.get<LocalRoom[]>('/rooms'),
                apiClient.get<RoomMapping[]>('/channel-manager/mappings'),
                apiClient.get<ChannelLog[]>('/channel-manager/logs')
            ]);

            setSettings(settingsRes);
            setLocalRooms(roomsRes);
            setMappings(mappingsRes);
            setLogs(logsRes);
            if (settingsRes.provider_hotel_id) setHotelIdInput(settingsRes.provider_hotel_id);
            // We don't load API key back for security, or maybe we do if it's just a token? 
            // For now let's leave it blank to force re-entry or just show placeholder.
        } catch (error) {
            console.error('Failed to fetch channel data:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load channel settings." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnect = async () => {
        setIsSyncing(true);
        try {
            // 1. Save Credentials First (marked as not connected yet)
            await apiClient.put<ChannelSettings>('/channel-manager/settings', {
                provider_hotel_id: hotelIdInput,
                api_key: apiKeyInput,
                is_connected: false
            });

            // 2. Test Connection (Backend uses saved credentials)
            await apiClient.post('/channel-manager/test-connection');

            // 3. If Successful, mark as Connected
            const updated = await apiClient.put<ChannelSettings>('/channel-manager/settings', {
                is_connected: true
            });

            setSettings(updated);
            toast({ title: "Connected", description: "Successfully connected to Connectivity Gateway." });
            fetchData(); // Refresh logs
        } catch (error: any) {
            // Fix: apiClient throws Error object with message property
            const msg = error.message || "Could not verify connection.";
            toast({ variant: "destructive", title: "Connection Failed", description: msg });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            const updated = await apiClient.put<ChannelSettings>('/channel-manager/settings', {
                is_connected: false
            });
            setSettings(updated);
            toast({ title: "Disconnected", description: "Channel manager disabled." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to disconnect." });
        }
    };

    const handleSaveMapping = async (localRoomId: string, otaRoomId: string) => {
        try {
            await apiClient.post('/channel-manager/mappings', {
                local_room_id: localRoomId,
                channel_name: 'booking.com', // Default to B.com for now
                ota_room_id: otaRoomId
            });
            toast({ title: "Mapping Saved", description: "Room linked successfully." });
            // Refresh mappings
            const newMappings = await apiClient.get<RoomMapping[]>('/channel-manager/mappings');
            setMappings(newMappings);
        } catch (error) {
            toast({ variant: "destructive", title: "Save Failed", description: "Could not save mapping." });
        }
    };

    const getMappedOtaId = (localRoomId: string) => {
        const mapping = mappings.find(m => m.local_room_id === localRoomId);
        return mapping ? mapping.ota_room_id : '';
    };

    if (isLoading) {
        return <div className="p-10 text-center">Loading Channel Manager...</div>;
    }

    const isConnected = settings?.is_connected;

    const pageActions = isConnected ? (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            System Online
        </Badge>
    ) : null;

    return (
        <PageShell
            title="Channel Manager"
            subtitle="Connect and sync your inventory with OTAs (Booking.com, Airbnb, etc.)"
            actions={pageActions}
        >

            {/* Connection Status Card */}
            <Card className="border-l-4 border-l-primary">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-primary" />
                        Connectivity Gateway
                    </CardTitle>
                    <CardDescription>
                        We use a secure gateway to bridge your Staybooker data with external channels.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="font-medium text-foreground">
                            {isConnected ? 'Connected to Channex.io Gateway' : 'Gateway Disconnected'}
                        </span>
                    </div>
                    {!isConnected ? (
                        <div className="flex gap-2">
                            {/* Placeholder for future status check */}
                        </div>
                    ) : (
                        <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDisconnect}>
                            Disconnect
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Main Interface */}
            <Tabs defaultValue="settings" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="settings">Channel Config</TabsTrigger>
                    <TabsTrigger value="mapping" disabled={!isConnected}>Room Mapping</TabsTrigger>
                    <TabsTrigger value="logs" disabled={!isConnected}>Sync Logs</TabsTrigger>
                    <TabsTrigger value="guide">Integration Guide</TabsTrigger>
                </TabsList>

                {/* CHANNEL CONFIG / INSTRUCTIONS TAB */}
                <TabsContent value="settings" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Booking.com Guide */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg text-[#003580] flex items-center gap-2">
                                    Booking.com Integration
                                </CardTitle>
                                <CardDescription>Required from Hotelier</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <ol className="list-decimal list-inside space-y-2 text-foreground">
                                    <li>Log in to your <strong>Booking.com Extranet</strong>.</li>
                                    <li>Go to <strong>Account</strong> {'>'} <strong>Connectivity Provider</strong>.</li>
                                    <li>Search for <strong>"Channex"</strong> (our gateway).</li>
                                    <li>Copy your <strong>Hotel ID</strong> (LE number).</li>
                                </ol>
                                <div className="p-3 bg-muted/30 rounded border mt-4">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">Enter Hotel ID</label>
                                    <div className="flex flex-col gap-3 mt-1">
                                        <div>
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Hotel ID (Channex/OTA)</label>
                                            <Input
                                                placeholder="e.g. 1234567"
                                                value={hotelIdInput}
                                                onChange={(e) => setHotelIdInput(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Channex API Key</label>
                                            <Input
                                                type="password"
                                                placeholder="Paste key from Channex Profile"
                                                value={apiKeyInput}
                                                onChange={(e) => setApiKeyInput(e.target.value)}
                                            />
                                        </div>
                                        <Button size="sm" onClick={handleConnect} disabled={isSyncing} className="mt-2 w-full">
                                            {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
                                            {isSyncing ? "Verifying..." : "Verify & Connect"}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Airbnb/Other Guide */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg text-[#FF5A5F] flex items-center gap-2">
                                    Airbnb Integration
                                </CardTitle>
                                <CardDescription>Required from Hotelier</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <ol className="list-decimal list-inside space-y-2 text-foreground">
                                    <li>Log in to your <strong>Staybooker</strong> (this page).</li>
                                    <li>Click the button below to authorize.</li>
                                    <li>You will be redirected to Airbnb to approve access.</li>
                                    <li>Map your listings after approval.</li>
                                </ol>
                                <div className="p-3 bg-muted/30 rounded border mt-4">
                                    <Button className="w-full bg-[#FF5A5F] hover:bg-[#FF5A5F]/90">
                                        Login with Airbnb
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ROOM MAPPING TAB */}
                <TabsContent value="mapping" className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-800">How Mapping Works</AlertTitle>
                        <AlertDescription className="text-blue-700">
                            Match your local hotelier rooms with the room IDs found on the OTA channels.
                            Once mapped, availability updates will be sent automatically.
                        </AlertDescription>
                    </Alert>

                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Your Room (Staybooker)</TableHead>
                                    <TableHead className="w-[50px]"><ArrowRightLeft className="w-4 h-4 text-muted-foreground" /></TableHead>
                                    <TableHead>Channel Room ID (OTA)</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {localRooms.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                                            No local rooms found. Please create rooms first.
                                        </TableCell>
                                    </TableRow>
                                ) : localRooms.map((room) => (
                                    <TableRow key={room.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary">Room</Badge>
                                                {room.name}
                                            </div>
                                        </TableCell>
                                        <TableCell><ArrowRightLeft className="w-4 h-4 text-slate-300" /></TableCell>
                                        <TableCell>
                                            <Input
                                                className="max-w-[200px]"
                                                placeholder="Enter OTA Room ID"
                                                defaultValue={getMappedOtaId(room.id)}
                                                onBlur={(e) => {
                                                    if (e.target.value !== getMappedOtaId(room.id)) {
                                                        handleSaveMapping(room.id, e.target.value)
                                                    }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost">Saved</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* SYNC LOGS TAB */}
                <TabsContent value="logs">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Activity className="w-5 h-5" /> Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {logs.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-4">No activity logs found.</p>
                                ) : logs.map((log) => (
                                    <div key={log.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${log.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                {log.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{log.message}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline">{log.type.toUpperCase()}</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* INTEGRATION GUIDE TAB */}
                <TabsContent value="guide" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Channel Manager Integration Guide</CardTitle>
                            <CardDescription>
                                Step-by-step instructions to connect your Staybooker with OTAs via Channex.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* OVERVIEW */}
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Overview</h3>
                                <p className="text-muted-foreground text-sm">
                                    Staybooker integrates with <strong>Channex.io</strong> (Connectivity Provider) to sync your rooms, rates, and availability with major OTAs like Booking.com, Airbnb, Expedia, and Agoda.
                                </p>
                            </div>

                            <Separator />

                            {/* STEP 1 */}
                            <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                                <div className="font-semibold text-primary">Step 1: Connect</div>
                                <div className="space-y-2">
                                    <h4 className="font-medium text-foreground">Connect to the Gateway</h4>
                                    <ul className="list-disc list-outside ml-4 text-sm text-muted-foreground space-y-1">
                                        <li>Navigate to the <strong>Channel Config</strong> tab.</li>
                                        <li>Enter your <strong>Channex Hotel ID</strong>. (Contact support if you need one).</li>
                                        <li>Click <strong>Verify & Connect</strong>. The system will ping the gateway to confirm access.</li>
                                    </ul>
                                </div>
                            </div>

                            <Separator />

                            {/* STEP 2 */}
                            <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                                <div className="font-semibold text-primary">Step 2: Map Rooms</div>
                                <div className="space-y-2">
                                    <h4 className="font-medium text-foreground">Link Local Rooms to OTA Rooms</h4>
                                    <p className="text-sm text-muted-foreground">Once connected, you must tell the system which local room corresponds to which room on Booking.com.</p>
                                    <ul className="list-disc list-outside ml-4 text-sm text-muted-foreground space-y-1">
                                        <li>Go to the <strong>Room Mapping</strong> tab.</li>
                                        <li>Find your local room (e.g., "Deluxe King").</li>
                                        <li>Enter the <strong>OTA Room ID</strong> found in your Booking.com Extranet (e.g., <code>4216789</code>).</li>
                                        <li>Click away to auto-save. Repeat for all rooms.</li>
                                    </ul>
                                </div>
                            </div>

                            <Separator />

                            {/* TROUBLESHOOTING */}
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Troubleshooting</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc list-outside ml-4 mt-2 space-y-1 text-xs">
                                        <li><strong>401 Unauthorized:</strong> Your Hotel ID is invalid or the API key is missing.</li>
                                        <li><strong>404 Not Found:</strong> The Hotel ID or Room ID does not exist on the remote system.</li>
                                        <li><strong>Sync Logs:</strong> Check the "Sync Logs" tab for detailed error messages.</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </PageShell>
    );
}

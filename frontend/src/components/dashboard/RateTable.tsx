import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Infinity, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RateTableProps {
    data: any[];
    competitors: string[];
}

export function RateTable({ data, competitors }: RateTableProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="bg-primary/5">My Hotel</TableHead>
                        {competitors.map(comp => (
                            <TableHead key={comp}>{comp}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row) => (
                        <TableRow key={row.date}>
                            <TableCell className="font-medium">{row.date}</TableCell>

                            {/* My Hotel Cell */}
                            <TableCell className="bg-primary/5">
                                <div className="flex flex-col">
                                    <span className="font-bold">₹{row.my_rate.price}</span>
                                    <span className="text-xs text-muted-foreground">{row.my_rate.room_type}</span>
                                </div>
                            </TableCell>

                            {/* Competitor Cells */}
                            {competitors.map(compName => {
                                const compData = row.competitors[compName];

                                if (!compData) {
                                    return (
                                        <TableCell key={compName}>
                                            <span className="text-muted-foreground">-</span>
                                        </TableCell>
                                    );
                                }

                                return (
                                    <TableCell key={compName}>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                {compData.is_sold_out ? (
                                                    <Badge variant="destructive" className="px-1 py-0 text-[10px]">SOLD OUT</Badge>
                                                ) : (
                                                    <span className="font-bold">₹{compData.price}</span>
                                                )}
                                                <a
                                                    href={compData.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-muted-foreground hover:text-primary"
                                                    title="Verify on Website"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>

                                            {!compData.is_sold_out && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={compData.room_type}>
                                                        {compData.room_type}
                                                    </span>
                                                    {/* Source Badge (optional, visually noisy if text) */}
                                                    {/* <span className="text-[10px] bg-secondary px-1 rounded">{compData.source}</span> */}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { RateOption } from '@/types/api';

interface RateSelectDialogProps {
    isRateModalOpen: boolean;
    setIsRateModalOpen: (open: boolean) => void;
    selectedRateInfo: RateOption | null;
    defaultCancellationPolicy?: string | null;
}

export function RateSelectDialog({
    isRateModalOpen,
    setIsRateModalOpen,
    selectedRateInfo,
    defaultCancellationPolicy,
}: RateSelectDialogProps) {
    return (
        <Dialog open={isRateModalOpen} onOpenChange={setIsRateModalOpen}>
            <DialogContent className="bg-white rounded-2xl max-w-md p-6 border-slate-100 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-900">{selectedRateInfo?.name}</DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Rate plan details and policies.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    <div>
                        <h4 className="font-bold text-sm text-slate-800 mb-2">Inclusions</h4>
                        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                            {selectedRateInfo?.inclusions?.map((inc, idx) => (
                                <li key={idx}>{inc}</li>
                            )) || <li>Room Only</li>}
                        </ul>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
                        <strong>Cancellation Policy:</strong><br />
                        {selectedRateInfo?.cancellation_policy || defaultCancellationPolicy || "Standard cancellation policy applies."}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

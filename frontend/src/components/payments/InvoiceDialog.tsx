import { useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { format } from 'date-fns';

interface InvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payment: any; // Using any for flexibility with joined data
}

export function InvoiceDialog({ open, onOpenChange, payment }: InvoiceDialogProps) {
    const invoiceRef = useRef<HTMLDivElement>(null);

    if (!payment) return null;

    const handlePrint = () => {
        const content = invoiceRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${payment.booking_number}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #000; }
            .invoice-details { text-align: right; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 14px; text-transform: uppercase; color: #666; font-weight: 600; margin-bottom: 10px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th { text-align: left; background: #f9f9f9; padding: 10px; font-weight: 600; border-bottom: 1px solid #ddd; }
            .table td { padding: 10px; border-bottom: 1px solid #eee; }
            .total-row { font-weight: bold; font-size: 18px; }
            .footer { margin-top: 60px; text-align: center; color: #999; font-size: 12px; }
            .status-paid { color: #16a34a; border: 1px solid #16a34a; padding: 5px 10px; border-radius: 4px; display: inline-block; }
            .status-pending { color: #ea580c; border: 1px solid #ea580c; padding: 5px 10px; border-radius: 4px; display: inline-block; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Invoice Details</DialogTitle>
                </DialogHeader>

                {/* Invoice Preview */}
                <div className="border rounded-lg p-8 bg-background max-h-[60vh] overflow-y-auto" ref={invoiceRef}>
                    <div className="flex justify-between items-start border-b pb-6 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold">STAYBOOKER</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                123 Hospital Road<br />
                                Agra, UP 282001<br />
                                India
                            </p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-semibold mb-2">INVOICE</h2>
                            <div className={`text-sm font-medium uppercase px-3 py-1 rounded border inline-block ${payment.status === 'completed' ? 'text-green-600 border-green-200 bg-green-50' :
                                    payment.status === 'pending' ? 'text-orange-600 border-orange-200 bg-orange-50' : ''
                                }`}>
                                {payment.status}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bill To</h3>
                            <p className="font-medium">{payment.guest_name}</p>
                            <p className="text-sm text-muted-foreground">Booking Ref: {payment.booking_number}</p>
                        </div>
                        <div className="text-right">
                            <div className="flex justify-between mb-1">
                                <span className="text-sm text-muted-foreground">Invoice No:</span>
                                <span className="font-medium ml-4">INV-{payment.id.slice(0, 8).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm text-muted-foreground">Date:</span>
                                <span className="font-medium ml-4">{format(new Date(payment.created_at), 'dd MMM yyyy')}</span>
                            </div>
                        </div>
                    </div>

                    <table className="w-full text-sm mb-6">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left p-3 rounded-tl-md">Description</th>
                                <th className="text-right p-3 rounded-tr-md">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-3 border-b">Room Charges</td>
                                <td className="text-right p-3 border-b">{formatCurrency(payment.amount)}</td>
                            </tr>
                            {/* Tax placeholder for now */}
                            <tr>
                                <td className="p-3 border-b">Taxes & Fees (0%)</td>
                                <td className="text-right p-3 border-b">{formatCurrency(0)}</td>
                            </tr>
                            <tr className="font-bold text-lg">
                                <td className="p-3">Total</td>
                                <td className="text-right p-3">{formatCurrency(payment.amount)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="text-center text-xs text-muted-foreground mt-12 pt-4 border-t">
                        <p>Thank you for your business!</p>
                        <p>For any queries, please contact support@hotelierhub.com</p>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between">
                    <div className="text-xs text-muted-foreground self-center">
                        * This is a computer generated invoice.
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                        <Button onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

const RefundPolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <Card className="border shadow-lg bg-card text-card-foreground overflow-hidden">
          {/* Brand Header */}
          <div className="bg-primary/10 border-b p-8 sm:p-12 text-center">
            <RefreshCw className="w-16 h-16 text-primary mx-auto mb-4 animate-spin-slow" />
            <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">Refund & Cancellation Policy</h1>
            <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
          </div>

          <CardContent className="p-8 sm:p-12 space-y-8 text-base leading-relaxed">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">1. Guest Bookings (Hotel Reservations)</h2>
              <p>
                Staybooker provides the software and booking engine used by hotel properties. The specific cancellation and refund terms for any guest reservation are determined individually by the respective hotel property:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Standard Cancellation:</strong> Typically, reservations must be cancelled at least 24 to 72 hours prior to the scheduled check-in time to qualify for a full refund, depending on the hotel policy.</li>
                <li><strong className="text-foreground">Non-Refundable Rates:</strong> Bookings made under non-refundable, promo, or special deal rates are not eligible for refunds or modifications.</li>
                <li><strong className="text-foreground">No-Shows:</strong> If a guest fails to check in on the scheduled arrival date, the booking will be treated as a no-show, and no refund will be issued.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">2. Processing of Guest Refunds</h2>
              <p>
                When a cancellation is approved by the hotel property under their policy terms:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Refunds are processed back to the original payment method used at the time of booking.</li>
                <li>Approved refunds are typically processed by the payment gateway within <strong className="text-foreground">5 to 7 business days</strong>.</li>
                <li>Transaction convenience fees or payment gateway charges levied at the time of booking are generally non-refundable.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">3. Platform Subscription Refunds (For Hoteliers)</h2>
              <p>
                For hotel partners subscribing to Staybooker SaaS services (e.g. Pro or Enterprise plans):
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>All subscription plan payments are final and non-refundable.</li>
                <li>You can cancel your subscription at any time. Your access will remain active until the end of your current billing cycle, and no further renewals will be charged.</li>
                <li>Staybooker does not offer prorated refunds for partial months or unused credits (e.g. unused SMS or WhatsApp credits).</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">4. Technical Failures & Double Bookings</h2>
              <p>
                In the rare event of a system failure resulting in a double booking or incorrect billing where payment was debited but no room confirmation was generated:
              </p>
              <p className="text-muted-foreground">
                Please contact Staybooker support immediately. Upon verification of the system log, a full refund of the charged amount will be initiated.
              </p>
            </section>

            <section className="space-y-4 bg-muted/50 p-6 rounded-lg border">
              <h2 className="text-2xl font-bold mb-2">5. Contact Support</h2>
              <p>
                For guest booking refunds, please contact the hotel directly. For subscription billing queries or technical booking errors, contact us at:{' '}
                <a href="mailto:support@staybooker.ai" className="font-bold text-primary hover:underline">support@staybooker.ai</a>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RefundPolicy;

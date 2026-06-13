import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const TermsOfService = () => {
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
            <FileText className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">Terms of Service</h1>
            <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
          </div>

          <CardContent className="p-8 sm:p-12 space-y-8 text-base leading-relaxed">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Staybooker (by Revmerito), you accept and agree to be bound by the terms and provision of this agreement. 
                If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">2. Description of Service</h2>
              <p>
                Staybooker provides an AI-based booking engine for hotels. The service includes automated WhatsApp messaging, 
                booking management dashboards, and AI agents capable of answering guest inquiries.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">3. User Obligations</h2>
              <p>As a user of our service (Hotel Partner), you agree to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Accurate Information:</strong> Provide accurate and complete registration information.</li>
                <li><strong className="text-foreground">Security:</strong> Maintain the security of your password and identification.</li>
                <li><strong className="text-foreground">Responsibility:</strong> Be fully responsible for all use of your account and for any actions that take place using your account.</li>
                <li><strong className="text-foreground">Compliance:</strong> Comply with all applicable laws and regulations, including Meta's WhatsApp Business Terms of Service when using the integration.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">4. Service Modifications</h2>
              <p>
                Staybooker reserves the right at any time and from time to time to modify or discontinue, temporarily or permanently, 
                the Service (or any part thereof) with or without notice.
              </p>
            </section>

            <section className="space-y-4 bg-muted/50 p-6 rounded-lg border">
              <h2 className="text-2xl font-bold mb-2">5. Contact Information</h2>
              <p>
                For any questions regarding these Terms, please contact us at: <a href="mailto:tech.revmerito@gmail.com" className="font-bold text-primary hover:underline">tech.revmerito@gmail.com</a>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;

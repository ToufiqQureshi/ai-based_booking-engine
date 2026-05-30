import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-xl">
          <CardContent className="p-8 sm:p-12 prose prose-gray max-w-none">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-8">Terms of Service</h1>
            <p className="text-gray-500 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Staybooker (by Revmerito), you accept and agree to be bound by the terms and provision of this agreement. 
                If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold text-gray-900">2. Description of Service</h2>
              <p>
                Staybooker provides an AI-based booking engine for hotels. The service includes automated WhatsApp messaging, 
                booking management dashboards, and AI agents capable of answering guest inquiries.
              </p>
            </section>

            <section className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold text-gray-900">3. User Obligations</h2>
              <p>As a user of our service (Hotel Partner), you agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate and complete registration information.</li>
                <li>Maintain the security of your password and identification.</li>
                <li>Be fully responsible for all use of your account and for any actions that take place using your account.</li>
                <li>Comply with all applicable laws and regulations, including Meta's WhatsApp Business Terms of Service when using the integration.</li>
              </ul>
            </section>

            <section className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold text-gray-900">4. Service Modifications</h2>
              <p>
                Staybooker reserves the right at any time and from time to time to modify or discontinue, temporarily or permanently, 
                the Service (or any part thereof) with or without notice.
              </p>
            </section>

            <section className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold text-gray-900">5. Contact Information</h2>
              <p>
                For any questions regarding these Terms, please contact us at: <strong>tech.revmerito@gmail.com</strong>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;

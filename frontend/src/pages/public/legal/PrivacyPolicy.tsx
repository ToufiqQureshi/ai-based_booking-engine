import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-xl">
          <CardContent className="p-8 sm:p-12 prose prose-gray max-w-none">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-8">Privacy Policy</h1>
            <p className="text-gray-500 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">1. Introduction</h2>
              <p>
                Welcome to Staybooker (by Revmerito). We respect your privacy and are committed to protecting your personal data. 
                This Privacy Policy will inform you as to how we look after your personal data when you visit our website 
                and tell you about your privacy rights.
              </p>
            </section>

            <section className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold text-gray-900">2. Data We Collect</h2>
              <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
                <li><strong>Contact Data:</strong> includes email address and telephone numbers.</li>
                <li><strong>Technical Data:</strong> includes internet protocol (IP) address, browser type and version, time zone setting and location.</li>
                <li><strong>Usage Data:</strong> includes information about how you use our website, products and services.</li>
              </ul>
            </section>

            <section className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold text-gray-900">3. How We Use Your Data</h2>
              <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>To provide and maintain our service, including our AI-based hotel booking engine.</li>
                <li>To manage your account and provide customer support.</li>
                <li>To communicate with you about updates, offers, and promotions.</li>
                <li>To connect you with third-party services like Meta (WhatsApp) for automated messaging if you are a hotel partner.</li>
              </ul>
            </section>

            <section className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold text-gray-900">4. Third-Party Integrations</h2>
              <p>
                Our service integrates with third-party platforms such as Meta (Facebook/WhatsApp). When you connect your Staybooker 
                account to these services, we only request the permissions strictly necessary to operate the AI chat and booking features. 
                We do not sell your data to any third party.
              </p>
            </section>

            <section className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold text-gray-900">5. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, including any requests to exercise your legal rights, 
                please contact us at: <strong>tech.revmerito@gmail.com</strong>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

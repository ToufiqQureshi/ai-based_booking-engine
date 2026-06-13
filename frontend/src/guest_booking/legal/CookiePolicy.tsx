import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Cookie } from "lucide-react";
import { Link } from "react-router-dom";

const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <Card className="border shadow-lg bg-card text-card-foreground overflow-hidden">
          {/* Header */}
          <div className="bg-primary/5 border-b p-8 sm:p-12 text-center">
            <Cookie className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">Cookie Policy</h1>
            <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
          </div>

          <CardContent className="p-8 sm:p-12 space-y-8 text-base leading-relaxed">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">1. What Are Cookies</h2>
              <p>
                Cookies are small text files placed on your computer or mobile device by websites that you visit. 
                They are widely used to make websites work, or work more efficiently, as well as to provide info 
                to the owners of the site.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">2. How We Use Cookies</h2>
              <p>
                Staybooker uses cookies to enhance your dashboard browsing experience, secure authenticated sessions, 
                remember configuration settings, and power our hotel booking widgets. We classify our cookies as:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Essential Cookies:</strong> Crucial for account sign-ins, keeping your hotelier dashboard session secure, and preserving guest choices through the checkout funnel.
                </li>
                <li>
                  <strong className="text-foreground">Performance & Analytics:</strong> Help us monitor platform health, load times, and analyze usage to optimize features and speed.
                </li>
                <li>
                  <strong className="text-foreground">Integration Cookies:</strong> Power embedded chat widgets and third-party tools such as Stripe or Razorpay checkout secure payment components.
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">3. Third-Party Cookies</h2>
              <p>
                In addition to our own cookies, we work with trusted partners to run specific capabilities:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Meta / Facebook:</strong> Used when activating the automated AI Booking Agent via WhatsApp integrations to verify messaging widgets.
                </li>
                <li>
                  <strong className="text-foreground">Payment Gateways:</strong> Stripe/Razorpay set cookies to run secure transactions and identify/prevent fraud.
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold border-b pb-2">4. Managing Your Preferences</h2>
              <p>
                Most web browsers allow you to control cookies through their settings. You can choose to block, delete, 
                or disable cookies. However, please note that blocking essential cookies may impact dashboard functionality 
                and prevent our booking engine from operating correctly.
              </p>
            </section>

            <section className="space-y-4 bg-muted/50 p-6 rounded-lg border">
              <h2 className="text-2xl font-bold mb-2">5. Questions & Contact</h2>
              <p>
                If you have any questions about our use of cookies, please reach out to us at:{' '}
                <a href="mailto:support@staybooker.ai" className="font-bold text-primary hover:underline">support@staybooker.ai</a>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CookiePolicy;

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mail, Phone, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const ContactUs = () => {
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
            <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">Contact Us</h1>
            <p className="text-muted-foreground">We're here to help you manage your hotel bookings effortlessly.</p>
          </div>

          <CardContent className="p-8 sm:p-12 space-y-8 text-base leading-relaxed">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold border-b pb-2">Customer Support</h2>
                <p className="text-muted-foreground">
                  Have questions about Staybooker, billing, setup, or integration? Get in touch with our support team.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Mail className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">Email Support</h4>
                      <p className="text-sm text-muted-foreground">For general support and technical integration query:</p>
                      <a href="mailto:support@staybooker.ai" className="text-primary hover:underline font-medium">support@staybooker.ai</a>
                      <p className="text-xs text-muted-foreground mt-1">Escalations: <a href="mailto:tech.revmerito@gmail.com" className="text-primary hover:underline">tech.revmerito@gmail.com</a></p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Phone className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">Phone Support</h4>
                      <p className="text-sm text-muted-foreground">Speak with a hospitality specialist:</p>
                      <a href="tel:+919152012056" className="text-primary hover:underline font-medium">+91 91520 12056</a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-2xl font-bold border-b pb-2">Office Address</h2>
                <p className="text-muted-foreground">
                  Our corporate headquarters is located in Maharashtra, India.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">Revmerito Office</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        104, Sunrise Business Park, Road No. 16,<br />
                        Wagle Industrial Estate, Thane West,<br />
                        Maharashtra - 400604, India.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Clock className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground">Business Hours</h4>
                      <p className="text-sm text-muted-foreground">
                        Monday to Saturday: 10:00 AM – 7:00 PM (IST)<br />
                        Sunday: Closed
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 bg-muted/40 p-6 rounded-lg border">
              <h2 className="text-xl font-bold mb-2">Response Time Commitments</h2>
              <p className="text-sm text-muted-foreground">
                We value your time and aim to respond to all emails within <strong className="text-foreground">24 to 48 business hours</strong>. For urgent system issues or booking payment errors, please call us directly on our support hotline.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContactUs;

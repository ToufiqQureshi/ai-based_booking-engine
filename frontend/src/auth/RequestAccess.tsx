// Request Access Page — Staybooker
// Hotels must subscribe before getting access.
// This page provides simple contact information instead of a form.

import { Link } from 'react-router-dom';
import {
  Building2,
  Mail,
  Phone,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function RequestAccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">

        {/* Logo & Branding */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden shadow-md">
            <img src="/logo.png" alt="Staybooker Logo" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staybooker</h1>
          <p className="text-sm text-muted-foreground">
            Premium hotel management software
          </p>
        </div>

        {/* Contact Info Card */}
        <Card className="border-0 shadow-lg text-center">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Request Access</CardTitle>
            </div>
            <CardDescription>
              Staybooker is available exclusively via direct onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Mail className="h-5 w-5" />
                <a href="mailto:hello@staybooker.ai" className="font-medium hover:text-primary transition-colors">
                  hello@staybooker.ai
                </a>
              </div>
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5" />
                  <a href="tel:+918530494653" className="font-medium hover:text-primary transition-colors">
                    +91 85304 94653
                  </a>
                </div>
                <div className="flex items-center gap-3 pl-8">
                  <a href="tel:+917385552938" className="font-medium hover:text-primary transition-colors">
                    +91 73855 52938
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 border p-4 text-left text-xs text-muted-foreground w-full space-y-2">
              <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Onboarding Process
              </p>
              <p>1. Contact our team to schedule a demo</p>
              <p>2. We setup your tailored property profile</p>
              <p>3. You receive a secure login invitation</p>
              <p>4. 24/7 dedicated support is provided</p>
            </div>

            <div className="pt-2">
              <Link
                to="/login"
                className="text-sm text-primary hover:underline font-medium"
              >
                Already have an account? Sign in →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Footer */}
        <footer className="mt-4 text-center text-xs text-muted-foreground w-full max-w-md">
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mb-2">
            <Link to="/privacy-policy" className="hover:text-primary hover:underline transition-colors">Privacy Policy</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link to="/terms-of-service" className="hover:text-primary hover:underline transition-colors">Terms of Service</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link to="/contact-us" className="hover:text-primary hover:underline transition-colors">Contact Us</Link>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            © {new Date().getFullYear()} Staybooker by Revmerito. All rights reserved.
          </p>
        </footer>

      </div>
    </div>
  );
}

export default RequestAccessPage;

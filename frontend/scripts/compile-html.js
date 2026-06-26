import fs from 'fs';
import path from 'path';

const MARKETING_DIR = path.resolve(process.cwd(), 'marketing_html');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const LEGAL_OUT_DIR = path.resolve(process.cwd(), 'src/guest_booking/legal');
const LANDING_OUT = path.resolve(process.cwd(), 'src/guest_booking/LandingPage.tsx');

// Ensure output directories exist
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(LEGAL_OUT_DIR)) fs.mkdirSync(LEGAL_OUT_DIR, { recursive: true });

function htmlToJsx(html) {
    let jsx = html;
    jsx = jsx.replace(/class="/g, 'className="');
    jsx = jsx.replace(/for="/g, 'htmlFor="');
    jsx = jsx.replace(/stroke-width="/g, 'strokeWidth="');
    jsx = jsx.replace(/stroke-linecap="/g, 'strokeLinecap="');
    jsx = jsx.replace(/stroke-linejoin="/g, 'strokeLinejoin="');
    jsx = jsx.replace(/clip-rule="/g, 'clipRule="');
    jsx = jsx.replace(/fill-rule="/g, 'fillRule="');
    jsx = jsx.replace(/<!--[\s\S]*?-->/g, ''); // Remove HTML comments
    
    // Self-closing tags
    jsx = jsx.replace(/<img(.*?)>/g, (match) => {
        if (match.endsWith('/>')) return match;
        return match.replace(/>$/, ' />');
    });
    jsx = jsx.replace(/<input(.*?)>/g, (match) => {
        if (match.endsWith('/>')) return match;
        return match.replace(/>$/, ' />');
    });
    jsx = jsx.replace(/<hr(.*?)>/g, (match) => {
        if (match.endsWith('/>')) return match;
        return match.replace(/>$/, ' />');
    });
    jsx = jsx.replace(/<br(.*?)>/g, (match) => {
        if (match.endsWith('/>')) return match;
        return match.replace(/>$/, ' />');
    });

    return jsx;
}

// 1. Copy Header and Footer to public
function copyPublicHtml() {
    const files = ['header.html', 'footer.html'];
    files.forEach(file => {
        const srcPath = path.join(MARKETING_DIR, file);
        const destPath = path.join(PUBLIC_DIR, file);
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[HTML-to-TSX] Copied ${file} to public/`);
        }
    });
}

// 2. Convert Landing Page
function compileLandingPage() {
    const srcPath = path.join(MARKETING_DIR, 'index.html');
    if (!fs.existsSync(srcPath)) return;
    
    const content = fs.readFileSync(srcPath, 'utf-8');
    
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) return;
    let body = bodyMatch[1];
    
    let jsCode = '';
    const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = scriptRegex.exec(body)) !== null) {
        jsCode += match[1] + '\n';
    }
    
    body = body.replace(/<script>[\s\S]*?<\/script>/g, '');
    let jsx = htmlToJsx(body);
    
    jsx = jsx.replace(/<a href="(\/[\w-]+)"([^>]*)>([\s\S]*?)<\/a>/g, '<Link to="$1"$2>$3</Link>');
    jsx = jsx.replace(/termsandcondition\.html/g, '/terms-of-service');
    jsx = jsx.replace(/privacyandpolicy\.html/g, '/privacy-policy');
    jsx = jsx.replace(/refundandcancellation\.html/g, '/refund-cancellation');
    jsx = jsx.replace(/datadelelationrequest\.html/g, '/data-deletion');
    jsx = jsx.replace(/cookie\.html/g, '/cookie-policy');
    jsx = jsx.replace(/index\.html/g, '/');
    
    jsCode = jsCode.replace(/document\.addEventListener\('DOMContentLoaded',/g, 'setTimeout(');
    jsCode = jsCode.replace(/window\.addEventListener\('DOMContentLoaded',/g, 'setTimeout(');
    
    const twStart = jsCode.indexOf('tailwind.config = {');
    const twEnd = jsCode.indexOf('// Register GSAP plugins');
    if (twStart !== -1 && twEnd !== -1) {
        jsCode = jsCode.substring(0, twStart) + jsCode.substring(twEnd);
    }
    
    const componentCode = `// @ts-nocheck
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
    useEffect(() => {
${jsCode}
    }, []);

    return (
        <div className="landing-page-container">
            ${jsx}
        </div>
    );
}
`;

    fs.writeFileSync(LANDING_OUT, componentCode, 'utf-8');
    console.log(`[HTML-to-TSX] Generated LandingPage.tsx`);
}

// 3. Convert Legal Pages
function compileLegalPages() {
    const pageMap = {
        'privacyandpolicy.html': { compName: 'PrivacyPolicy', outName: 'PrivacyPolicy.tsx' },
        'termsandcondition.html': { compName: 'TermsOfService', outName: 'TermsOfService.tsx' },
        'cookie.html': { compName: 'CookiePolicy', outName: 'CookiePolicy.tsx' },
        'datadelelationrequest.html': { compName: 'DataDeletionRequest', outName: 'DataDeletionRequest.tsx' },
        'refundandcancellation.html': { compName: 'RefundCancellation', outName: 'RefundCancellation.tsx' }
    };
    
    for (const [htmlFile, config] of Object.entries(pageMap)) {
        const srcPath = path.join(MARKETING_DIR, htmlFile);
        if (!fs.existsSync(srcPath)) continue;
        
        let content = fs.readFileSync(srcPath, 'utf-8');
        let bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (!bodyMatch) continue;
        
        let body = bodyMatch[1];
        body = body.replace(/<script>[\s\S]*?<\/script>/g, '');
        
        let jsx = htmlToJsx(body);
        jsx = jsx.replace(/<a href="(\/[\w-]+)"([^>]*)>([\s\S]*?)<\/a>/g, '<Link to="$1"$2>$3</Link>');
        jsx = jsx.replace(/termsandcondition\.html/g, '/terms-of-service');
        jsx = jsx.replace(/privacyandpolicy\.html/g, '/privacy-policy');
        jsx = jsx.replace(/refundandcancellation\.html/g, '/refund-cancellation');
        jsx = jsx.replace(/datadelelationrequest\.html/g, '/data-deletion');
        jsx = jsx.replace(/cookie\.html/g, '/cookie-policy');
        jsx = jsx.replace(/index\.html/g, '/');
        
        const componentCode = `// @ts-nocheck
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function ${config.compName}() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="legal-page-container">
            ${jsx}
        </div>
    );
}
`;
        fs.writeFileSync(path.join(LEGAL_OUT_DIR, config.outName), componentCode, 'utf-8');
        console.log(`[HTML-to-TSX] Generated ${config.outName}`);
    }
}

copyPublicHtml();
compileLandingPage();
compileLegalPages();

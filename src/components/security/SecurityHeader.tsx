import { useEffect } from 'react';

// Security headers component to add CSP and other security measures
const SecurityHeader = () => {
  useEffect(() => {
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://njxxqdcwvehlvqufuyww.supabase.co wss://njxxqdcwvehlvqufuyww.supabase.co https://api.ipify.org https://ipapi.co https://ipinfo.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');

    // Add meta tag for CSP if not already present
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = csp;
      document.head.appendChild(meta);
    }

    // Add other security headers via meta tags
    const securityMetas = [
      { httpEquiv: 'X-Content-Type-Options', content: 'nosniff' },
      { httpEquiv: 'X-Frame-Options', content: 'DENY' },
      { httpEquiv: 'X-XSS-Protection', content: '1; mode=block' },
      { httpEquiv: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
      { httpEquiv: 'Permissions-Policy', content: 'geolocation=(), microphone=(), camera=()' }
    ];

    securityMetas.forEach(({ httpEquiv, content }) => {
      if (!document.querySelector(`meta[http-equiv="${httpEquiv}"]`)) {
        const meta = document.createElement('meta');
        meta.httpEquiv = httpEquiv;
        meta.content = content;
        document.head.appendChild(meta);
      }
    });

    // Disable console in production (basic protection)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};
    }

    // Basic XSS protection
    const originalDocumentWrite = document.write;
    document.write = function(content: string) {
      // Block potentially dangerous content
      if (content.includes('<script') || content.includes('javascript:')) {
        console.warn('Blocked potentially dangerous content');
        return;
      }
      originalDocumentWrite.call(document, content);
    };

    // Monitor for suspicious activity
    let suspiciousActivity = 0;
    
    const monitorSuspiciousActivity = () => {
      // Monitor for rapid-fire requests
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        suspiciousActivity++;
        
        // Reset counter after 1 minute
        setTimeout(() => suspiciousActivity--, 60000);
        
        // Alert if too many requests
        if (suspiciousActivity > 100) {
          console.warn('Suspicious activity detected - high request volume');
        }
        
        return originalFetch.apply(this, args);
      };
    };

    monitorSuspiciousActivity();

    // Cleanup
    return () => {
      // Reset overrides
      document.write = originalDocumentWrite;
    };
  }, []);

  return null; // This component doesn't render anything
};

export default SecurityHeader;
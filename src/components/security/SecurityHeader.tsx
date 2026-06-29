import { useEffect } from 'react';

// Security headers component to add CSP and other security measures
const SecurityHeader = () => {
  useEffect(() => {
    // Check if we're in preview environment and skip most security measures
    const isPreview = window.location.hostname.includes('lovableproject.com') || 
                      window.location.hostname.includes('lovable.app') ||
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
    
    // Skip security headers in preview to avoid blocking the iframe
    if (isPreview) {
      return;
    }
    
    // Content Security Policy - Only for production
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const allowedDomains = [
      'https://njxxqdcwvehlvqufuyww.supabase.co',
      'wss://njxxqdcwvehlvqufuyww.supabase.co'
    ];
    
    // Add production domain when deployed (mesma origem já coberta por 'self';
    // mantido explícito para o domínio oficial do app)
    if (!isDevelopment) {
      allowedDomains.push('https://app.coffeelier.com.br');
    }
    
    const csp = [
      "default-src 'self'",
      isDevelopment 
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" 
        : "script-src 'self'",
      isDevelopment 
        ? "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com" 
        : "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      `connect-src 'self' ${allowedDomains.join(' ')}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "media-src 'self'"
    ].join('; ');

    // Add meta tag for CSP if not already present
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = csp;
      document.head.appendChild(meta);
    }

    // Enhanced security headers
    const securityMetas = [
      { httpEquiv: 'X-Content-Type-Options', content: 'nosniff' },
      { httpEquiv: 'X-Frame-Options', content: 'DENY' },
      { httpEquiv: 'X-XSS-Protection', content: '1; mode=block' },
      { httpEquiv: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
      { httpEquiv: 'Permissions-Policy', content: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()' },
      { httpEquiv: 'Cross-Origin-Embedder-Policy', content: 'require-corp' },
      { httpEquiv: 'Cross-Origin-Opener-Policy', content: 'same-origin' },
      { httpEquiv: 'Cross-Origin-Resource-Policy', content: 'same-origin' }
    ];

    securityMetas.forEach(({ httpEquiv, content }) => {
      if (!document.querySelector(`meta[http-equiv="${httpEquiv}"]`)) {
        const meta = document.createElement('meta');
        meta.httpEquiv = httpEquiv;
        meta.content = content;
        document.head.appendChild(meta);
      }
    });

    // Enhanced production security
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      // Disable console to prevent information leakage
      const noop = () => {};
      console.log = noop;
      console.warn = noop;
      console.error = noop;
      console.info = noop;
      console.debug = noop;
      
      // Disable right-click context menu
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      
      // Disable F12 and other developer shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.shiftKey && e.key === 'C') ||
            (e.ctrlKey && e.key === 'U')) {
          e.preventDefault();
        }
      });
      
      // Clear sensitive data from memory periodically
      setInterval(() => {
        if (window.gc) {
          window.gc();
        }
      }, 300000); // Every 5 minutes
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
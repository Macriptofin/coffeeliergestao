import { useEffect } from 'react';

// Security headers component to add CSP and other security measures
const SecurityHeader = () => {
  useEffect(() => {
    // Content Security Policy - relaxed for preview/iframe, strict for standalone prod
    const host = window.location.hostname;
    const inIframe = window.top !== window.self;
    const isLocalDev = host === 'localhost' || host === '127.0.0.1';
    const isLovableHost = /\.lovable(app|dev)$/.test(host) || /\.lovableproject\.com$/.test(host);
    const isPreviewEnv = inIframe || isLocalDev || isLovableHost;

    const allowedDomains = [
      'https://njxxqdcwvehlvqufuyww.supabase.co',
      'wss://njxxqdcwvehlvqufuyww.supabase.co',
      'https://*.lovable.app',
      'https://*.lovable.dev'
    ];

    // Add production domain when deployed (standalone only)
    if (!isLocalDev && !isLovableHost && !inIframe) {
      allowedDomains.push('https://receita-maestro-digital.lovable.app');
    }

    // Frame ancestors: allow lovable preview when embedded, deny otherwise
    const frameAncestors = inIframe
      ? "frame-ancestors 'self' https://*.lovableproject.com https://*.lovable.app https://*.lovable.dev"
      : "frame-ancestors 'none'";

    const csp = isPreviewEnv
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          `connect-src 'self' ${allowedDomains.join(' ')}`,
          frameAncestors,
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
          "media-src 'self'"
        ].join('; ')
      : [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob:",
          `connect-src 'self' ${allowedDomains.join(' ')}`,
          frameAncestors,
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
          "media-src 'self'"
        ].join('; ');

    // Add meta tag for CSP (idempotent)
    const existingCsp = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement | null;
    if (existingCsp) {
      existingCsp.content = csp;
    } else {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = csp;
      document.head.appendChild(meta);
    }

    // Enhanced security headers (avoid breaking iframe previews)
    const securityMetas = [
      { httpEquiv: 'X-Content-Type-Options', content: 'nosniff' },
      // Only deny framing when we're not inside an iframe (standalone)
      ...(inIframe ? [] : [{ httpEquiv: 'X-Frame-Options', content: 'DENY' }]),
      { httpEquiv: 'X-XSS-Protection', content: '1; mode=block' },
      { httpEquiv: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
      { httpEquiv: 'Permissions-Policy', content: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()' },
      // COEP/COOP can break previews; only enable when not embedded
      ...(inIframe
        ? []
        : [
            { httpEquiv: 'Cross-Origin-Embedder-Policy', content: 'require-corp' },
            { httpEquiv: 'Cross-Origin-Opener-Policy', content: 'same-origin' },
            { httpEquiv: 'Cross-Origin-Resource-Policy', content: 'same-origin' },
          ]
      ),
    ];

    securityMetas.forEach(({ httpEquiv, content }) => {
      const sel = `meta[http-equiv="${httpEquiv}"]`;
      const el = document.querySelector(sel) as HTMLMetaElement | null;
      if (el) {
        el.content = content;
      } else {
        const meta = document.createElement('meta');
        meta.httpEquiv = httpEquiv;
        meta.content = content;
        document.head.appendChild(meta);
      }
    });

    // Enhanced production security (only when standalone)
    const isProdStandalone = !isPreviewEnv;
    if (isProdStandalone) {
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
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.shiftKey && e.key === 'C') ||
          (e.ctrlKey && e.key === 'U')
        ) {
          e.preventDefault();
        }
      });

      // Clear sensitive data from memory periodically
      const gcInterval = setInterval(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      }, 300000); // Every 5 minutes

      // Cleanup listeners/intervals when unmount
      return () => {
        clearInterval(gcInterval);
      };
    }

    // Basic XSS protection
    const originalDocumentWrite = document.write;
    document.write = function (content: string) {
      // Block potentially dangerous content
      if (content.includes('<script') || content.includes('javascript:')) {
        console.warn('Blocked potentially dangerous content');
        return;
      }
      originalDocumentWrite.call(document, content);
    } as any;

    // Monitor for suspicious activity
    let suspiciousActivity = 0;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      suspiciousActivity++;
      // Reset counter after 1 minute
      setTimeout(() => suspiciousActivity--, 60000);
      // Alert if too many requests
      if (suspiciousActivity > 100) {
        console.warn('Suspicious activity detected - high request volume');
      }
      return originalFetch.apply(this, args as any);
    } as any;

    // Cleanup
    return () => {
      // Reset overrides
      document.write = originalDocumentWrite;
      window.fetch = originalFetch as any;
    };
  }, []);

  return null; // This component doesn't render anything
};

export default SecurityHeader;
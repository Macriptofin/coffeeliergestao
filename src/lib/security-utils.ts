/**
 * Security utility functions for the application
 */

// Cache configuration for IP detection
const IP_CACHE_KEY = 'client_ip_cache';
const IP_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface IPCache {
  ip: string;
  timestamp: number;
}

/**
 * Attempts to get the client's real IP address from various sources
 * Enhanced for production environments with better detection methods
 * NOW WITH CACHING to prevent excessive HTTP requests
 */
export const getClientIP = async (): Promise<string> => {
  try {
    // Check cache first to avoid unnecessary HTTP requests
    const cachedIP = getIPFromCache();
    if (cachedIP) {
      return cachedIP;
    }

    let detectedIP: string | null = null;

    // Method 1: Check for forwarded headers (production environments)
    try {
      const forwardedIP = getIPFromHeaders();
      if (forwardedIP && !isPrivateIP(forwardedIP)) {
        detectedIP = forwardedIP;
      }
    } catch (error) {
      console.debug('Header IP detection failed:', error);
    }

    // Method 2: Try external IP services with enhanced error handling
    if (!detectedIP) {
      try {
        const externalIP = await getIPFromExternalService();
        if (externalIP && !isPrivateIP(externalIP)) {
          detectedIP = externalIP;
        }
      } catch (error) {
        console.debug('External IP service failed:', error);
      }
    }

    // Method 3: WebRTC as fallback (may be blocked in some environments)
    if (!detectedIP) {
      try {
        const rtcIP = await getIPFromWebRTC();
        if (rtcIP && !isPrivateIP(rtcIP)) {
          detectedIP = rtcIP;
        }
      } catch (error) {
        console.debug('WebRTC IP detection failed:', error);
      }
    }

    // Use detected IP or fallback
    const finalIP = detectedIP || (isProductionEnvironment() ? 'production-unknown' : '127.0.0.1');
    
    // Cache the result
    saveIPToCache(finalIP);
    
    return finalIP;
  } catch (error) {
    console.warn('All IP detection methods failed:', error);
    return 'unknown';
  }
};

/**
 * Get IP from cache if valid
 */
const getIPFromCache = (): string | null => {
  try {
    const cached = localStorage.getItem(IP_CACHE_KEY);
    if (!cached) return null;

    const cacheData: IPCache = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;

    // Return cached IP if less than 24 hours old
    if (age < IP_CACHE_DURATION) {
      console.debug('Using cached IP address:', cacheData.ip);
      return cacheData.ip;
    }

    // Cache expired, remove it
    localStorage.removeItem(IP_CACHE_KEY);
    return null;
  } catch (error) {
    console.debug('Cache read failed:', error);
    return null;
  }
};

/**
 * Save IP to cache
 */
const saveIPToCache = (ip: string): void => {
  try {
    const cacheData: IPCache = {
      ip,
      timestamp: Date.now()
    };
    localStorage.setItem(IP_CACHE_KEY, JSON.stringify(cacheData));
    console.debug('IP address cached:', ip);
  } catch (error) {
    console.debug('Cache write failed:', error);
  }
};

/**
 * Get IP address using WebRTC (may not work in all browsers/networks)
 */
const getIPFromWebRTC = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebRTC timeout')), 3000);
    
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      pc.createDataChannel('');
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/);
          
          if (ipMatch && ipMatch[1]) {
            const ip = ipMatch[1];
            // Filter out local/private IPs
            if (!isPrivateIP(ip)) {
              clearTimeout(timeout);
              pc.close();
              resolve(ip);
            }
          }
        }
      };
      
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(reject);
        
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
};

/**
 * Get IP address from request headers (production environments)
 */
const getIPFromHeaders = (): string | null => {
  // This would work in server-side environments or with proper proxy setup
  if (typeof window !== 'undefined') {
    // Client-side: Check for custom headers set by CDN/proxy
    const headerSources = [
      'x-forwarded-for',
      'x-real-ip', 
      'cf-connecting-ip', // Cloudflare
      'x-client-ip',
      'x-cluster-client-ip'
    ];
    
    // In production, these headers might be available through service worker or CDN integration
    // For now, return null as we can't access these directly in browser
    return null;
  }
  return null;
};

/**
 * Get IP address from external service (enhanced with more services and better error handling)
 */
const getIPFromExternalService = async (): Promise<string> => {
  const services = [
    { url: 'https://api64.ipify.org?format=json', key: 'ip' },
    { url: 'https://ipapi.co/json/', key: 'ip' },
    { url: 'https://api.ip.sb/jsonip', key: 'ip' },
    { url: 'https://httpbin.org/ip', key: 'origin' },
    { url: 'https://icanhazip.com', key: null } // Plain text response
  ];

  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(service.url, {
        signal: controller.signal,
        headers: { 
          'Accept': service.key ? 'application/json' : 'text/plain',
          'User-Agent': 'SecurityMonitoring/1.0'
        },
        mode: 'cors'
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        let ip: string;
        
        if (service.key) {
          const data = await response.json();
          ip = data[service.key];
        } else {
          ip = (await response.text()).trim();
        }
        
        if (ip && isValidIP(ip) && !isPrivateIP(ip)) {
          return ip;
        }
      }
    } catch (error) {
      console.debug(`IP service ${service.url} failed:`, error);
      continue;
    }
  }
  
  throw new Error('All external IP services failed');
};

/**
 * Get IP address from geolocation API (if available)
 */
const getIPFromGeolocation = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    const timeout = setTimeout(() => reject(new Error('Geolocation timeout')), 5000);
    
    // This is a fallback method - in practice, geolocation doesn't give IP
    // But we can use it to get location and then query IP services with better accuracy
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(timeout);
        try {
          // Use position to get more accurate IP from location-based service
          const response = await fetch(`https://ipapi.co/json/`);
          const data = await response.json();
          if (data.ip && !isPrivateIP(data.ip)) {
            resolve(data.ip);
          } else {
            reject(new Error('No valid IP from geolocation service'));
          }
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
      { timeout: 4000, enableHighAccuracy: false }
    );
  });
};

/**
 * Check if an IP address is private/local
 */
const isPrivateIP = (ip: string): boolean => {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];
  
  return privateRanges.some(range => range.test(ip));
};

/**
 * Generate a secure session token
 */
export const generateSecureToken = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Sanitize user input for logging (remove sensitive information)
 */
export const sanitizeForLogging = (input: any): any => {
  if (typeof input === 'string') {
    // Remove potential passwords, tokens, etc.
    return input.replace(/(password|token|key|secret|auth)[\s]*[=:]\s*[^\s]+/gi, '$1=***');
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      if (['password', 'token', 'secret', 'key', 'auth', 'authorization'].includes(key.toLowerCase())) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitizeForLogging(value);
      }
    }
    return sanitized;
  }
  
  return input;
};

/**
 * Validate that an action is being performed by an authenticated user
 */
export const validateAuthenticatedAction = (userId: string | null): boolean => {
  if (!userId) {
    console.warn('Attempted action without authentication');
    return false;
  }
  return true;
};

/**
 * Rate limiting utility - check if action should be blocked
 */
export const shouldRateLimit = (
  lastAttempt: Date | null,
  attemptCount: number,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): boolean => {
  if (!lastAttempt) return false;
  
  const now = new Date();
  const timeDiff = now.getTime() - lastAttempt.getTime();
  
  // Reset counter if window has passed
  if (timeDiff > windowMs) return false;
  
  // Block if too many attempts within window
  return attemptCount >= maxAttempts;
};

/**
 * Validate IP address format
 */
const isValidIP = (ip: string): boolean => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

/**
 * Detect if running in production environment
 */
const isProductionEnvironment = (): boolean => {
  return window.location.hostname !== 'localhost' && 
         window.location.hostname !== '127.0.0.1' &&
         !window.location.hostname.includes('lovable.app');
};

/**
 * Enhanced security pattern detection
 */
export const detectSecurityPatterns = (userAgent?: string, ipAddress?: string): {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  indicators: string[];
} => {
  const indicators: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Check for suspicious user agents
  if (userAgent) {
    const suspiciousPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /php/i,
      /sqlmap/i, /nmap/i, /nikto/i, /burp/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      indicators.push('Suspicious user agent detected');
      riskLevel = 'medium';
    }
  }

  // Check for suspicious IP patterns
  if (ipAddress) {
    // Known malicious IP ranges or patterns could be checked here
    if (ipAddress.startsWith('10.0.0.') || ipAddress === 'unknown') {
      indicators.push('Suspicious IP address pattern');
      const currentRiskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      riskLevel = currentRiskLevel as 'low' | 'medium' | 'high' | 'critical';
    }
  }

  // Check for high-risk time patterns (outside business hours)
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) {
    indicators.push('Access outside business hours');
    const currentRiskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    riskLevel = currentRiskLevel as 'low' | 'medium' | 'high' | 'critical';
  }

  return { riskLevel, indicators };
};

/**
 * Generate security event fingerprint for deduplication
 */
export const generateSecurityFingerprint = async (
  action: string,
  resourceType: string,
  userId?: string,
  ipAddress?: string
): Promise<string> => {
  const data = `${action}-${resourceType}-${userId || 'anonymous'}-${ipAddress || 'unknown'}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
};
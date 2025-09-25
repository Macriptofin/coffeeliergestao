/**
 * Security utility functions for the application
 */

/**
 * Attempts to get the client's real IP address from various sources
 * Falls back to localhost if unable to determine
 */
export const getClientIP = async (): Promise<string> => {
  try {
    // Method 1: Try to get IP from WebRTC (works in browsers)
    try {
      const rtcIP = await getIPFromWebRTC();
      if (rtcIP && rtcIP !== '127.0.0.1' && rtcIP !== 'unknown') {
        return rtcIP;
      }
    } catch (error) {
      console.debug('WebRTC IP detection failed:', error);
    }

    // Method 2: Try external IP services (with timeout)
    try {
      const externalIP = await getIPFromExternalService();
      if (externalIP && externalIP !== '127.0.0.1' && externalIP !== 'unknown') {
        return externalIP;
      }
    } catch (error) {
      console.debug('External IP service failed:', error);
    }

    // Method 3: Fallback to localhost (better than nothing for logging)
    return '127.0.0.1';
  } catch (error) {
    console.warn('All IP detection methods failed:', error);
    return 'unknown';
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
 * Get IP address from external service (with timeout and fallback)
 */
const getIPFromExternalService = async (): Promise<string> => {
  const services = [
    'https://api.ipify.org?format=json',
    'https://ipapi.co/json/',
    'https://httpbin.org/ip'
  ];

  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(service, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        let ip = data.ip || data.origin;
        
        if (ip && !isPrivateIP(ip)) {
          return ip;
        }
      }
    } catch (error) {
      console.debug(`IP service ${service} failed:`, error);
      continue;
    }
  }
  
  throw new Error('All external IP services failed');
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
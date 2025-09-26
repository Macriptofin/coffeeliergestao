// Utility to sanitize logs and prevent PII leakage

const PII_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Brazilian CPF (xxx.xxx.xxx-xx)
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  // Brazilian CNPJ (xx.xxx.xxx/xxxx-xx)
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
  // Phone numbers (various formats)
  /\b(?:\+55\s?)?(?:\(\d{2}\)\s?)?\d{4,5}-?\d{4}\b/g,
  // Credit card numbers (basic pattern)
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  // Brazilian RG patterns
  /\b\d{1,2}\.\d{3}\.\d{3}-?\d{1}\b/g,
];

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'session',
  'cookie',
  'cpf',
  'cnpj',
  'rg',
  'email',
  'phone',
  'telefone',
  'senha',
  'access_token',
  'refresh_token'
];

export function sanitizeForLogging(input: any): any {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeForLogging);
  }
  
  if (input && typeof input === 'object') {
    return sanitizeObject(input);
  }
  
  return input;
}

function sanitizeString(str: string): string {
  let sanitized = str;
  
  // Replace PII patterns
  PII_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[PII_REDACTED]');
  });
  
  return sanitized;
}

function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive information
    const isSensitive = SENSITIVE_KEYS.some(sensitive => 
      lowerKey.includes(sensitive)
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeForLogging(value);
    }
  }
  
  return sanitized;
}

// Create a secure console wrapper for production
export function createSecureLogger() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    log: (message: string, data?: any) => {
      if (isDevelopment) {
        console.log(message, data ? sanitizeForLogging(data) : '');
      }
    },
    
    warn: (message: string, data?: any) => {
      if (isDevelopment) {
        console.warn(message, data ? sanitizeForLogging(data) : '');
      }
    },
    
    error: (message: string, error?: any) => {
      // Always log errors but sanitize them
      const sanitizedError = error ? {
        message: error.message || 'Unknown error',
        name: error.name,
        // Don't include stack traces in production logs
        ...(isDevelopment && { stack: error.stack })
      } : undefined;
      
      if (isDevelopment) {
        console.error(message, sanitizedError);
      } else {
        // In production, only log critical errors to a secure endpoint
        // This would typically be sent to a logging service
        console.error(`[${new Date().toISOString()}] ${message}`);
      }
    }
  };
}

export const secureLogger = createSecureLogger();
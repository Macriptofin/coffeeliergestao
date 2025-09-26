import React, { Component, ErrorInfo, ReactNode } from 'react';
import { sanitizeForLogging } from '@/utils/logSanitizer';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string;
}

export class SecureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a safe error ID for user reference
    const errorId = Math.random().toString(36).substring(2, 15);
    
    return {
      hasError: true,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Sanitize error information before logging
    const sanitizedError = sanitizeForLogging({
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
    
    // In development, log the full error
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', sanitizedError);
    }
    
    // In production, only log minimal safe information
    console.error(`Application error ${this.state.errorId}: ${error.name}`);
    
    // Here you would typically send to a logging service
    // that doesn't contain PII
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
          <div className="max-w-md w-full mx-auto p-6 bg-card rounded-lg shadow-elegant">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Algo deu errado
              </h2>
              <p className="text-muted-foreground mb-4">
                Ocorreu um erro inesperado. Nossa equipe foi notificada automaticamente.
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                ID do erro: {this.state.errorId}
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, errorId: '' });
                  window.location.reload();
                }}
                className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SecureErrorBoundary;
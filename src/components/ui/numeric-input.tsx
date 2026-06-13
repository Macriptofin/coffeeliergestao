import { forwardRef, InputHTMLAttributes } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  className?: string;
}

/**
 * Input numérico com select-all automático ao focar.
 * Substitui `<Input type="number">` em todos os formulários do sistema.
 */
export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, onFocus, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="number"
        className={cn(className)}
        onFocus={(e) => {
          e.target.select();
          onFocus?.(e);
        }}
        {...props}
      />
    );
  }
);

NumericInput.displayName = 'NumericInput';

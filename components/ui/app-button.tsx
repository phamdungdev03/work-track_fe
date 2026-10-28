import type { ComponentProps, ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

type AppButtonProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size' | 'color'> & {
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'error';
  startIcon?: ReactNode;
  fullWidth?: boolean;
};

/** Shared button variants for the attendance demo. */
export function AppButton({ variant = 'text', size = 'medium', color = 'primary', startIcon, fullWidth, className, children, ...props }: AppButtonProps) {
  const style = color === 'error' ? 'destructive' : variant === 'contained' ? 'default' : variant === 'outlined' ? 'outline' : 'ghost';
  return <Button type="button" variant={style} size={size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'default'} className={cn(fullWidth && 'w-full', className)} {...props}>{startIcon}{children}</Button>;
}

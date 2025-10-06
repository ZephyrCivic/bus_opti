/**
 * src/lib/utils.ts
 * Provides the `cn` helper for merging className strings with tailwind-merge.
 * Centralizes future utility exports imported across shadcn/ui components.
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

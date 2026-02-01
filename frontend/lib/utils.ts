/**
 * @fileoverview Utility functions for className manipulation.
 * Combines clsx and tailwind-merge for optimal Tailwind CSS class handling.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges className strings with Tailwind CSS class deduplication.
 *
 * @param inputs - Class values to merge
 * @returns Merged className string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

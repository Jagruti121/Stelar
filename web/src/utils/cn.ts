/**
 * STELLAR — Utility helpers
 *
 * cn(): Tailwind class merger using clsx + tailwind-merge.
 * All other shared utilities live here.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Builds the deterministic student document ID.
 * Format: {deptCode}_{batch}_{division}_{roll}  (all lowercase)
 */
export function buildStudentId(
  deptCode: string,
  batch: string,
  division: string,
  roll: string
): string {
  return `${deptCode}_${batch}_${division}_${roll}`.toLowerCase();
}

/**
 * Builds the synthetic internal student email.
 * Students never see this email.
 */
export function buildStudentEmail(
  deptCode: string,
  batch: string,
  division: string,
  roll: string
): string {
  return `${deptCode}.${batch}.${division}.${roll}@students.stellar.local`.toLowerCase();
}

/**
 * Builds the deterministic chat ID for a one-to-one conversation.
 * Sorts the two UIDs so the ID is the same regardless of who initiates.
 */
export function buildChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/** Builds the deterministic attendance session ID. */
export function buildSessionId(
  subjectId: string,
  division: string,
  date: string,
  slot: string
): string {
  return `${subjectId}_${division}_${date}_${slot}`;
}

/** Formats a number as a percentage string. */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Truncates a string to `maxLen` characters, appending "…". */
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
}

/** Returns initials from a full name (max 2 characters). */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/** Lowercases and trims a string — used for skill/talent/interest keys. */
export function toKey(str: string): string {
  return str.toLowerCase().trim();
}

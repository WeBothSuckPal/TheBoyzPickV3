import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function formatSpread(spread: number) {
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export function formatGameTime(value: string) {
  return format(new Date(value), "EEE, MMM d • h:mm a");
}

export function formatCompactDate(value: string) {
  return format(new Date(value), "MMM d, h:mm a");
}

export function relativeTime(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function toTitleCase(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

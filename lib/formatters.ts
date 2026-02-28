// lib/formatters.ts

export function formatPhone(input: string | null | undefined): string {
  if (!input) return "";

  // keep only digits
  const digits = String(input).replace(/\D/g, "").slice(0, 10);

  // format as 123-456-7891
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

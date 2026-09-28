/**
 * Advisory format checks used to highlight likely-wrong fields on the review
 * screen. These never block saving — OCR of handwriting is imperfect and the
 * reviewer is the final authority.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-\s\d]{7,20}$/;

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}

export function isLikelyPhone(value: string | null | undefined): boolean {
  if (!value) return false;
  return PHONE_RE.test(value.trim());
}

const PHONE_NUMBER_PATTERN = /^\+?[1-9]\d{7,14}$/;
const PHONE_NUMBER_INVALID_MESSAGE = 'Please enter a valid phone number with 8 to 15 digits. You may use a leading "+", spaces, parentheses, dots, or hyphens.';
const PHONE_NUMBER_FORMAT_PATTERN = /^\+?[\d\s().-]+$/;

function normalizePhoneNumber(value) {
   if (typeof value !== 'string') return null;

   const trimmedValue = value.trim();
   if (!trimmedValue || trimmedValue.length > 32 || !PHONE_NUMBER_FORMAT_PATTERN.test(trimmedValue)) {
      return null;
   }

   const digits = trimmedValue.replace(/\D/g, '');
   const hasInternationalPrefix = trimmedValue.startsWith('+') || digits.startsWith('00');
   const normalizedDigits = digits.startsWith('00') ? digits.slice(2) : digits;

   if (!hasInternationalPrefix && trimmedValue.includes('+')) return null;
   if (/^(\d)\1+$/.test(normalizedDigits)) return null;

   return `${hasInternationalPrefix ? '+' : ''}${normalizedDigits}`;
}

/**
 * Validate a phone number against PHONE_NUMBER_PATTERN and sync the result into a native
 * input's custom validity state (and optionally a React error-message setter).
 *
 * @param {HTMLInputElement|null} inputNode - the native input element to set validity on
 * @param {string} value - the current phone number value to validate
 * @param {{current: boolean}|null} reportedRef - ref used to report the first invalid value once
 * @param {(message: string) => void} setCustomError - setter for a React-managed error message
 * @param {boolean} [isOnBlur=false] - when true, reports validity via inputNode.reportValidity()
 *   instead of updating `setCustomError` directly
 * @returns {boolean} whether the value is a valid phone number
 */
export function validatePhoneNumber(inputNode, value, reportedRef, setCustomError, isOnBlur = false) {
   const normalizedValue = normalizePhoneNumber(value);
   const isValid = normalizedValue !== null && PHONE_NUMBER_PATTERN.test(normalizedValue);

   if (inputNode?.setCustomValidity) {
      inputNode.setCustomValidity(isValid ? '' : PHONE_NUMBER_INVALID_MESSAGE);
   }
   if (!isOnBlur && typeof setCustomError === 'function') {
      setCustomError(isValid ? '' : PHONE_NUMBER_INVALID_MESSAGE);
   }

   if (!isValid && reportedRef && !reportedRef.current) {
      reportedRef.current = true;
      if (isOnBlur && inputNode?.reportValidity) {
         inputNode.reportValidity();
      }
   }

   return isValid;
};
const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Sanitize and normalize a JavaScript value without changing the original value.
 *
 * @param {unknown} value - the value to sanitize
 * @returns {unknown} the sanitized value, or null for non-finite numbers
 */
export function sanitizeAndNormalizeValue(value) {
   if (value === null || value === undefined) return value;

   switch (typeof value) {
      case 'string':
         return value.replace(CONTROL_CHARACTERS_PATTERN, '').trim();
      case 'number':
         return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : null;
      case 'boolean':
      case 'bigint':
      case 'symbol':
      case 'function':
         return value;
      case 'object':
         if (Array.isArray(value)) return value.map(sanitizeAndNormalizeValue);
         return value;
      default:
         return null;
   }
}

/**
 * Check whether a value exists after sanitization.
 *
 * @param {unknown} value - the value to validate
 * @returns {boolean} whether the sanitized value exists
 */
export function validateThatValueExist(value) {
   const normalizedValue = sanitizeAndNormalizeValue(value);

   if (normalizedValue === null || normalizedValue === undefined) return false;
   if (typeof normalizedValue === 'string') return normalizedValue.length > 0;
   return true;
}
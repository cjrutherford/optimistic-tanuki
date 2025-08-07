/**
 * Validates if all required fields are present in an object.
 * @template T The type of the object.
 * @param obj The object to validate.
 * @param requiredFields An array of keys that are required fields.
 * @returns An array of missing field names.
 */
export function validateRequiredFields<T>(
  obj: Partial<T>,
  requiredFields: (keyof T)[]
): string[] {
  const missing: string[] = [];
  for (const field of requiredFields) {
    if (
      obj[field] === undefined ||
      obj[field] === null ||
      (typeof obj[field] === 'string' && obj[field] === '')
    ) {
      missing.push(field as string);
    }
  }
  return missing;
}

/**
 * Validates object values against provided validation functions.
 * @template T The type of the object.
 * @param obj The object to validate.
 * @param fields An object where keys are field names and values are validation functions for those fields.
 * @returns True if all fields pass validation, false otherwise.
 */
export function validateObjectValues<T>(
    obj: Partial<T>,
    fields: {[key in keyof T]: ((value: T[key]) => boolean);}
): boolean {
  for (const [key, validateFn] of Object.entries(fields) as [keyof T, (value: T[keyof T]) => boolean][]) {
    const value = obj[key as keyof T];
    if (value === undefined || !validateFn(value as T[keyof T])) {
      return false;
    }
  }
  return true;
}
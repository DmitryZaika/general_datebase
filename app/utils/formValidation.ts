import isEmail from "validator/lib/isEmail";
// import isMobilePhone from "validator/lib/isMobilePhone";

export function validateString(
  value: FormDataEntryValue | null,
  minLength: number
): boolean {
  return (
    Boolean(value) && typeof value === "string" && value.length >= minLength
  );
}

export function validateEmail(value: FormDataEntryValue | null): boolean {
  return Boolean(value) && typeof value === "string" && isEmail(value);
}

export function validatePhone(value: FormDataEntryValue | null): boolean {
  return Boolean(value) && typeof value === "string" && value.length >= 10;
}

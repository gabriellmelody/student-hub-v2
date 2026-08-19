export function openDatePicker(input) {
  if (!input || input.disabled) return false;

  input.focus?.();
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return true;
    } catch {
      // Some browsers expose showPicker but reject it outside a supported gesture.
    }
  }

  input.click?.();
  return true;
}

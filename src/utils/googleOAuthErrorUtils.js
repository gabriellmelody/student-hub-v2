export function getGoogleOAuthAccessDeniedMessage(errorResponse = {}) {
  if (errorResponse?.error !== "access_denied") return "";

  const details = [
    errorResponse.error_description,
    errorResponse.error_subtype,
    errorResponse.details,
    errorResponse.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/test|tester|not.*authorized|not.*approved|access.*blocked|admin_policy/.test(details)) {
    return "This Google account isn't currently approved for the DayLo private beta.";
  }

  return "Google connection was cancelled.";
}

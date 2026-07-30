export const GOOGLE_CALENDAR_PREFERENCES_KEY =
  "studentHub.googleCalendarPreferences";
export const GOOGLE_CALENDAR_ACCOUNT_KEY =
  "studentHub.googleCalendarAccount";

export function getGoogleCalendarAccountId(value) {
  if (typeof value === "string") return value.trim();

  if (!value || typeof value !== "object") return "";

  return String(
    value.accountId ||
      value.id ||
      value.account_id ||
      value.account?.id ||
      value.account?.accountId ||
      value.account?.account_id ||
      ""
  ).trim();
}

export function loadGoogleCalendarAccountMeta() {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GOOGLE_CALENDAR_ACCOUNT_KEY) || "null"
    );
    const accountId = getGoogleCalendarAccountId(parsed);

    return accountId
      ? {
          accountId,
          savedAt:
            typeof parsed?.savedAt === "string" ? parsed.savedAt : "",
        }
      : null;
  } catch {
    return null;
  }
}

export function saveGoogleCalendarAccountMeta(accountId) {
  if (typeof window === "undefined") return;

  const nextAccountId = getGoogleCalendarAccountId(accountId);

  if (!nextAccountId) {
    window.localStorage.removeItem(GOOGLE_CALENDAR_ACCOUNT_KEY);
    return;
  }

  window.localStorage.setItem(
    GOOGLE_CALENDAR_ACCOUNT_KEY,
    JSON.stringify({
      accountId: nextAccountId,
      savedAt: new Date().toISOString(),
    })
  );
}

export function clearGoogleCalendarPreferences() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(GOOGLE_CALENDAR_PREFERENCES_KEY);
}

export function clearGoogleCalendarAccountStorage({ accountId = "" } = {}) {
  clearGoogleCalendarPreferences();

  if (accountId) {
    saveGoogleCalendarAccountMeta(accountId);
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(GOOGLE_CALENDAR_ACCOUNT_KEY);
  }
}

export function reconcileGoogleCalendarAccountStorage(accountId) {
  const nextAccountId = getGoogleCalendarAccountId(accountId);

  if (!nextAccountId) {
    clearGoogleCalendarAccountStorage();
    return {
      accountId: "",
      cleared: true,
      reason: "no_connected_account",
    };
  }

  const currentAccount = loadGoogleCalendarAccountMeta();

  if (!currentAccount?.accountId) {
    clearGoogleCalendarAccountStorage({ accountId: nextAccountId });
    return {
      accountId: nextAccountId,
      cleared: true,
      reason: "legacy_unscoped_cache",
    };
  }

  if (currentAccount.accountId !== nextAccountId) {
    clearGoogleCalendarAccountStorage({ accountId: nextAccountId });
    return {
      accountId: nextAccountId,
      cleared: true,
      reason: "account_changed",
    };
  }

  saveGoogleCalendarAccountMeta(nextAccountId);

  return {
    accountId: nextAccountId,
    cleared: false,
    reason: "account_matches",
  };
}

export function loadGoogleCalendarPreferencesFromStorage() {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GOOGLE_CALENDAR_PREFERENCES_KEY) || "{}"
    );

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getBusyGoogleCalendarIdsFromStorage() {
  const account = loadGoogleCalendarAccountMeta();

  if (!account?.accountId) return [];

  return Object.values(loadGoogleCalendarPreferencesFromStorage())
    .filter(
      (preference) =>
        preference?.calendarId && preference.useAsBusyTime === true
    )
    .map((preference) => preference.calendarId)
    .sort((left, right) => left.localeCompare(right));
}

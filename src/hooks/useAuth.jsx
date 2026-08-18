import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  bootstrapUserProfile,
  ensureUserProfile,
  getProfileForAuthenticatedUser,
  saveUserProfile,
  subscribeToUserProfileChanges,
} from "../lib/profile.js";
import { requestPasswordReset, resendSignupConfirmation, startGoogleOAuth } from "../utils/authUtils.js";

const AuthContext = createContext(null);
const PROFILE_BOOTSTRAP_RETRY_DELAY_MS = 650;
const PROFILE_REALTIME_REFETCH_DELAY_MS = 120;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const activeUserIdRef = useRef(null);
  const profileBootstrapRef = useRef({ userId: null, promise: null });
  const profileRefetchTimerRef = useRef(null);

  const loadProfile = useCallback(async (nextUser, { retry = true, silent = false } = {}) => {
    const userId = nextUser?.id || null;

    if (!userId) {
      activeUserIdRef.current = null;
      profileBootstrapRef.current = { userId: null, promise: null };
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return null;
    }

    activeUserIdRef.current = userId;
    setProfile((currentProfile) =>
      getProfileForAuthenticatedUser(currentProfile, userId)
    );

    if (
      profileBootstrapRef.current.userId === userId &&
      profileBootstrapRef.current.promise
    ) {
      return profileBootstrapRef.current.promise;
    }

    if (!silent) {
      setProfileLoading(true);
      setProfileError(null);
    }

    const bootstrapPromise = bootstrapUserProfile({
      user: nextUser,
      retry,
      retryDelayMs: PROFILE_BOOTSTRAP_RETRY_DELAY_MS,
      waitForRetry: wait,
      shouldContinue: (expectedUserId) => activeUserIdRef.current === expectedUserId,
      ensureProfile: (profileUser) => ensureUserProfile(supabase, profileUser),
    });

    profileBootstrapRef.current = { userId, promise: bootstrapPromise };

    try {
      const nextProfile = await bootstrapPromise;
      if (activeUserIdRef.current === userId && nextProfile) {
        setProfile(nextProfile);
      }
      return nextProfile;
    } catch (error) {
      if (activeUserIdRef.current === userId) {
        if (!silent) {
          setProfileError(error);
          setProfile(null);
        }
      }
      return null;
    } finally {
      if (profileBootstrapRef.current.promise === bootstrapPromise) {
        profileBootstrapRef.current = { userId: null, promise: null };
      }
      if (!silent && activeUserIdRef.current === userId) {
        setProfileLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const userId = user?.id || "";
    if (!userId) return undefined;

    const scheduleRefresh = () => {
      window.clearTimeout(profileRefetchTimerRef.current);
      profileRefetchTimerRef.current = window.setTimeout(() => {
        void loadProfile(user, { retry: false, silent: true });
      }, PROFILE_REALTIME_REFETCH_DELAY_MS);
    };
    const unsubscribe = subscribeToUserProfileChanges(
      supabase,
      userId,
      scheduleRefresh
    );
    const refreshOnFocus = () => {
      void loadProfile(user, { retry: false, silent: true });
    };
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearTimeout(profileRefetchTimerRef.current);
      unsubscribe();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadProfile, user]);

  useEffect(() => {
    let active = true;

    async function initializeSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        activeUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const nextSession = data?.session || null;
      setSession(nextSession);
      setUser(nextSession?.user || null);
      setLoading(false);
      if (nextSession?.user) {
        void loadProfile(nextSession.user);
      } else {
        void loadProfile(null);
      }
    }

    void initializeSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);

      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      setLoading(false);
      if (nextSession?.user) {
        void loadProfile(nextSession.user);
      } else {
        void loadProfile(null);
      }
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(async ({ email, password }) => {
    const result = await supabase.auth.signUp({ email, password });
    if (result.error) throw result.error;
    if (result.data?.user && result.data?.session) {
      await loadProfile(result.data.user);
    }
    return result.data;
  }, [loadProfile]);

  const signIn = useCallback(async ({ email, password }) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (result.data?.user) {
      await loadProfile(result.data.user);
    }
    return result.data;
  }, [loadProfile]);

  const signInWithGoogle = useCallback(() => startGoogleOAuth(supabase.auth), []);
  const sendPasswordReset = useCallback((email) => requestPasswordReset(supabase.auth, email), []);
  const resendVerification = useCallback((email) => resendSignupConfirmation(supabase.auth, email), []);
  const completePasswordRecovery = useCallback(async (password) => {
    const result = await supabase.auth.updateUser({ password });
    if (result.error) throw result.error;
    setRecoveryMode(false);
    const url = new URL(window.location.href);
    url.hash = "";
    ["code", "token", "type", "error", "error_code", "error_description"].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    return result.data;
  }, []);
  const changePassword = useCallback(async ({ currentPassword, password }) => {
    const result = await supabase.auth.updateUser({
      password,
      current_password: currentPassword,
    });
    if (result.error) throw result.error;
    return result.data;
  }, []);

  const signOut = useCallback(async () => {
    const result = await supabase.auth.signOut();
    if (result.error) throw result.error;
    activeUserIdRef.current = null;
    profileBootstrapRef.current = { userId: null, promise: null };
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setProfileLoading(false);
    setRecoveryMode(false);
  }, []);

  const retryProfile = useCallback(() => loadProfile(user, { retry: false }), [loadProfile, user]);
  const refreshProfile = useCallback(
    () => loadProfile(user, { retry: false, silent: true }),
    [loadProfile, user]
  );
  const updateProfile = useCallback(
    async (updates) => {
      const userId = user?.id || "";
      if (!userId) throw new Error("Sign in before updating your profile.");

      const nextProfile = await saveUserProfile(supabase, userId, updates);
      if (activeUserIdRef.current !== userId) return null;
      setProfile(nextProfile);
      setProfileError(null);
      return nextProfile;
    },
    [user]
  );
  const visibleProfile = getProfileForAuthenticatedUser(profile, user?.id || "");

  const value = useMemo(() => ({
    user,
    session,
    profile: visibleProfile,
    loading,
    profileLoading,
    profileError,
    recoveryMode,
    signUp,
    signIn,
    signInWithGoogle,
    sendPasswordReset,
    resendVerification,
    completePasswordRecovery,
    changePassword,
    signOut,
    retryProfile,
    refreshProfile,
    updateProfile,
  }), [
    user,
    session,
    visibleProfile,
    loading,
    profileLoading,
    profileError,
    recoveryMode,
    signUp,
    signIn,
    signInWithGoogle,
    sendPasswordReset,
    resendVerification,
    completePasswordRecovery,
    changePassword,
    signOut,
    retryProfile,
    refreshProfile,
    updateProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

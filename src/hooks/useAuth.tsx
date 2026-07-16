import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "student" | "alumni" | "company" | "individual";

export interface AuthProfile {
  id: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: AuthProfile | null;
  role: UserRole | null;
  authReady: boolean;
  profileReady: boolean;
  profileError: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async (userId: string) => {
      setProfileReady(false);
      setProfileError(false);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url, email, phone, bio")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;
      if (!error && data) {
        setProfile(data as AuthProfile);
      } else {
        setProfile(null);
        if (error) setProfileError(true);
      }
      setProfileReady(true);
    };

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        await loadProfile(nextUser.id);
      } else {
        setProfile(null);
        setProfileReady(true);
      }
    };

    syncSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setProfileReady(true);
        return;
      }
      void loadProfile(nextUser.id);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      authReady,
      profileReady,
      profileError,
    }),
    [user, profile, authReady, profileReady, profileError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

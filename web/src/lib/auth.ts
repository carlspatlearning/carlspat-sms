"use client";

export interface SessionUser {
  id: string;
  email: string;
  // PLATFORM_OWNER belongs to no school and uses /platform, never /dashboard.
  role: "PLATFORM_OWNER" | "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "PARENT" | "STUDENT" | "ACCOUNTANT";
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  schoolId: string | null;
}

const ACCESS_KEY = "cps_access_token";
const REFRESH_KEY = "cps_refresh_token";
const USER_KEY = "cps_user";

export function saveSession(user: SessionUser, accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Cookie lets the Next.js middleware gate /dashboard server-side.
  // It only signals "logged in" — the API still verifies the real JWT.
  document.cookie = `cps_session=1; path=/; max-age=${7 * 24 * 3600}; samesite=lax`;
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = "cps_session=; path=/; max-age=0";
}

export function getAccessToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

/** Where this user belongs after signing in. */
export function homePathFor(user: SessionUser): string {
  return user.role === "PLATFORM_OWNER" ? "/platform" : "/dashboard";
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

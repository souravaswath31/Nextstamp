"use client";

import { useEffect, useState } from "react";
import { hasAuthCookie } from "@/lib/authCookie";

/**
 * Whether this browser holds a sign-in cookie. Used only to shape the navigation (tabs, "Sign in"):
 * the server still checks the real session on every page that shows personal data. It starts false so
 * the server-rendered HTML is identical for everyone, which lets public pages be cached, and switches
 * after hydration for signed-in visitors.
 */
export function useHasSession(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    setHas(hasAuthCookie(document.cookie.split(";").map((c) => c.split("=")[0].trim())));
  }, []);
  return has;
}

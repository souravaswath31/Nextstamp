// Browser-side helpers for Escape Hatch: where a friend's room token lives, and the fetch calls.
// The token is kept per tab (sessionStorage) first, so two tabs on one laptop can be two friends,
// and mirrored to localStorage so a closed tab can rejoin as the same person.
import type { Action, GameView } from "@/lib/escape/game";

const key = (code: string) => `escape-token-${code.toUpperCase()}`;

export function readToken(code: string): string | null {
  try {
    return sessionStorage.getItem(key(code)) ?? localStorage.getItem(key(code));
  } catch {
    return null;
  }
}
export function saveToken(code: string, token: string) {
  try {
    sessionStorage.setItem(key(code), token);
    localStorage.setItem(key(code), token);
  } catch {
    /* private mode: the game still works for this tab */
  }
}
export function forgetToken(code: string) {
  try {
    sessionStorage.removeItem(key(code));
    localStorage.removeItem(key(code));
  } catch {
    /* ignore */
  }
}

async function post<T>(url: string, body: unknown, token?: string | null): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "x-escape-token": token } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Something went wrong. Try again.");
  return data as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const createRoom = (name: string, fromState: string) => post<{ code: string; token: string }>("/api/escape", { name, fromState });
export const joinRoom = (code: string, name: string) => post<{ token: string }>(`/api/escape/${code}/join`, { name });
export const sendAction = (code: string, token: string, action: Action) => post<{ ok: true }>(`/api/escape/${code}/act`, action, token);

export async function fetchView(code: string, token: string, since: string | null): Promise<GameView | { unchanged: true }> {
  const res = await fetch(`/api/escape/${code}${since ? `?v=${encodeURIComponent(since)}` : ""}`, {
    headers: { "x-escape-token": token },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Lost the room.");
  return data as GameView | { unchanged: true };
}

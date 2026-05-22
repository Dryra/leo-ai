const SESSION_STORAGE_KEY = "leo-ai-session-id";

export function getSessionId() {
  const existing = localStorage.getItem(SESSION_STORAGE_KEY);

  if (existing) return existing;

  const sessionId = crypto.randomUUID();
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);

  return sessionId;
}

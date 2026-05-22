export type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  source?: "object";
};

export type ObjectContext = {
  summary: string;
  fileName: string;
  detectedType: string;
};

export type ConversationSession = {
  messages: ConversationMessage[];
  objectContext: ObjectContext;
  updatedAt: number;
};

const sessions = new Map<string, ConversationSession>();
const sessionLocks = new Map<string, Promise<void>>();

const MAX_HISTORY_MESSAGES = 20;

export const systemMessage: ConversationMessage = {
  role: "system",
  content:
    "You are LEO AI, a futuristic AI avatar. Keep replies short, expressive, natural, and conversational. You remember the recent conversation and may refer to things the user mentioned earlier when relevant.",
};

function createSession(): ConversationSession {
  return {
    messages: [systemMessage],
    objectContext: {
      summary: "",
      fileName: "",
      detectedType: "",
    },
    updatedAt: Date.now(),
  };
}

export function getSession(sessionId: string) {
  const existing = sessions.get(sessionId);

  if (existing) {
    existing.updatedAt = Date.now();
    return existing;
  }

  const session = createSession();
  sessions.set(sessionId, session);

  return session;
}

export function addUserMessage(
  sessionId: string,
  content: string,
  source?: ConversationMessage["source"],
) {
  const session = getSession(sessionId);

  session.messages.push({
    role: "user",
    content,
    source,
  });

  session.updatedAt = Date.now();
  trimSession(session);
}

export function addAssistantMessage(
  sessionId: string,
  content: string,
  source?: ConversationMessage["source"],
) {
  const session = getSession(sessionId);

  session.messages.push({
    role: "assistant",
    content,
    source,
  });

  trimSession(session);
  session.updatedAt = Date.now();
}

export function setObjectContext(
  sessionId: string,
  objectContext: ObjectContext,
) {
  const session = getSession(sessionId);

  session.objectContext = objectContext;
  session.updatedAt = Date.now();
}

export function clearObjectContext(sessionId: string) {
  const session = getSession(sessionId);

  session.objectContext = {
    summary: "",
    fileName: "",
    detectedType: "",
  };

  session.messages = session.messages.filter(
    (message) => message.source !== "object",
  );

  session.updatedAt = Date.now();
}

export function getConversationInput(sessionId: string, userMessage: string) {
  addUserMessage(sessionId, userMessage);

  const session = getSession(sessionId);
  const objectContextMessage = session.objectContext.summary
    ? {
        role: "system" as const,
        content: `Current uploaded workspace object:
Filename: ${session.objectContext.fileName}
Type: ${session.objectContext.detectedType}
Summary: ${session.objectContext.summary}

When the user asks follow-up questions like summarize, improve, compare, find problems, or explain, use this uploaded object as context.`,
      }
    : null;

  const recentMessages = [
    systemMessage,
    ...(objectContextMessage ? [objectContextMessage] : []),
    ...session.messages
      .filter((message) => message.role !== "system")
      .slice(-MAX_HISTORY_MESSAGES),
  ];

  return recentMessages.map(({ role, content }) => ({ role, content }));
}

export async function runWithSessionLock<T>(
  sessionId: string,
  task: () => Promise<T>,
) {
  const previousTask = sessionLocks.get(sessionId) ?? Promise.resolve();
  const currentTask = previousTask.catch(() => undefined).then(task);
  const lockMarker = currentTask.then(
    () => undefined,
    () => undefined,
  );

  sessionLocks.set(sessionId, lockMarker);

  try {
    return await currentTask;
  } finally {
    if (sessionLocks.get(sessionId) === lockMarker) {
      sessionLocks.delete(sessionId);
    }
  }
}

function trimSession(session: ConversationSession) {
  const nonSystemMessages = session.messages.filter(
    (message) => message.role !== "system",
  );

  if (nonSystemMessages.length <= MAX_HISTORY_MESSAGES) return;

  const messagesToRemove = nonSystemMessages.length - MAX_HISTORY_MESSAGES;
  let removed = 0;

  for (
    let i = 0;
    i < session.messages.length && removed < messagesToRemove;
    i++
  ) {
    if (session.messages[i].role === "system") continue;

    session.messages.splice(i, 1);
    removed++;
    i--;
  }
}

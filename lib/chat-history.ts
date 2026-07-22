"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AIMessage } from "@/lib/ai/provider";

const STORAGE_KEY = "cc_chat_conversations_v1";
const MAX_CONVERSATIONS = 50;
const TITLE_MAX_LENGTH = 60;

export type Conversation = {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
};

function newId(): string {
  // crypto.randomUUID is available in every browser this app targets; the
  // fallback keeps SSR / very old runtimes from throwing.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function titleFrom(messages: AIMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user");
  const raw = firstUser?.content.trim() ?? "";
  if (!raw) {
    return "New chat";
  }
  const oneLine = raw.replace(/\s+/g, " ");
  return oneLine.length > TITLE_MAX_LENGTH
    ? `${oneLine.slice(0, TITLE_MAX_LENGTH)}…`
    : oneLine;
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.messages) &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
}

function load(): Conversation[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isConversation);
  } catch {
    return [];
  }
}

function persist(conversations: Conversation[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full or blocked — history is a convenience, so fail quietly.
  }
}

export type ChatHistory = {
  conversations: Conversation[];
  activeId: string | null;
  activeMessages: AIMessage[];
  /** Replace the active conversation's messages, creating one on first write. */
  setActiveMessages: (messages: AIMessage[]) => void;
  startNewChat: () => void;
  openConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
};

export function useChatHistory(): ChatHistory {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const hydrated = useRef(false);
  // Mirrors activeId so setActiveMessages can read the live id without a stale
  // closure and without re-creating the callback on every id change.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Load once after mount, client only, so the first (server-matched) render is
  // an empty list and hydration cannot mismatch. This is the standard
  // localStorage-hydration exception to the set-state-in-effect rule.
  useEffect(() => {
    const loaded = load().sort((a, b) => b.updatedAt - a.updatedAt);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setConversations(loaded);
    // Resume the most recent conversation so reopening the panel (after a
    // redirect or reload) lands back where the user left off.
    if (loaded.length > 0) {
      setActiveId(loaded[0].id);
    }
    hydrated.current = true;
  }, []);

  // Persist whenever conversations change, but never write the empty initial
  // state back over real stored history before hydration has run.
  useEffect(() => {
    if (hydrated.current) {
      persist(conversations);
    }
  }, [conversations]);

  const activeMessages =
    conversations.find((conversation) => conversation.id === activeId)
      ?.messages ?? [];

  const setActiveMessages = useCallback(
    (messages: AIMessage[]) => {
      const now = Date.now();
      // Resolve the target id BEFORE any setState. Generating the id inside a
      // state updater breaks under React StrictMode's double-invocation and
      // spawns duplicate conversations; keeping the updaters pure avoids that.
      const currentId = activeIdRef.current;
      const isNew = !currentId;
      const id = currentId ?? newId();
      if (isNew) {
        setActiveId(id);
      }

      setConversations((prev) => {
        const existing = prev.find((conversation) => conversation.id === id);
        if (existing) {
          return prev
            .map((conversation) =>
              conversation.id === id
                ? {
                    ...conversation,
                    messages,
                    title: titleFrom(messages),
                    updatedAt: now,
                  }
                : conversation,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt);
        }
        const created: Conversation = {
          id,
          title: titleFrom(messages),
          messages,
          createdAt: now,
          updatedAt: now,
        };
        return [created, ...prev].slice(0, MAX_CONVERSATIONS);
      });
    },
    [],
  );

  const startNewChat = useCallback(() => {
    // A new chat has no id yet; the first sent message creates the record.
    setActiveId(null);
  }, []);

  const openConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) =>
      prev.filter((conversation) => conversation.id !== id),
    );
    setActiveId((current) => (current === id ? null : current));
  }, []);

  return {
    conversations,
    activeId,
    activeMessages,
    setActiveMessages,
    startNewChat,
    openConversation,
    deleteConversation,
  };
}

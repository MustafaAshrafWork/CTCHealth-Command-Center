"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History, MessageCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ProjectConfirmCard,
  ProjectDeleteCard,
  ProjectEditCard,
  ProjectIdeaCard,
} from "@/components/chat/project-confirm-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChatHistory } from "@/lib/chat-history";
import type { ProjectDraft } from "@/lib/ai/project-agent";
import type { AIMessage } from "@/lib/ai/provider";

const MAX_HISTORY_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 2_000;

const PROJECT_TEMPLATE = `Project name:
Owner:
Client:
Category (tech / consultancy / agency / agents):
Start date:
End date:
Budget (number only):
Currency (USD / EUR / CHF):
At risk (yes/no + reason):
Needs help (yes/no + who): `;

const COMMANDS = [
  {
    name: "/new-project",
    description: "Insert a blank project-creation template",
  },
  { name: "/new-chat", description: "Start a fresh conversation" },
  { name: "/clear", description: "Clear this conversation's messages" },
  { name: "/help", description: "List commands and what the assistant can do" },
] as const;

type CommandName = (typeof COMMANDS)[number]["name"];

const HELP_TEXT = `Commands:
- /new-project — insert a blank project template to fill in
- /new-chat — start a fresh conversation
- /clear — clear this conversation's messages
- /help — show this list

You can also just talk to me. I can:
- answer questions about your projects
- create a new project
- edit an existing project
- delete (archive) a project
- log an idea when you ask for something I can't do

Every create, edit, delete, or idea waits for your confirmation.`;

// The command menu shows while the LAST token of the input is a bare "/command"
// with no trailing space — so it works mid-sentence, not only at the start.
function commandQuery(input: string): string | null {
  const token = input.split(/\s/).pop() ?? "";
  if (!token.startsWith("/")) {
    return null;
  }
  return token;
}

// Replace a completed "/new-project " token (anywhere in the text) with the
// template, so the user can type it mid-sentence and hit space to expand it.
function expandInlineTemplate(input: string): string | null {
  if (!input.includes("/new-project ")) {
    return null;
  }
  return input.replace("/new-project ", `${PROJECT_TEMPLATE}\n`);
}

const THINKING_WORDS = [
  "Thinking",
  "Pondering",
  "Reticulating",
  "Considering",
  "Reviewing projects",
  "Cross-referencing",
  "Reasoning",
  "Almost there",
];

function ThinkingIndicator() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWordIndex((index) => (index + 1) % THINKING_WORDS.length);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="flex max-w-[85%] items-center gap-2 self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
      aria-live="polite"
    >
      <Sparkles className="size-4 animate-pulse" />
      <span>{THINKING_WORDS[wordIndex]}…</span>
    </div>
  );
}

type AgentTurn =
  | { action: "answer"; message: string }
  | { action: "create"; message: string; draft: ProjectDraft }
  | {
      action: "edit";
      message: string;
      targetProjectId: string;
      draft: ProjectDraft;
    }
  | { action: "delete"; message: string; targetProjectId: string }
  | { action: "suggest-idea"; message: string; idea: string };

// The confirm card the current turn should show, if any.
type PendingAction =
  | { kind: "create"; draft: ProjectDraft }
  | { kind: "edit"; projectId: string; draft: ProjectDraft }
  | { kind: "delete"; projectId: string }
  | { kind: "idea"; idea: string };

type ChatResponse =
  | { ok: true; turn: AgentTurn }
  | { ok: false; error: string };

type ConfirmResponse =
  | {
      ok: true;
      project?: { id: string; name: string };
      deleted?: boolean;
      ideaId?: string;
    }
  | { ok: false; error: string };

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatConversationTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) {
    return `Today, ${time}`;
  }
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

export function ProjectChat() {
  const router = useRouter();
  const history = useChatHistory();
  const messages = history.activeMessages;
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [input, setInput] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [chatPending, setChatPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatInFlightRef = useRef(false);
  const confirmInFlightRef = useRef(false);

  const busy = chatPending || confirmPending;
  const setMessages = history.setActiveMessages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, error, chatPending]);

  // Keep the caret in the input after each assistant turn (and when the sheet
  // opens) so the user can keep typing without reaching for the mouse.
  useEffect(() => {
    if (open && !busy) {
      inputRef.current?.focus();
    }
  }, [open, busy]);

  async function sendMessages(nextMessages: AIMessage[]) {
    if (chatInFlightRef.current) {
      return;
    }
    chatInFlightRef.current = true;
    setChatPending(true);
    setError(null);
    // The next turn may invalidate a shown confirm card; only the server's next
    // actionable turn should bring one back.
    setPending(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          messages: nextMessages.slice(-MAX_HISTORY_MESSAGES),
        }),
      });
      const body = (await readJsonSafely(response)) as ChatResponse | null;

      if (!response.ok || !body || !body.ok) {
        setError(
          (body && !body.ok && body.error) ||
            "The assistant could not respond. Please try again.",
        );
        return;
      }

      const { turn } = body;
      setMessages([
        ...nextMessages,
        { role: "assistant", content: turn.message },
      ]);
      if (turn.action === "create") {
        setPending({ kind: "create", draft: turn.draft });
      } else if (turn.action === "edit") {
        setPending({
          kind: "edit",
          projectId: turn.targetProjectId,
          draft: turn.draft,
        });
      } else if (turn.action === "delete") {
        setPending({ kind: "delete", projectId: turn.targetProjectId });
      } else if (turn.action === "suggest-idea") {
        setPending({ kind: "idea", idea: turn.idea });
      }
    } catch {
      setError("Could not reach the assistant. Please try again.");
    } finally {
      chatInFlightRef.current = false;
      setChatPending(false);
    }
  }

  function handleSend() {
    const text = input.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text || chatPending) {
      return;
    }
    const nextMessages: AIMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setInput("");
    void sendMessages(nextMessages);
  }

  function handleRetry() {
    void sendMessages(messages);
  }

  async function handleConfirm() {
    if (confirmInFlightRef.current || !pending) {
      return;
    }
    confirmInFlightRef.current = true;
    setConfirmPending(true);
    setError(null);

    const requestBody =
      pending.kind === "create"
        ? { action: "confirm", confirmed: true, draft: pending.draft }
        : pending.kind === "edit"
          ? {
              action: "confirm-edit",
              confirmed: true,
              projectId: pending.projectId,
              draft: pending.draft,
            }
          : pending.kind === "delete"
            ? {
                action: "confirm-delete",
                confirmed: true,
                projectId: pending.projectId,
              }
            : { action: "confirm-idea", confirmed: true, idea: pending.idea };
    const failureMessage =
      pending.kind === "create"
        ? "Could not create the project. Please try again."
        : pending.kind === "edit"
          ? "Could not update the project. Please try again."
          : pending.kind === "delete"
            ? "Could not delete the project. Please try again."
            : "Could not save the idea. Please try again.";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const body = (await readJsonSafely(response)) as ConfirmResponse | null;

      if (!response.ok || !body || !body.ok) {
        setError((body && !body.ok && body.error) || failureMessage);
        return;
      }

      // Stay in the chat after every confirm — post a short result line and
      // refresh the data behind the sheet instead of navigating away.
      const projectName = body.project?.name ?? "project";
      const done =
        pending.kind === "create"
          ? `Created project "${projectName}".`
          : pending.kind === "edit"
            ? `Updated project "${projectName}".`
            : pending.kind === "delete"
              ? body.deleted
                ? `Deleted project "${projectName}".`
                : `Archived project "${projectName}".`
              : "Added your idea to the Ideas tab.";
      toast.success(done);
      setMessages([...messages, { role: "assistant", content: done }]);
      setPending(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      confirmInFlightRef.current = false;
      setConfirmPending(false);
    }
  }

  function handleCancelAction() {
    setPending(null);
  }

  function handleUseTemplate() {
    setInput(PROJECT_TEMPLATE);
    inputRef.current?.focus();
  }

  // Switching or starting a conversation drops the ephemeral action card and
  // any error — a draft from another chat must never be confirmable here.
  function handleNewChat() {
    history.startNewChat();
    setPending(null);
    setError(null);
    setInput("");
    setShowHistory(false);
    inputRef.current?.focus();
  }

  function handleOpenConversation(id: string) {
    history.openConversation(id);
    setPending(null);
    setError(null);
    setInput("");
    setShowHistory(false);
  }

  function handleClearChat() {
    setMessages([]);
    setPending(null);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  function runCommand(name: CommandName) {
    setCommandIndex(0);
    // Text before the trailing "/command" token is kept, so a command chosen
    // mid-sentence only replaces the token, not the whole message.
    const prefix = input.slice(0, input.length - (commandQuery(input)?.length ?? 0));
    switch (name) {
      case "/new-project":
        setInput(`${prefix}${PROJECT_TEMPLATE}\n`);
        inputRef.current?.focus();
        break;
      case "/new-chat":
        handleNewChat();
        break;
      case "/clear":
        handleClearChat();
        break;
      case "/help":
        setInput(prefix.trimEnd());
        setMessages([...messages, { role: "assistant", content: HELP_TEXT }]);
        inputRef.current?.focus();
        break;
    }
  }

  const query = commandQuery(input);
  const commandMatches =
    query === null
      ? []
      : COMMANDS.filter((command) => command.name.startsWith(query));
  const showCommandMenu = commandMatches.length > 0;
  const activeCommand =
    commandMatches[Math.min(commandIndex, commandMatches.length - 1)];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon-lg"
          className="fixed right-5 bottom-5 z-40 rounded-full shadow-lg"
        >
          <MessageCircle />
          <span className="sr-only">Create a project by chatting with AI</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="flex flex-col gap-0 p-0"
        overlayClassName="bg-black/5 supports-backdrop-filter:backdrop-blur-none"
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Project assistant</SheetTitle>
          <SheetDescription className="sr-only">
            Ask about your projects or create, edit, and delete them by chatting
            with an AI assistant. Nothing is saved, changed, or deleted until you
            confirm.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleNewChat}
          >
            <Plus className="size-4" />
            New chat
          </Button>
          <Button
            type="button"
            variant={showHistory ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            aria-pressed={showHistory}
            onClick={() => setShowHistory((value) => !value)}
          >
            <History className="size-4" />
            History
            {history.conversations.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({history.conversations.length})
              </span>
            )}
          </Button>
        </div>

        {showHistory && (
          <div className="max-h-64 overflow-y-auto border-b">
            {history.conversations.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No saved chats yet.
              </p>
            ) : (
              <ul className="flex flex-col py-1">
                {history.conversations.map((conversation) => (
                  <li
                    key={conversation.id}
                    className={cn(
                      "flex items-center gap-2 px-2",
                      conversation.id === history.activeId && "bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-muted"
                      onClick={() => handleOpenConversation(conversation.id)}
                    >
                      <span className="w-full truncate text-sm text-foreground">
                        {conversation.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatConversationTime(conversation.updatedAt)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete chat "${conversation.title}"`}
                      onClick={() =>
                        history.deleteConversation(conversation.id)
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tell me about the project you want to create — for example,
              &ldquo;New tech project for Acme, I&rsquo;ll own it.&rdquo;
            </p>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                message.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-muted text-foreground",
              )}
            >
              {message.content}
            </div>
          ))}

          {chatPending && <ThinkingIndicator />}

          {pending?.kind === "create" && (
            <ProjectConfirmCard
              draft={pending.draft}
              pending={confirmPending}
              onConfirm={handleConfirm}
              onKeepEditing={handleCancelAction}
            />
          )}
          {pending?.kind === "edit" && (
            <ProjectEditCard
              draft={pending.draft}
              pending={confirmPending}
              onConfirm={handleConfirm}
              onCancel={handleCancelAction}
            />
          )}
          {pending?.kind === "delete" && (
            <ProjectDeleteCard
              pending={confirmPending}
              onConfirm={handleConfirm}
              onCancel={handleCancelAction}
            />
          )}
          {pending?.kind === "idea" && (
            <ProjectIdeaCard
              idea={pending.idea}
              pending={confirmPending}
              onConfirm={handleConfirm}
              onCancel={handleCancelAction}
            />
          )}

          {error && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={busy}
                onClick={handleRetry}
              >
                Retry
              </Button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex flex-wrap gap-2 border-t px-3 pt-3">
          <button
            type="button"
            onClick={handleUseTemplate}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="size-3.5" />
            Create a project
          </button>
        </div>

        <div className="relative flex items-end gap-2 px-3 pb-3 pt-2">
          {showCommandMenu && (
            <div className="absolute bottom-full left-3 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
              <ul className="py-1">
                {commandMatches.map((command, index) => (
                  <li key={command.name}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-muted",
                        index === commandIndex && "bg-muted",
                      )}
                      onMouseEnter={() => setCommandIndex(index)}
                      onClick={() => runCommand(command.name)}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {command.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {command.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => {
              const next = event.target.value.slice(0, MAX_MESSAGE_LENGTH);
              // "/new-project " expands to the template inline, mid-sentence too.
              const expanded = expandInlineTemplate(next);
              setInput(expanded ?? next);
              setCommandIndex(0);
            }}
            onKeyDown={(event) => {
              if (showCommandMenu) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCommandIndex(
                    (index) => (index + 1) % commandMatches.length,
                  );
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCommandIndex(
                    (index) =>
                      (index - 1 + commandMatches.length) %
                      commandMatches.length,
                  );
                  return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (activeCommand) {
                    runCommand(activeCommand.name);
                  }
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setInput("");
                  return;
                }
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe the project… (type / for commands)"
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={busy}
            className="min-h-9 flex-1 resize-none"
          />
          <Button
            type="button"
            disabled={busy || !input.trim()}
            onClick={handleSend}
          >
            Send
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

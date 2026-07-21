"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { ProjectConfirmCard } from "@/components/chat/project-confirm-card";
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

type ChatResponse =
  | { ok: true; message: string; draft: ProjectDraft | null }
  | { ok: false; error: string };

type ConfirmResponse =
  | { ok: true; project: { id: string; name: string } }
  | { ok: false; error: string };

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function ProjectChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [input, setInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatInFlightRef = useRef(false);
  const confirmInFlightRef = useRef(false);

  const busy = chatPending || confirmPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, draft, error]);

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
    // A correction may invalidate the currently displayed draft; only the
    // server's next valid draft should bring the confirm card back.
    setDraft(null);

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

      setMessages([
        ...nextMessages,
        { role: "assistant", content: body.message },
      ]);
      setDraft(body.draft);
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
    if (confirmInFlightRef.current || !draft) {
      return;
    }
    confirmInFlightRef.current = true;
    setConfirmPending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", confirmed: true, draft }),
      });
      const body = (await readJsonSafely(response)) as ConfirmResponse | null;

      if (!response.ok || !body || !body.ok) {
        setError(
          (body && !body.ok && body.error) ||
            "Could not create the project. Please try again.",
        );
        return;
      }

      toast.success(`Project "${body.project.name}" created.`);
      setDraft(null);
      router.push(`/projects/${body.project.id}`);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      confirmInFlightRef.current = false;
      setConfirmPending(false);
    }
  }

  function handleKeepEditing() {
    setDraft(null);
  }

  function handleUseTemplate() {
    setInput(PROJECT_TEMPLATE);
    inputRef.current?.focus();
  }

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
      <SheetContent className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Create a project</SheetTitle>
          <SheetDescription>
            Chat with an AI assistant (Google Gemini) to draft a new project.
            Your messages are sent to Google Gemini — do not share patient or
            other sensitive personal data here. Nothing is saved until you
            confirm the draft.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">
                Tell me about the project you want to create — for example,
                &ldquo;New tech project for Acme, I&rsquo;ll own it.&rdquo;
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseTemplate}
              >
                Use a template
              </Button>
            </div>
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

          {draft && (
            <ProjectConfirmCard
              draft={draft}
              pending={confirmPending}
              onConfirm={handleConfirm}
              onKeepEditing={handleKeepEditing}
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

        <div className="flex items-end gap-2 border-t p-3">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) =>
              setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe the project…"
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

"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Loader2, Mail, MessageCircle, Minus, Phone, Send, Sparkles, X } from "lucide-react";
import { BRAND_LOGO_SRC } from "@/components/brand-logo";
import { AnimatePresence, motion } from "@/components/motion-primitives";
import { SUPPORT_EMAIL_CARE, SUPPORT_EMAIL_PHARMACY } from "@/lib/support-contact";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const starterPrompts = [
  "Can you help me find fever medicine?",
  "How do I upload a prescription?",
  "Do you deliver in Dibiyapur?",
];

const initialMessages: ChatMessage[] = [
  {
    id: "isa-welcome",
    role: "assistant",
    content:
      "Namaste, I’m Isa. I can help with medicine search, prescription upload, order help, delivery questions, and general safe medicine guidance.",
  },
];

function createMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `isa-${crypto.randomUUID()}`;
  }
  return `isa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatReply(content: string) {
  return content
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

export function IsaChatbot() {
  const { isLoaded, isSignedIn } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  /** PNG/WebP delivery covers modern browsers; on failure fall back to icons everywhere. */
  const [logoFailed, setLogoFailed] = useState(false);
  const [dockMounted, setDockMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * AbortController for the in-flight request. We replace it on every new
   * send and abort the previous one — prevents stale replies arriving out
   * of order when the user fires two questions back-to-back. Also aborted
   * on unmount.
   */
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setDockMounted(true);
    return () => {
      inflightRef.current?.abort();
      inflightRef.current = null;
    };
  }, []);

  const onLogoError = useCallback(() => {
    setLogoFailed(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
    inputRef.current?.focus();
  }, [isOpen, messages, isSending]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsSending(true);

    // Cancel any previous in-flight request — defends against the back-to-back
    // send case where two replies could arrive out of order.
    inflightRef.current?.abort();
    const controller = new AbortController();
    inflightRef.current = controller;

    // Send only the most recent 16 entries — keeps payload small and avoids
    // the server's 36-entry hard cap rejecting the request after long chats.
    const wirePayload = nextMessages
      .slice(-16)
      .map(({ role, content }) => ({ role, content }));

    try {
      const response = await fetch("/api/isa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wirePayload }),
        signal: controller.signal,
      });

      const data = (await response.json()) as { reply?: string };
      const reply =
        data.reply ||
        "I could not prepare a reply right now. Please call support if it is urgent.";

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: formatReply(reply),
        },
      ]);

      if (!response.ok) {
        setError("Isa is connected, but the AI service returned an issue.");
      }
    } catch (err) {
      // Aborted by a subsequent send / unmount — silently swallow.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Network issue. Please try again or call support.");
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content:
            "I’m having trouble connecting. For urgent medicine help, call Dawasarthi support at +91 9354360049.",
        },
      ]);
    } finally {
      // Only clear the in-flight ref if this controller is still the current
      // one (a newer send may have replaced it before we got here).
      if (inflightRef.current === controller) {
        inflightRef.current = null;
      }
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  /** Thumb zone: bottom-end FAB, lifted off edge + ≥44px tap target on small screens (Material / platform guidance). */
  const dockLayoutClass =
    "pointer-events-none fixed z-[140] flex w-max max-w-[min(390px,calc(100%-2.25rem))] flex-col items-end gap-2.5 sm:max-w-[min(390px,calc(100%-2.75rem))] sm:gap-3.5 " +
    "bottom-[max(2rem,env(safe-area-inset-bottom,0px))] right-[max(1.125rem,env(safe-area-inset-right,0px))] " +
    "sm:bottom-[max(1.375rem,env(safe-area-inset-bottom,0px))] sm:right-[max(1.375rem,env(safe-area-inset-right,0px))]";

  const panelMaxHeight =
    "min(620px, calc(100svh - 7.5rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px)))";

  const dock = (
    <div className={dockLayoutClass}>
      <AnimatePresence>
        {isOpen && (
          <motion.section
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ maxHeight: panelMaxHeight }}
            className="pointer-events-auto flex w-full min-w-0 max-w-[390px] min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl"
            aria-label="Isa AI support chat"
          >
            <div className="bg-slate-950 px-4 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-inner ring-1 ring-white/25">
                    {logoFailed ? (
                      <Sparkles className="h-6 w-6 text-brand-700" aria-hidden />
                    ) : (
                      <Image
                        src={BRAND_LOGO_SRC}
                        alt="Dawasarthi"
                        width={44}
                        height={44}
                        className="h-full w-full object-contain"
                        decoding="async"
                        fetchPriority="low"
                        onError={onLogoError}
                      />
                    )}
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-sm font-bold">
                      Isa
                      <Sparkles className="h-3.5 w-3.5 text-brand-300" />
                    </p>
                    <p className="text-xs text-slate-300">
                      Dawasarthi medicine support
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                  aria-label="Minimize Isa chat"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-[11px] leading-5 text-slate-200">
                Isa gives general guidance only. For emergencies or prescription changes,
                contact a doctor immediately.
              </p>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f8f9fa] px-3 py-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                      message.role === "user"
                        ? "rounded-br-md bg-brand-700 text-white"
                        : "rounded-bl-md border border-border bg-white text-slate-800 shadow-sm"
                    }`}
                  >
                    {message.content}
                  </div>
                </motion.div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-3.5 py-2.5 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-700" />
                    Isa is thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-white p-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={isSending}
                    className="shrink-0 rounded-full border border-border bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-brand-200 hover:bg-brand-50 disabled:opacity-60"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}

              {isLoaded && !isSignedIn ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-600">
                  Please{" "}
                  <Link href="/sign-in" className="font-semibold text-brand-700 underline">
                    sign in
                  </Link>{" "}
                  to chat with Isa.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask Isa about medicines, orders..."
                    className="min-w-0 flex-1 rounded-full border border-border bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
                    maxLength={700}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isSending}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    aria-label="Send message to Isa"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
              )}

              <a
                href="tel:+919354360049"
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-700"
              >
                <Phone className="h-3.5 w-3.5" />
                Call support: +91 9354360049
              </a>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-semibold">
                <a
                  href={`mailto:${SUPPORT_EMAIL_PHARMACY}`}
                  className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                >
                  <Mail className="h-3 w-3" aria-hidden />
                  {SUPPORT_EMAIL_PHARMACY}
                </a>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <a
                  href={`mailto:${SUPPORT_EMAIL_CARE}`}
                  className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                >
                  <Mail className="h-3 w-3" aria-hidden />
                  {SUPPORT_EMAIL_CARE}
                </a>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        whileHover={{ y: -2, scale: 1.03 }}
        whileTap={{ scale: 0.94 }}
        className="pointer-events-auto isolate inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-[0_12px_40px_-6px_rgba(15,23,42,0.55)] ring-2 ring-background hover:bg-brand-800 max-sm:min-w-[44px] max-sm:justify-center max-sm:px-4 sm:min-h-0 sm:min-w-0"
        aria-label={isOpen ? "Close Isa chat" : "Open Isa chat"}
      >
        {isOpen ? (
          <X className="h-5 w-5 shrink-0" aria-hidden />
        ) : (
          <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
        )}
        <span className="hidden sm:inline">{isOpen ? "Close" : "Ask Isa"}</span>
      </motion.button>
    </div>
  );

  if (!dockMounted) return null;
  return createPortal(dock, document.body);
}

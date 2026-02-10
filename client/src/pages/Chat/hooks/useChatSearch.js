// src/pages/Chat/hooks/useChatSearch.js
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import s from "../ChatPage.module.css";

export function useChatSearch({ roomId, messages, listRef }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState([]); // массив messageId
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const jumpTokenRef = useRef(0);

  // сброс при смене комнаты
  useEffect(() => {
    jumpTokenRef.current += 1;
    setSearchOpen(false);
    setSearchQuery("");
    setSearchMatches([]);
    setActiveMatchIndex(0);
  }, [roomId]);

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      const next = !prev;
      if (!next) {
        jumpTokenRef.current += 1;
        setSearchQuery("");
        setSearchMatches([]);
        setActiveMatchIndex(0);
      }
      return next;
    });
  }, []);

  const closeSearch = useCallback(() => {
    jumpTokenRef.current += 1;
    setSearchOpen(false);
    setSearchQuery("");
    setSearchMatches([]);
    setActiveMatchIndex(0);
  }, []);

  // пересчёт списка совпадений
  useEffect(() => {
    if (!searchQuery.trim()) {
      jumpTokenRef.current += 1;
      setSearchMatches([]);
      setActiveMatchIndex(0);
      return;
    }

    const q = searchQuery.trim().toLowerCase();
    const found = [];

    messages.forEach((m) => {
      if (!m?._id) return;
      const text = m?.text || "";
      if (text && text.toLowerCase().includes(q)) {
        found.push(String(m._id));
        return;
      }

      const rawAttachments = m?.meta?.attachments || m?.attachments || [];
      if (!Array.isArray(rawAttachments)) return;

      const hasMatch = rawAttachments.some((att) => {
        const name = att?.filename || att?.name || "";
        return name && name.toLowerCase().includes(q);
      });

      if (hasMatch) {
        found.push(String(m._id));
      }
    });

    setSearchMatches(found);
    setActiveMatchIndex(found.length ? 0 : 0);
  }, [searchQuery, messages]);

  const gotoPrevMatch = useCallback(() => {
    setActiveMatchIndex((prev) => {
      if (!searchMatches.length) return prev;
      return prev <= 0 ? searchMatches.length - 1 : prev - 1;
    });
  }, [searchMatches]);

  const gotoNextMatch = useCallback(() => {
    setActiveMatchIndex((prev) => {
      if (!searchMatches.length) return prev;
      return prev >= searchMatches.length - 1 ? 0 : prev + 1;
    });
  }, [searchMatches]);

  const scrollToMatch = useCallback(
    (messageId) => {
      const container = listRef?.current;
      const el = messageId && document.getElementById(`msg-${messageId}`);
      if (!el || !container) return;

      try {
        el.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      } catch {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offset =
          elRect.top -
          containerRect.top +
          container.scrollTop -
          container.clientHeight / 2 +
          elRect.height / 2;
        container.scrollTop = offset;
      }
    },
    [listRef]
  );

  const waitForMessageInView = useCallback(
    (messageId, token, timeoutMs = 3000) =>
      new Promise((resolve) => {
        const container = listRef?.current;
        if (!container || !messageId) {
          resolve(false);
          return;
        }

        let done = false;
        let rafId = null;
        let timeoutId = null;
        let scrollTimerId = null;
        let scrollStable = false;

        const cleanup = () => {
          if (done) return;
          done = true;
          if (rafId) cancelAnimationFrame(rafId);
          if (timeoutId) clearTimeout(timeoutId);
          if (scrollTimerId) clearTimeout(scrollTimerId);
          container.removeEventListener("scroll", onScroll);
        };

        const markStableSoon = () => {
          scrollStable = false;
          if (scrollTimerId) clearTimeout(scrollTimerId);
          scrollTimerId = setTimeout(() => {
            scrollStable = true;
          }, 120);
        };

        const onScroll = () => {
          markStableSoon();
        };

        const isInView = () => {
          const el = document.getElementById(`msg-${messageId}`);
          if (!el) return false;
          const cRect = container.getBoundingClientRect();
          const mRect = el.getBoundingClientRect();
          return mRect.bottom >= cRect.top && mRect.top <= cRect.bottom;
        };

        const tick = () => {
          if (done) return;
          if (jumpTokenRef.current !== token) {
            cleanup();
            resolve(false);
            return;
          }
          if (isInView() && scrollStable) {
            cleanup();
            resolve(true);
            return;
          }
          rafId = requestAnimationFrame(tick);
        };

        container.addEventListener("scroll", onScroll, { passive: true });
        markStableSoon();
        rafId = requestAnimationFrame(tick);
        timeoutId = setTimeout(() => {
          cleanup();
          resolve(false);
        }, timeoutMs);
      }),
    [listRef]
  );

  const highlightMessage = useCallback((messageId) => {
    if (!messageId) return;
    const wrapEl = document.getElementById(`msg-${messageId}`);
    if (!wrapEl) return;

    const bubble = wrapEl.querySelector('[data-role="msg-bubble"]');
    if (!bubble) return;

    bubble.classList.add(s.msgBubbleHighlight);
    setTimeout(() => {
      bubble.classList.remove(s.msgBubbleHighlight);
    }, 1400);
  }, []);

  // скролл к активному сообщению + подсветка после остановки
  useEffect(() => {
    if (!searchOpen) return;
    if (!searchMatches.length) return;

    let idx = activeMatchIndex;
    if (idx < 0) idx = 0;
    if (idx >= searchMatches.length) idx = searchMatches.length - 1;

    const msgId = searchMatches[idx];
    if (!msgId) return;

    const token = jumpTokenRef.current + 1;
    jumpTokenRef.current = token;

    scrollToMatch(msgId);
    waitForMessageInView(msgId, token).then((ok) => {
      if (!ok) return;
      if (jumpTokenRef.current !== token) return;
      highlightMessage(msgId);
    });
  }, [
    activeMatchIndex,
    searchMatches,
    searchOpen,
    scrollToMatch,
    waitForMessageInView,
    highlightMessage,
  ]);

  const totalMatches = searchMatches.length;
  const currentMatch = useMemo(
    () => (totalMatches ? activeMatchIndex + 1 : 0),
    [totalMatches, activeMatchIndex]
  );

  return {
    searchOpen,
    searchQuery,
    totalMatches,
    currentMatch,
    toggleSearch,
    closeSearch,
    handleSearchChange,
    gotoPrevMatch,
    gotoNextMatch,
  };
}

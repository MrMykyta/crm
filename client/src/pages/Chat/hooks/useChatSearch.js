// src/pages/Chat/hooks/useChatSearch.js
import { useEffect, useMemo, useState, useCallback } from "react";

export function useChatSearch({ roomId, messages, listRef }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState([]); // массив messageId
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // сброс при смене комнаты
  useEffect(() => {
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
        setSearchQuery("");
        setSearchMatches([]);
        setActiveMatchIndex(0);
      }
      return next;
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchMatches([]);
    setActiveMatchIndex(0);
  }, []);

  // пересчёт списка совпадений
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setActiveMatchIndex(0);
      return;
    }

    const q = searchQuery.toLowerCase();
    const found = [];

    messages.forEach((m) => {
      if (m?.text && m.text.toLowerCase().includes(q)) {
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

  // скролл к активному сообщению
  useEffect(() => {
    if (!searchOpen) return;
    if (!searchMatches.length) return;

    let idx = activeMatchIndex;
    if (idx < 0) idx = 0;
    if (idx >= searchMatches.length) idx = searchMatches.length - 1;

    const msgId = searchMatches[idx];
    if (!msgId) return;

    const container = listRef?.current;
    const el = msgId && document.getElementById(`msg-${msgId}`);
    if (!el || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const offset = elRect.top - containerRect.top;
    container.scrollTop += offset - container.clientHeight / 2;
  }, [activeMatchIndex, searchMatches, searchOpen, listRef]);

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
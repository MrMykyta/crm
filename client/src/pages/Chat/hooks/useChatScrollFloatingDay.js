// src/pages/Chat/hooks/useChatScrollFloatingDay.js
import { useEffect, useRef, useState, useCallback } from "react";

export function useChatScrollFloatingDay({
  listRef,
  groupedMessages,
  searchOpenDepsKey,
}) {
  const [scrollState, setScrollState] = useState({
    scrollable: false,
    scrolled: false,
  });
  const [floatingDay, setFloatingDay] = useState(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollStopTimeoutRef = useRef(null);

  // автоскролл к низу при загрузке/новых сообщениях
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [listRef, groupedMessages.length, searchOpenDepsKey]);

  const updateFromScroll = useCallback(
    (fromEvent = false) => {
      const el = listRef.current;
      if (!el) return;

      const scrollable = el.scrollHeight > el.clientHeight + 1;
      const scrolled = el.scrollTop > 0;

      setScrollState({ scrollable, scrolled });

      // нет скролла или в самом верху — ничего не показываем
      if (!scrollable || !scrolled) {
        setFloatingDay(null);
        if (fromEvent) setIsUserScrolling(false);
        return;
      }

      // пользователь скроллит
      if (fromEvent) {
        setIsUserScrolling(true);
        if (scrollStopTimeoutRef.current) {
          clearTimeout(scrollStopTimeoutRef.current);
        }
        scrollStopTimeoutRef.current = setTimeout(() => {
          setIsUserScrolling(false);
        }, 600);
      }

      const nodes = el.querySelectorAll("[data-day-key]");
      if (!nodes.length || !groupedMessages.length) {
        setFloatingDay(null);
        return;
      }

      const listRect = el.getBoundingClientRect();

      // ---- Зона столкновения с разделителем ----
      let nearTop = false;
      const NEAR_RANGE = 0;

      nodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        const relTop = rect.top - listRect.top; // позиция внутри контейнера
        if (relTop >= 0 && relTop <= NEAR_RANGE) {
          nearTop = true;
        }
      });

      if (nearTop) {
        setFloatingDay(null);
        return;
      }

      // ---- Вычисление "активного" дня ----
      let firstVisibleIndex = -1;
      const relPositions = [];

      nodes.forEach((node, idx) => {
        const rect = node.getBoundingClientRect();
        const relTop = rect.top - listRect.top;
        relPositions[idx] = relTop;
        if (firstVisibleIndex === -1 && relTop >= 0) {
          firstVisibleIndex = idx;
        }
      });

      let activeIndex = 0;

      if (firstVisibleIndex === -1) {
        activeIndex = nodes.length - 1;
      } else if (firstVisibleIndex <= 0) {
        activeIndex = 0;
      } else {
        activeIndex = firstVisibleIndex - 1;
      }

      const activeGroup = groupedMessages[activeIndex];
      const label = activeGroup?.label || null;
      setFloatingDay(label);
    },
    [listRef, groupedMessages]
  );

  // подписки на scroll/resize
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    // первоначальный расчёт
    updateFromScroll(false);

    const onScroll = () => updateFromScroll(true);
    const onResize = () => updateFromScroll(false);

    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (scrollStopTimeoutRef.current) {
        clearTimeout(scrollStopTimeoutRef.current);
      }
    };
  }, [listRef, groupedMessages, updateFromScroll]);

  const handleInputHeightChange = useCallback(
    (delta) => {
      const el = listRef.current;
      if (!el || !delta) return;
      // всегда компенсируем изменение высоты инпута
      el.scrollTop += delta;
    },
    [listRef]
  );

  return {
    scrollState,
    floatingDay,
    isUserScrolling,
    handleInputHeightChange,
  };
}
// src/pages/Chat/ChatWindow/ChatInput.jsx
import React, { useEffect, useRef } from "react";
import s from "../ChatPage.module.css";

export default function ChatInput({
  text,
  onChangeText,
  onKeyDown,
  onSend,
  disabled,
  onHeightChange, // delta px: >0 выросло, <0 сжалось
}) {
  const textareaRef = useRef(null);
  const prevTextHeightRef = useRef(0);
  const baseHeightRef = useRef(0); // высота одной строки

  const handleSendClick = () => {
    if (disabled) return;
    onSend && onSend();
  };

  /**
   * autoResize
   * - меряем высоту
   * - ограничиваем 35vh
   * - считаем delta относительно прошлой высоты
   * - НО: если возвращаемся к baseHeight (1 строка) — delta НЕ шлём
   */
  const autoResize = (silent = false) => {
    const el = textareaRef.current;
    if (!el) return;

    const prevH = prevTextHeightRef.current || el.offsetHeight || 0;

    // сбрасываем высоту, чтобы scrollHeight был честным
    el.style.height = "0px";

    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    const maxH = vh ? vh * 0.35 : 280; // 35% окна
    const rawScrollH = el.scrollHeight;
    const nextH = Math.min(rawScrollH, maxH);

    // если ещё не знаем базовую высоту — считаем её по первой отрисовке
    if (!baseHeightRef.current) {
      baseHeightRef.current = nextH; // высота одной строки
    }

    el.style.height = `${nextH}px`;
    el.style.overflowY = rawScrollH > maxH ? "auto" : "hidden";

    const base = baseHeightRef.current || 0;
    const prevAboveBase = prevH > base + 1; // был многострочный
    const nextAboveBase = nextH > base + 1; // стал многострочным

    prevTextHeightRef.current = nextH;

    if (silent || !onHeightChange) return;

    // КЕЙС БАГА:
    // если мы были многострочными и вернулись к одной строке —
    // не трогаем scroll (не шлём delta), чтобы чат не "подъезжал".
    if (prevAboveBase && !nextAboveBase) {
      return;
    }

    const delta = nextH - prevH;
    if (delta !== 0) {
      onHeightChange(delta);
    }
  };

  const handleChange = (e) => {
    onChangeText && onChangeText(e);
    // высоту пересчитает useEffect по text
  };

  // первый расчёт (фиксируем baseHeight, но без дёргания scroll)
  useEffect(() => {
    autoResize(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // при каждом изменении текста пересчёт высоты
  useEffect(() => {
    autoResize(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className={s.input}>
      <button
        type="button"
        className={s.inputIconBtn}
        onClick={() => {}}
      >
        📎
      </button>

      <div className={s.inputTextWrap}>
        <textarea
          ref={textareaRef}
          className={s.textbox}
          rows={1}
          value={text}
          placeholder="Сообщение…"
          onChange={handleChange}
          onKeyDown={onKeyDown}
        />
      </div>

      <button
        className={s.sendIconBtn}
        onClick={handleSendClick}
        disabled={disabled}
        type="button"
      >
        ➤
      </button>
    </div>
  );
}
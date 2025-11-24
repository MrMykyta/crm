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

  // НОВОЕ
  replyTo,        // { id, authorName, text } | null
  onCancelReply,  // () => void
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
   * - если возвращаемся к baseHeight (1 строка) — delta НЕ шлём
   */
  const autoResize = (silent = false) => {
    const el = textareaRef.current;
    if (!el) return;

    const prevH = prevTextHeightRef.current || el.offsetHeight || 0;

    el.style.height = "0px";

    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    const maxH = vh ? vh * 0.35 : 280;
    const rawScrollH = el.scrollHeight;
    const nextH = Math.min(rawScrollH, maxH);

    if (!baseHeightRef.current) {
      baseHeightRef.current = nextH;
    }

    el.style.height = `${nextH}px`;
    el.style.overflowY = rawScrollH > maxH ? "auto" : "hidden";

    const base = baseHeightRef.current || 0;
    const prevAboveBase = prevH > base + 1;
    const nextAboveBase = nextH > base + 1;

    prevTextHeightRef.current = nextH;

    if (silent || !onHeightChange) return;
    if (prevAboveBase && !nextAboveBase) return;

    const delta = nextH - prevH;
    if (delta !== 0) {
      onHeightChange(delta);
    }
  };

  const handleChange = (e) => {
    onChangeText && onChangeText(e);
    // высоту пересчитает useEffect по text
  };

  useEffect(() => {
    autoResize(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    autoResize(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const replyTitle =
    replyTo?.authorName ? `В ответ ${replyTo.authorName}` : "Ответ на сообщение";

  return (
    <div className={s.input}>
      {/* слева иконка вложений */}
      <button
        type="button"
        className={s.inputIconBtn}
        onClick={() => {}}
      >
        📎
      </button>

      {/* правая часть: баннер + инпут в колонку */}
      <div className={s.inputMain}>
        {replyTo && (
          <div className={s.replyWrap}>
            <div className={s.replyLeft}>
              <div className={s.replyIcon}>↩︎</div>
              <div className={s.replyTexts}>
                <div className={s.replyTitle}>{replyTitle}</div>
                {replyTo.text && (
                  <div className={s.replyText}>{replyTo.text}</div>
                )}
              </div>
            </div>

            <button
              type="button"
              className={s.replyCloseBtn}
              onClick={onCancelReply}
            >
              ✕
            </button>
          </div>
        )}

        <div className={s.inputRow}>
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
      </div>
    </div>
  );
}
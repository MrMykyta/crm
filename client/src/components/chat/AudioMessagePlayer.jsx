// components/chat/AudioMessagePlayer.jsx
// Telegram-like audio message bubble: play/pause, waveform, timer, and single-active behavior.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useLazyGetSignedFileUrlQuery } from "../../store/rtk/filesApi";
import { setActiveAudio, clearActiveAudio } from "../../store/slices/chatSlice";
import { generateWaveformBars } from "./audio/waveform";
import s from "./AudioMessagePlayer.module.css";

// Fixed number of waveform bars for stable layout.
const BARS_COUNT = 48;

const formatTime = (sec) => {
  if (!sec || Number.isNaN(sec)) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const normalizeUrl = (u) => {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base =
    (process.env.REACT_APP_API_URL || "http://localhost:5001").replace(/\/+$/, "");
  if (u.startsWith("/")) return `${base}${u}`;
  return u;
};

export default function AudioMessagePlayer({ fileId, filename }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  // Global active audio id (only one player can be active at a time).
  const activeAudioFileId = useSelector((st) => st.chat?.activeAudioFileId);

  // Audio element reference for play/pause/seek.
  const audioRef = useRef(null);
  // Waveform container reference for click-to-seek.
  const waveRef = useRef(null);
  // Lazy signed URL query (fetched only on first play).
  const [fetchSignedUrl] = useLazyGetSignedFileUrlQuery();

  // Signed audio source URL (cached per fileId).
  const [audioSrc, setAudioSrc] = useState(null);
  // Whether signed-url fetch is in progress.
  const [isSrcLoading, setIsSrcLoading] = useState(false);
  // Playback error message (i18n).
  const [srcError, setSrcError] = useState(null);

  // Total audio duration in seconds.
  const [duration, setDuration] = useState(0);
  // Current playback time in seconds.
  const [currentTime, setCurrentTime] = useState(0);
  // Local playing flag (derived from audio events).
  const [playing, setPlaying] = useState(false);

  const waveform = useMemo(
    () => generateWaveformBars(fileId, BARS_COUNT, 4, 20),
    [fileId]
  );
  const progress = duration ? Math.min(currentTime / duration, 1) : 0;
  const activeBars = Math.floor(progress * BARS_COUNT);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    // eslint-disable-next-line no-console
    console.debug("[AudioMessagePlayer] mount", {
      fileId,
      hasSrc: Boolean(audioSrc),
      duration,
      bars: waveform.length,
    });
  }, [fileId, audioSrc, duration, waveform.length]);

  useEffect(() => {
    setAudioSrc(null);
    setIsSrcLoading(false);
    setSrcError(null);
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
  }, [fileId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoaded = () => {
      setDuration(audio.duration || 0);
      setSrcError(null);
    };
    const handleTime = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const handleEnded = () => {
      setPlaying(false);
      if (activeAudioFileId === fileId) {
        dispatch(clearActiveAudio());
      }
    };
    const handlePause = () => {
      setPlaying(false);
    };
    const handleErr = () => {
      setAudioSrc(null);
      setSrcError(t("chat.audio.playbackError"));
      setPlaying(false);
      setIsSrcLoading(false);
      if (activeAudioFileId === fileId) {
        dispatch(clearActiveAudio());
      }
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleErr);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleErr);
    };
  }, [activeAudioFileId, dispatch, fileId]);

  useEffect(() => {
    if (!activeAudioFileId || activeAudioFileId === fileId) return;
    // Another audio started — pause this one without resetting currentTime.
    audioRef.current?.pause();
  }, [activeAudioFileId, fileId]);

  const ensureSrc = useCallback(async () => {
    if (!fileId) return null;
    if (audioSrc) return audioSrc;
    if (isSrcLoading) return null;

    setIsSrcLoading(true);
    setSrcError(null);
    try {
      const res = await fetchSignedUrl(fileId).unwrap();
      const url = normalizeUrl(res?.data?.url || res?.url || "");
      if (!url) throw new Error("signed-url missing");
      setAudioSrc(url);
      setIsSrcLoading(false);
      return url;
    } catch {
      setIsSrcLoading(false);
      setSrcError(t("chat.audio.playbackError"));
      return null;
    }
  }, [audioSrc, fetchSignedUrl, fileId, isSrcLoading, t]);

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setSrcError(t("chat.audio.playbackError"));
    }
  }, [audioSrc, t]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isSrcLoading) return;

    if (audio.paused) {
      dispatch(setActiveAudio(fileId));
      if (!audioSrc) {
        const url = await ensureSrc();
        if (!url) {
          dispatch(clearActiveAudio());
          return;
        }
        await startPlayback();
        return;
      }
      await startPlayback();
    } else {
      audio.pause();
      if (activeAudioFileId === fileId) {
        dispatch(clearActiveAudio());
      }
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    const wave = waveRef.current;
    if (!audio || !wave || !duration) return;

    const rect = wave.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const nextTime = (x / rect.width) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const timeLabel = playing ? formatTime(currentTime) : formatTime(duration);

  return (
    <div className={s.player}>
      <button
        type="button"
        className={s.playBtn}
        onClick={togglePlay}
        title={
          isSrcLoading
            ? t("chat.audio.loading")
            : playing
            ? t("chat.audio.pause")
            : t("chat.audio.play")
        }
        aria-label={
          isSrcLoading
            ? t("chat.audio.loading")
            : playing
            ? t("chat.audio.pause")
            : t("chat.audio.play")
        }
      >
        {playing ? "❚❚" : isSrcLoading ? "…" : "▶"}
      </button>

      <div className={s.meta}>
        <div className={s.timer}>{timeLabel}</div>
        <div className={s.wave} ref={waveRef} onClick={handleSeek}>
          {waveform.map((h, idx) => (
            <span
              key={`${fileId}-${idx}`}
              className={idx < activeBars ? s.waveBarActive : s.waveBar}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        {filename && <div className={s.filename}>{filename}</div>}
        {srcError && <div className={s.error}>{srcError}</div>}
      </div>

      <audio ref={audioRef} src={audioSrc || undefined} preload="metadata" />
    </div>
  );
}

// src/components/Calendar/CurrentTimeLineWeek.jsx
import React, { useEffect, useState } from "react";
import s from "../CalendarPage.module.css";

export default function CurrentTimeLineWeek({offsetTop}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const minutes =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  const top = (minutes / 60) * 48  + offsetTop;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    <div className={s.currentTimeWrap} style={{ top: `${top}px` }}>
      <div className={s.currentTimeBadge}>
        {hh}:{mm}
      </div>
      <div className={s.currentTimeLine} />
    </div>
  );
}
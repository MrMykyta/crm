import React from "react";
import s from "./ChatInfoPanel.module.css";

export default function ChatInfoTabs({ tabs = [], activeTab, onChange }) {
  return (
    <div className={s.infoTabs}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`${s.infoTab} ${
            activeTab === tab.key ? s.infoTabActive : ""
          }`}
          onClick={() => onChange && onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

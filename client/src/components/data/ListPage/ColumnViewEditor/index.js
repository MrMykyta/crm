import React, { useEffect, useState } from 'react';
import { SearchField } from '../../../ui/fields';
import s from './ColumnViewEditor.module.css';

// Компонент ColumnViewEditor: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ColumnViewEditor({
  title,
  hint,
  onClose,
  currentViewName,
  activeTitle,
  availableTitle,
  activeCount,
  availableCount,
  visibleSummary,
  searchValue,
  onSearchChange,
  activeItems = [],
  availableGroups = [],
  onMoveActive,
  onRemoveActive,
  onAddField,
  onReset,
  labels = {},
}) {
  const [dragKey, setDragKey] = useState('');
  const [dropKey, setDropKey] = useState('');
  const [groupOpen, setGroupOpen] = useState({
    default: true,
    business: true,
    logistics: true,
    main: true,
    additional: true,
    custom: true,
    system: false,
  });

  useEffect(() => {
    setGroupOpen((prev) => {
      const next = { ...prev };
      availableGroups.forEach((group) => {
        if (typeof next[group.key] !== 'boolean') {
          next[group.key] = group.key !== 'system';
        }
      });
      return next;
    });
  }, [availableGroups]);

  return (
    <>
      <div className={s.header}>
        <div>
          <div className={s.title}>{title}</div>
          <div className={s.sub}>{hint}</div>
        </div>
        <button type="button" className={s.iconBtn} onClick={onClose} title={labels.close}>
          ✕
        </button>
      </div>

      <div className={s.content}>
        <section className={s.currentView}>
          <div className={s.currentViewName}>{currentViewName}</div>
          <div className={s.currentViewMeta}>{visibleSummary}</div>
        </section>

        <section className={s.block}>
          <div className={s.blockHead}>
            <span className={s.blockTitle}>{activeTitle}</span>
            <span className={s.blockMeta}>{activeCount}</span>
          </div>

          {activeItems.length ? (
            <div className={s.activeList}>
              {activeItems.map((item) => (
                <div
                  key={item.key}
                  className={`${s.row} ${dropKey === item.key ? s.rowDrop : ''}`}
                  onDragOver={(event) => {
                    if (!dragKey || item.dragDisabled) return;
                    event.preventDefault();
                    setDropKey(item.key);
                  }}
                  onDragLeave={() => setDropKey('')}
                  onDrop={(event) => {
                    if (!dragKey || item.dragDisabled) return;
                    event.preventDefault();
                    onMoveActive?.(dragKey, item.key);
                    setDragKey('');
                    setDropKey('');
                  }}
                >
                  <span
                    className={`${s.drag} ${item.dragDisabled ? s.dragDisabled : ''}`}
                    draggable={!item.dragDisabled}
                    onDragStart={() => !item.dragDisabled && setDragKey(item.key)}
                    onDragEnd={() => {
                      setDragKey('');
                      setDropKey('');
                    }}
                    aria-hidden="true"
                  >
                    ⋮⋮
                  </span>
                  <div className={s.rowTexts}>
                    <span className={s.rowLabel}>{item.label}</span>
                    {item.raw ? <span className={s.rowRaw}>{item.raw}</span> : null}
                  </div>
                  <button
                    type="button"
                    className={s.rowBtn}
                    onClick={() => onRemoveActive?.(item.key)}
                    disabled={item.disableRemove}
                    title={labels.remove}
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={s.empty}>{labels.noActive}</div>
          )}
        </section>

        <section className={`${s.block} ${s.blockFill}`}>
          <div className={s.blockHead}>
            <span className={s.blockTitle}>{availableTitle}</span>
            <span className={s.blockMeta}>{availableCount}</span>
          </div>

          <div className={s.searchWrap}>
            <SearchField
              inputClassName={s.search}
              value={searchValue}
              onValueChange={(value) => onSearchChange?.(value)}
              placeholder={labels.search}
              fullWidth
            />
          </div>

          <div className={s.groups}>
            {availableGroups.map((group) => {
              const isOpen = !!groupOpen[group.key];
              return (
                <div key={group.key} className={s.group}>
                  <button
                    type="button"
                    className={s.groupHead}
                    onClick={() => setGroupOpen((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                  >
                    <span>{group.label}</span>
                    <span className={s.groupMeta}>{group.items.length}</span>
                    <span className={s.groupArrow}>{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen ? (
                    <div className={s.groupList}>
                      {group.items.map((item) => (
                        <div
                          key={item.key}
                          className={`${s.row} ${s.rowAdd}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => onAddField?.(item.key)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onAddField?.(item.key);
                            }
                          }}
                        >
                          <div className={s.rowTexts}>
                            <span className={s.rowLabel}>{item.label}</span>
                            {item.raw ? <span className={s.rowRaw}>{item.raw}</span> : null}
                          </div>
                          <button
                            type="button"
                            className={s.rowBtn}
                            onClick={(event) => {
                              event.stopPropagation();
                              onAddField?.(item.key);
                            }}
                            title={labels.add}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {availableGroups.length === 0 ? (
              <div className={s.empty}>{labels.emptySearch}</div>
            ) : null}
          </div>
        </section>
      </div>

      <div className={s.footer}>
        <button
          type="button"
          className={s.resetBtn}
          onClick={onReset}
          title={labels.resetHint}
        >
          {labels.reset}
        </button>
      </div>
    </>
  );
}

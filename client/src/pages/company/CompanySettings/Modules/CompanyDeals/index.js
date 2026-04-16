// src/pages/CompanyDeals/index.jsx
import React, { useState, useEffect } from "react";
import s from "./CompanyDeals.module.css";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

import ThemedSelect from "../../../../../components/inputs/RadixSelect";

/* ===== helpers ===== */
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
// stepColor: вспомогательная логика компонента.
function stepColor(i, total) {
  const h = 110, s = "60%";
  const lStart = 60, lEnd = 32;
  if (total <= 1) return `hsl(${h} ${s} ${lStart}%)`;
  const t = i / (total - 1);
  const l = lStart + (lEnd - lStart) * t;
  return `hsl(${h} ${s} ${l}%)`;
}

/* ===== сортируемый этап ===== */
function SortableStep({ id, index, total, name, color, onRename }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: color || stepColor(index, total),
    borderTopLeftRadius: index === 0 ? "14px" : 0,
    borderBottomLeftRadius: index === 0 ? "14px" : 0,
    borderTopRightRadius: index === total - 1 ? "14px" : 0,
    borderBottomRightRadius: index === total - 1 ? "14px" : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${s.step} ${isDragging ? s.dragging : ""}`}
      onDoubleClick={onRename}
      {...attributes}
      {...listeners}
    >
      <span className={s.stepText}>{name}</span>
    </div>
  );
}

/* ===== страница ===== */
export default function CompanyDeals() {
  const [funnels, setFunnels] = useState([
    {
      id: "f-1",
      name: "Воронка продаж (дефолтная)",
      expanded: false,
      stages: [
        { id: uid(), name: "Этап 1", color: "#8fdb60" },
        { id: uid(), name: "Этап 2", color: "#79cf53" },
        { id: uid(), name: "Этап 3", color: "#56af3c" },
        { id: uid(), name: "Этап 4", color: "#46993f" },
        { id: uid(), name: "Этап 5", color: "#3a8637" },
      ],
    },
  ]);

  const [editingFunnelId, setEditingFunnelId] = useState(null);
  const [editingStageKey, setEditingStageKey] = useState(null);
  const [selectedStageByFunnel, setSelectedStageByFunnel] = useState({});
  useEffect(() => {
    setSelectedStageByFunnel(prev => {
      const next = { ...prev };
      for (const f of funnels) {
        if (!f.stages.length) continue;
        if (!next[f.id] || !f.stages.some(s => s.id === next[f.id])) {
          next[f.id] = f.stages[0].id;
        }
      }
      for (const fid of Object.keys(next)) {
        if (!funnels.some(f => f.id === fid)) delete next[fid];
      }
      return next;
    });
  }, [funnels]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    // addFunnel: добавляет элемент в локальное состояние компонента.
const addFunnel = () => {
    const n = funnels.length + 1;
    const newFunnel = {
      id: `f-${Date.now()}`,
      name: `Новая воронка ${n}`,
      expanded: false,
      stages: [
        { id: uid(), name: "Этап 1", color: "#8fdb60" },
        { id: uid(), name: "Этап 2", color: "#67bf46" },
        { id: uid(), name: "Этап 3", color: "#46993f" },
      ],
    };
    setFunnels(f => [...f, newFunnel]);
    setSelectedStageByFunnel(m => ({ ...m, [newFunnel.id]: newFunnel.stages[0].id }));
  };

    // deleteFunnel: удаляет сущность в рамках UI-компонента.
const deleteFunnel = (fid) => setFunnels(fs => fs.filter(f => f.id !== fid));
    // addStage: добавляет элемент в локальное состояние компонента.
const addStage = (fid) => setFunnels(fs => fs.map(f => {
    if (f.id !== fid) return f;
    const idx = f.stages.length + 1;
    return { ...f, stages: [...f.stages, { id: uid(), name: `Этап ${idx}`, color: "#8fdb60" }] };
  }));
    // toggleExpanded: переключает состояние компонента.
const toggleExpanded = (fid) => setFunnels(fs => fs.map(f => f.id === fid ? { ...f, expanded: !f.expanded } : f));

    // handleDragEnd: обработчик пользовательского действия.
const handleDragEnd = (fid) => (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setFunnels(fs => fs.map(f => {
      if (f.id !== fid) return f;
      const ids = f.stages.map(s => s.id);
      const oldIndex = ids.indexOf(active.id);
      const newIndex = ids.indexOf(over.id);
      if (oldIndex < 0 || newIndex < 0) return f;
      return { ...f, stages: arrayMove(f.stages, oldIndex, newIndex) };
    }));
  };

    // startRenameFunnel: вспомогательная логика компонента.
const startRenameFunnel = (fid) => setEditingFunnelId(fid);
    // commitRenameFunnel: вспомогательная логика компонента.
const commitRenameFunnel = (fid, value, fallback) => {
    const name = (value ?? "").trim() || fallback;
    setFunnels(fs => fs.map(f => f.id === fid ? { ...f, name } : f));
    setEditingFunnelId(null);
  };

    // startRenameStage: вспомогательная логика компонента.
const startRenameStage = (fid, sid) => setEditingStageKey(`${fid}:${sid}`);
    // commitRenameStage: вспомогательная логика компонента.
const commitRenameStage = (fid, sid, value, fallback) => {
    const name = (value ?? "").trim() || fallback;
    setFunnels(fs => fs.map(f => {
      if (f.id !== fid) return f;
      return { ...f, stages: f.stages.map(s => s.id === sid ? { ...s, name } : s) };
    }));
    setEditingStageKey(null);
  };

    // changeColor: вспомогательная логика компонента.
const changeColor = (fid, sid, color) =>
    setFunnels(fs =>
      fs.map(f => f.id !== fid ? f : ({
        ...f,
        stages: f.stages.map(s => s.id === sid ? { ...s, color } : s)
      }))
    );

  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <button className={s.primary} onClick={addFunnel}>+ Добавить воронку продаж</button>
      </div>

      <div className={s.list}>
        {funnels.map((f) => {
          const total = f.stages.length;
          const isEditFunnel = editingFunnelId === f.id;
          const selectedStageId = selectedStageByFunnel[f.id];
          const selectedStage =
            f.stages.find(s => s.id === selectedStageId) || f.stages[0] || null;

          return (
            <section key={f.id} className={s.card}>
              <header className={s.head}>
                {isEditFunnel ? (
                  <input
                    className={s.titleInput}
                    autoFocus
                    defaultValue={f.name}
                    onBlur={(e) => commitRenameFunnel(f.id, e.target.value, f.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditingFunnelId(null);
                    }}
                  />
                ) : (
                  <h3 className={s.title} onDoubleClick={() => startRenameFunnel(f.id)}>
                    {f.name}
                  </h3>
                )}

                <div className={s.headBtns}>
                  <button className={s.addStageInRow} onClick={() => addStage(f.id)}>+ Этап</button>
                  <button className={s.delFunnel} onClick={() => deleteFunnel(f.id)}>🗑 Удалить</button>
                </div>
              </header>

              <div className={s.scrollX}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToHorizontalAxis]}
                  onDragEnd={handleDragEnd(f.id)}
                >
                  <SortableContext
                    items={f.stages.map(s => s.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className={s.steps}>
                      {f.stages.map((st, i) => {
                        const editKey = `${f.id}:${st.id}`;
                        const isEdit = editingStageKey === editKey;

                        if (isEdit) {
                          return (
                            <div
                              key={st.id}
                              className={s.step}
                              style={{
                                background: st.color,
                                borderTopLeftRadius: i === 0 ? "14px" : 0,
                                borderBottomLeftRadius: i === 0 ? "14px" : 0,
                                borderTopRightRadius: i === total - 1 ? "14px" : 0,
                                borderBottomRightRadius: i === total - 1 ? "14px" : 0,
                              }}
                            >
                              <input
                                className={s.stepInput}
                                autoFocus
                                defaultValue={st.name}
                                onBlur={(e) => commitRenameStage(f.id, st.id, e.target.value, st.name)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  if (e.key === "Escape") setEditingStageKey(null);
                                }}
                              />
                            </div>
                          );
                        }

                        return (
                          <SortableStep
                            key={st.id}
                            id={st.id}
                            index={i}
                            total={total}
                            name={st.name}
                            color={st.color}
                            onRename={() => startRenameStage(f.id, st.id)}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              <div className={s.chevWrap}>
                <button
                  className={`${s.chevBtn} ${f.expanded ? s.open : ""}`}
                  onClick={() => toggleExpanded(f.id)}
                >
                  <span className={s.chev} />
                </button>
              </div>

              <div className={`${s.details} ${f.expanded ? s.show : ""}`}>
                <div className={s.controls}>
                  <label className={s.ctrlLabel}>Этап</label>

                  <div style={{ minWidth: 220, maxWidth: 300 }}>
                    <ThemedSelect
                      className={s.select}
                      value={selectedStage ? selectedStage.id : undefined}
                      options={f.stages.map(st => ({ value: st.id, label: st.name }))}
                      onChange={(val) =>
                        setSelectedStageByFunnel((m) => ({ ...m, [f.id]: val }))
                      }
                      placeholder="Выберите этап"
                    />
                  </div>

                  <label className={s.ctrlLabel}>Цвет</label>
                  <div className={s.colorPicker}>
                    <span
                      className={s.colorPreview}
                      style={{ background: selectedStage?.color || "#6cc657" }}
                    />
                    <input
                      type="color"
                      className={s.colorInput}
                      value={selectedStage?.color || "#6cc657"}
                      onChange={(e) =>
                        selectedStage && changeColor(f.id, selectedStage.id, e.target.value)
                      }
                    />
                    <input
                      className={s.hex}
                      value={selectedStage?.color || ""}
                      onChange={(e) =>
                        selectedStage && changeColor(f.id, selectedStage.id, e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

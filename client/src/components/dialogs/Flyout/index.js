import { useEffect, useState } from 'react';
import s from './Flyout.module.css';

const PANELS = {
    // leads: вспомогательная логика компонента.
leads:   () => <div className={s.panel}>Фильтры лидов: статус, источник, теги…</div>,
    // clients: вспомогательная логика компонента.
clients: () => <div className={s.panel}>Фильтры клиентов: сегмент, активность…</div>,
    // orders: вспомогательная логика компонента.
orders:  () => <div className={s.panel}>Фильтры заказов: статус, канал, дата…</div>,
    // products: вспомогательная логика компонента.
products:() => <div className={s.panel}>Фильтры товаров: категория, бренд…</div>,
};

// Компонент Flyout: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function Flyout() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(null);

  useEffect(() => {
        // handler: обработчик пользовательского действия.
const handler = (e) => { setKey(e.detail.key); setOpen(true); };
    window.addEventListener('open-flyout', handler);
        // mover: вспомогательная логика компонента.
const mover = (ev) => { if (open && ev.clientX < window.innerWidth - 380) setOpen(false); };
    window.addEventListener('mousemove', mover);
    return () => { window.removeEventListener('open-flyout', handler); window.removeEventListener('mousemove', mover); };
  }, [open]);

  const Panel = key ? PANELS[key] : null;
  if (!Panel) return null;

  return (
    <div className={`${s.drawer} ${open ? s.open : ''}`} onMouseLeave={()=>setOpen(false)}>
      <Panel/>
    </div>
  );
}

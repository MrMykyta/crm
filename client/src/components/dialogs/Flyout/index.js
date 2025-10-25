import { useEffect, useState } from 'react';
import s from './Flyout.module.css';

const PANELS = {
  leads:   () => <div className={s.panel}>Фильтры лидов: статус, источник, теги…</div>,
  clients: () => <div className={s.panel}>Фильтры клиентов: сегмент, активность…</div>,
  orders:  () => <div className={s.panel}>Фильтры заказов: статус, канал, дата…</div>,
  products:() => <div className={s.panel}>Фильтры товаров: категория, бренд…</div>,
};

export default function Flyout() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(null);

  useEffect(() => {
    const handler = (e) => { setKey(e.detail.key); setOpen(true); };
    window.addEventListener('open-flyout', handler);
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
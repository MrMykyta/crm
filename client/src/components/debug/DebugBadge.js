// DebugBadge.jsx
import { useSelector } from 'react-redux';
import { counterpartyApi } from '../../store/rtk/counterpartyApi';

const baseQuery = { page:1, limit:25, sort:'createdAt', dir:'DESC' };

// Компонент DebugBadge: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function DebugBadge(){
  const { isSuccess, isLoading } = useSelector(
    counterpartyApi.endpoints.listCounterparties.select(baseQuery)
  );
  return (
    <span style={{ fontSize: 'var(--font-size-12)', opacity: .7 }}>
      CP: {isLoading ? 'loading…' : (isSuccess ? 'ready' : 'idle')}
    </span>
  );
}


// DebugBadge.jsx
import { useSelector } from 'react-redux';
import { counterpartyApi } from '../../store/rtk/counterpartyApi';

const baseQuery = { page:1, limit:25, sort:'createdAt', dir:'DESC' };

export default function DebugBadge(){
  const { isSuccess, isLoading } = useSelector(
    counterpartyApi.endpoints.listCounterparties.select(baseQuery)
  );
  return (
    <span style={{ fontSize:12, opacity:.7 }}>
      CP: {isLoading ? 'loading…' : (isSuccess ? 'ready' : 'idle')}
    </span>
  );
}
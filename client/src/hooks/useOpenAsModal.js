import { useSearchParams } from 'react-router-dom';

export default function useOpenAsModal() {
  const [params] = useSearchParams();
  return params.get('modal') === '1';
}
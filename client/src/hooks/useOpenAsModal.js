import { useSearchParams } from 'react-router-dom';

// Хук useOpenAsModal: инкапсулирует переиспользуемую логику и возвращает состояние/обработчики для компонентов.
export default function useOpenAsModal() {
  const [params] = useSearchParams();
  return params.get('modal') === '1';
}

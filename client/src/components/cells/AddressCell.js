export default function AddressCell({ street, postcode, city, country }) {
  const text = [street, postcode, city, country].filter(Boolean).join(', ');
  return text || '—';
}
export default function RoleSelectCell({ value, options, onChange, className }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange?.(e.target.value)}>
      {options.map((r) => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  );
}
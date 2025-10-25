export default function LinkCell({ primary, secondary, onClick, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      className="rowLinkReset"
      aria-label={ariaLabel}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }}
    >
      <div style={{ fontWeight: 600 }}>{primary}</div>
      {secondary ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{secondary}</div>
      ) : null}
      <style>{`
        .rowLinkReset{appearance:none;background:none;border:0;padding:0;margin:0;color:inherit;font:inherit;cursor:pointer;}
        .rowLinkReset:hover div:first-child{text-decoration:underline;}
      `}</style>
    </button>
  );
}
// Inactive tabs are unmounted so hidden pages cannot issue background API calls.
export default function KeepAliveTab({ active, children }) {
  if (!active) return null;
  return <div className="contents">{children}</div>;
}
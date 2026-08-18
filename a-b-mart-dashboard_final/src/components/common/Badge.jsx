import "./styles/Badge.css";

export default function Badge({ type = "normal", children }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}
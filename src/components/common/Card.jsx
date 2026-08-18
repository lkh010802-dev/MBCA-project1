import "./styles/Card.css";

export default function Card({ title, value, unit, description }) {
  return (
    <div className="metric-card">
      <div className="metric-title">{title}</div>
      <div className="metric-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>
      {description && <div className="metric-description">{description}</div>}
    </div>
  );
}
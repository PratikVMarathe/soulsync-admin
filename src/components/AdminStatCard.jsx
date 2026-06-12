import AdminIcon from './AdminIcon';
import { formatStatNumber } from '../utils/formatters';

export default function AdminStatCard({
  description,
  icon,
  label,
  tone = 'forest',
  value,
}) {
  return (
    <article className={`admin-stat-card tone-${tone}`} title={description || label}>
      <div className="admin-stat-icon">
        <AdminIcon name={icon} size={24} />
      </div>

      <div className="admin-stat-copy">
        <span className="admin-stat-label">{label}</span>
        <strong className="admin-stat-value">{formatStatNumber(value)}</strong>
        {/* <span className="admin-stat-description">{description}</span> */}
      </div>
    </article>
  );
}

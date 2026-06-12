import AdminIcon from './AdminIcon';

export default function AdminQuickActionCard({ action, onClick }) {
  return (
    <button className="admin-quick-action-card" onClick={() => onClick(action.key)} type="button">
      <span className="admin-quick-action-icon">
        <AdminIcon name={action.icon} size={24} />
      </span>
      <strong>{action.label}</strong>
      <span>{action.description}</span>
      <AdminIcon className="admin-quick-action-chevron" name="chevron" size={18} />
    </button>
  );
}

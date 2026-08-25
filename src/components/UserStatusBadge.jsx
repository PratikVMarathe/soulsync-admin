const STATUS_TONE = {
  ACTIVE: 'is-success',
  BLOCKED: 'is-danger',
  SOFT_DELETED: 'is-warning',
};

const STATUS_LABEL = {
  ACTIVE: 'Active',
  BLOCKED: 'Blocked',
  SOFT_DELETED: 'Soft Deleted',
};

export default function UserStatusBadge({ status }) {
  const tone = STATUS_TONE[status] || '';
  const label = STATUS_LABEL[status] || status || 'Unknown';

  return (
    <span className={`admin-status-pill ${tone}`}>
      {label}
    </span>
  );
}

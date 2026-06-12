export default function AppStatusView({
  actions = [],
  compact = false,
  state,
}) {
  return (
    <section className={`admin-status-view${compact ? ' is-compact' : ''}`}>
      <div className="admin-status-card" role="alert">
        <span className="admin-status-code">{state?.statusCode || 500}</span>
        <h1>{state?.title || 'Unexpected Error'}</h1>
        <p>{state?.message || 'Something unexpected happened while loading SoulSync Admin.'}</p>

        {actions.length ? (
          <div className="admin-status-actions">
            {actions.map((action) => (
              <button
                className={action.tone === 'secondary' ? 'secondary-cta' : 'primary-cta'}
                key={action.label}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

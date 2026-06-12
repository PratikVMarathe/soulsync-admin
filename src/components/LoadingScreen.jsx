import Brand from './Brand';

export default function LoadingScreen({ message = 'Preparing SoulSync Admin...' }) {
  return (
    <section className="admin-loading-screen" aria-live="polite">
      <div className="admin-loading-card">
        <Brand />
        <div className="admin-loading-indicator">
          <span className="admin-spinner" />
          <p>{message}</p>
        </div>
      </div>
    </section>
  );
}

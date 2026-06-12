import { Link } from "react-router-dom";
import AdminIcon from "./AdminIcon";

export default function Brand({
  className = "",
  compact = false,
  iconOnly = false,
  textOnly = false,
  to = "/admin",
}) {
  return (
    <Link
      aria-label={iconOnly ? "SoulSync Admin" : undefined}
      className={`admin-brand${compact ? " is-compact" : ""} ${className}`.trim()}
      to={to}
    >
      {!textOnly ? (
        <span className="admin-brand-icon">
          <img
            src="/logo-svg1.png"
            alt="SoulSync Logo"
            style={{ width: compact ? 30 : 35, height: compact ? 22 : 26 }}
          />
        </span>
      ) : null}
      {!iconOnly ? (
        <span className="admin-brand-text">
          <span className="admin-brand-soul">Soul</span>
          <span className="admin-brand-sync">Sync</span>
        </span>
      ) : null}
    </Link>
  );
}

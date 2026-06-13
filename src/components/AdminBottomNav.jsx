import { useLocation, useNavigate } from 'react-router-dom';
import AdminIcon from './AdminIcon';

const bottomNavItems = [
  { key: 'home', label: 'Home', icon: 'home', route: '/admin' },
  { key: 'admins', label: 'Admins', icon: 'shield', route: '/admin/admins' },
  { key: 'quizzes', label: 'Quizzes', icon: 'book', actionKey: 'quiz-management' },
  { key: 'users', label: 'Users', icon: 'users', actionKey: 'user-management' },
  { key: 'profile', label: 'Profile', icon: 'profile', route: '/admin/profile' },
];

export default function AdminBottomNav({
  onAction,
  onCloseMenu,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = location.pathname.startsWith('/admin/profile')
    ? 'profile'
    : location.pathname.startsWith('/admin/admins')
      ? 'admins'
    : location.pathname.startsWith('/admin')
      ? 'home'
      : 'admins';

  const handleSelect = (item) => {
    if (item.key === 'home') {
      onCloseMenu();
      navigate(item.route);
      window.scrollTo({ behavior: 'smooth', top: 0 });
      return;
    }
    if (item.route) {
      onCloseMenu();
      navigate(item.route);
      return;
    }

    if (item.actionKey) {
      onCloseMenu();
      onAction(item.actionKey);
    }
  };

  return (
    <nav aria-label="Admin mobile navigation" className="admin-bottom-nav">
      {bottomNavItems.map((item) => (
        <button
          aria-current={activeKey === item.key ? 'page' : undefined}
          className={`admin-bottom-link${activeKey === item.key ? ' is-active' : ''}`}
          key={item.key}
          onClick={() => handleSelect(item)}
          type="button"
        >
          <AdminIcon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

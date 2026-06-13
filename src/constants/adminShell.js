import { USER_ROLES } from './auth';

export const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', route: '/admin' },
  { key: 'quiz-management', label: 'Quiz Management', icon: 'book' },
  { key: 'user-management', label: 'User Management', icon: 'users' },
  { key: 'admin-management', label: 'Admin Management', icon: 'shield', route: '/admin/admins', roles: [USER_ROLES.SUPER_ADMIN] },
  // { key: 'analytics', label: 'Analytics', icon: 'chart' },
  // { key: 'settings', label: 'Settings', icon: 'settings' },
];

export const QUICK_ACTIONS = [
  {
    description: 'Add new admin',
    icon: 'userPlus',
    key: 'create-admin',
    label: 'Create Admin',
    roles: [USER_ROLES.SUPER_ADMIN],
  },
  {
    description: 'Add new quiz',
    icon: 'bookPlus',
    key: 'create-quiz',
    label: 'Create Quiz',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
  },
  {
    description: 'Manage users',
    icon: 'users',
    key: 'view-users',
    label: 'View All Users',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
  },
  {
    description: 'Manage Admins',
    icon: 'shield',
    key: 'admin-management',
    label: 'View Admins',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
  },
];

export const ACTION_MESSAGES = {
  'admin-management': 'Admin management details are loading from Firestore now.',
  // 'analytics': 'Analytics dashboards are not wired up yet. This card is a preview for the next phase.',
  'create-admin': 'Admin invites now use the Phase 4 identity-lock flow.',
  'create-quiz': 'Quiz creation UI is planned next. This dashboard shell is ready for it.',
  'notification-center': 'Notifications are not connected yet. This bell is ready for upcoming admin alerts.',
  profile: 'Admin profile settings will be connected in the next phase.',
  'quiz-management': 'Quiz management screens are coming next. Use the preview cards for layout reference right now.',
  settings: 'Settings are not available yet. The shell is ready for the upcoming configuration screens.',
  'user-management': 'User management actions will land in the next phase once backend moderation workflows are connected.',
  'view-reports': 'Reports are still preview-only. They will be connected after analytics collections are ready.',
  'view-users': 'The full user management screen is coming next. For now, use the overview table on the dashboard.',
};

import { USER_ROLES } from './auth';

export const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', route: '/admin' },
  { key: 'quiz-management', label: 'Quiz Management', icon: 'book', route: '/admin/quizzes' },
  { key: 'mandala-updates', label: 'Maṇḍala Updates', icon: 'lotus', route: '/admin/mandala', roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN] },
  { key: 'user-management', label: 'User Management', icon: 'users', route: '/admin/users' },
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
  'create-quiz': 'Opening Quiz Management create flow.',
  'notification-center': 'Notifications are not connected yet. This bell is ready for upcoming admin alerts.',
  profile: 'Admin profile settings will be connected in the next phase.',
  'quiz-management': 'Opening Quiz Management.',
  settings: 'Settings are not available yet. The shell is ready for the upcoming configuration screens.',
  'user-management': 'Opening User Management.',
  'view-reports': 'Reports are still preview-only. They will be connected after analytics collections are ready.',
  'view-users': 'Opening User Management.',
};

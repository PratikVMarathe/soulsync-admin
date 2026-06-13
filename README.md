# SoulSync Admin Remote

The admin app is a federated remote consumed by the host for `ADMIN` and `SUPER_ADMIN` users.

It exposes:

```text
./AdminModule -> ./src/AdminModule.jsx
```

## Default Port

`5002`

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Environment Variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_DEV_PORT=5002
VITE_PREVIEW_PORT=5002
```

## Responsibilities

- validate admin session access
- render the admin dashboard shell
- support admin profile management
- support admin invite management
- support Super Admin editing of existing admin identities

## Current Admin Routes

- `/admin`
- `/admin/profile`
- `/admin/admins`
- `/admin/admins/create`
- `/admin/admins/:adminId/edit`

## Important Files

- `src/App.jsx`
- `src/AdminWorkspace.jsx`
- `src/services/adminSession.js`
- `src/services/adminInviteService.js`
- `src/services/adminProfileService.js`
- `src/services/userLookupService.js`
- `vite.config.js`

## Related Docs

- [../README.md](../README.md)
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- [../docs/FIREBASE_DATA_MODEL.md](../docs/FIREBASE_DATA_MODEL.md)

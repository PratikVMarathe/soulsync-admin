const STATUS_PRESETS = {
  401: {
    title: 'Sign In Required',
    message: 'Please sign in with your admin Google account to continue.',
  },
  403: {
    title: 'Admin Access Required',
    message: 'This account does not have access to the SoulSync admin dashboard.',
  },
  404: {
    title: 'Page Not Found',
    message: 'The admin page you requested does not exist.',
  },
  408: {
    title: 'Request Timed Out',
    message: 'SoulSync Admin took too long to respond. Please try again.',
  },
  500: {
    title: 'Admin Error',
    message: 'Something unexpected happened while loading SoulSync Admin.',
  },
  502: {
    title: 'Service Unavailable',
    message: 'A connected service failed while loading the admin dashboard.',
  },
  503: {
    title: 'Service Unavailable',
    message: 'SoulSync Admin is temporarily unavailable. Please try again shortly.',
  },
  default: {
    title: 'Unexpected Error',
    message: 'Something unexpected happened while loading SoulSync Admin.',
  },
};

function inferStatusCode(error) {
  const explicitStatus = Number(error?.statusCode || error?.status);
  if (Number.isFinite(explicitStatus) && explicitStatus > 0) {
    return explicitStatus;
  }

  const errorCode = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (errorCode === 'permission-denied') return 403;
  if (errorCode === 'not-found') return 404;
  if (errorCode === 'deadline-exceeded') return 408;
  if (errorCode === 'unavailable') return 503;
  if (message.includes('failed to fetch') || message.includes('networkerror')) return 503;

  return 500;
}

export function resolveAppErrorState(error, overrides = {}) {
  const statusCode = overrides.statusCode || inferStatusCode(error);
  const preset = STATUS_PRESETS[statusCode] || STATUS_PRESETS.default;

  return {
    statusCode,
    title: overrides.title || preset.title,
    message: overrides.message || error?.publicMessage || error?.message || preset.message,
  };
}

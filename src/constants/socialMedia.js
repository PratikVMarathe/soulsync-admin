export const SOCIAL_PLATFORMS = {
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
  YOUTUBE: 'youtube',
  FACEBOOK: 'facebook',
  TELEGRAM: 'telegram',
};

export const SOCIAL_PLATFORM_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'telegram', label: 'Telegram' },
];

export const SOCIAL_PLATFORM_CONFIG = {
  whatsapp: {
    label: 'WhatsApp',
    actionLabel: 'Join WhatsApp',
    placeholder: 'https://chat.whatsapp.com/... or https://wa.me/...',
    icon: 'whatsapp',
    validate: (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        return (
          host === 'chat.whatsapp.com' ||
          host === 'wa.me' ||
          host === 'whatsapp.com' ||
          host.endsWith('.whatsapp.com')
        );
      } catch {
        return false;
      }
    },
    errorMsg: 'Enter a valid HTTPS WhatsApp link (e.g., https://chat.whatsapp.com/... or https://wa.me/...)',
  },
  instagram: {
    label: 'Instagram',
    actionLabel: 'Open Instagram',
    placeholder: 'https://instagram.com/...',
    icon: 'instagram',
    validate: (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        return (
          host === 'instagram.com' ||
          host.endsWith('.instagram.com') ||
          host === 'instagr.am'
        );
      } catch {
        return false;
      }
    },
    errorMsg: 'Enter a valid HTTPS Instagram link (e.g., https://instagram.com/...)',
  },
  youtube: {
    label: 'YouTube',
    actionLabel: 'Watch on YouTube',
    placeholder: 'https://youtube.com/... or https://youtu.be/...',
    icon: 'youtube',
    validate: (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        return (
          host === 'youtube.com' ||
          host.endsWith('.youtube.com') ||
          host === 'youtu.be'
        );
      } catch {
        return false;
      }
    },
    errorMsg: 'Enter a valid HTTPS YouTube link (e.g., https://youtube.com/... or https://youtu.be/...)',
  },
  facebook: {
    label: 'Facebook',
    actionLabel: 'Open Facebook',
    placeholder: 'https://facebook.com/...',
    icon: 'facebook',
    validate: (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        return (
          host === 'facebook.com' ||
          host.endsWith('.facebook.com') ||
          host === 'fb.com' ||
          host === 'fb.me'
        );
      } catch {
        return false;
      }
    },
    errorMsg: 'Enter a valid HTTPS Facebook link (e.g., https://facebook.com/...)',
  },
  telegram: {
    label: 'Telegram',
    actionLabel: 'Join Telegram',
    placeholder: 'https://t.me/...',
    icon: 'telegram',
    validate: (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        return (
          host === 't.me' ||
          host === 'telegram.me' ||
          host.endsWith('.t.me') ||
          host === 'telegram.org' ||
          host.endsWith('.telegram.org')
        );
      } catch {
        return false;
      }
    },
    errorMsg: 'Enter a valid HTTPS Telegram link (e.g., https://t.me/...)',
  },
};

export const DEFAULT_SOCIAL_LINKS = {
  whatsapp: '',
  instagram: '',
  youtube: '',
  facebook: '',
  telegram: '',
};

export function normalizeSocialLinks(socialLinks) {
  if (!socialLinks || typeof socialLinks !== 'object') {
    return { ...DEFAULT_SOCIAL_LINKS };
  }

  return {
    whatsapp: (socialLinks.whatsapp || '').trim(),
    instagram: (socialLinks.instagram || '').trim(),
    youtube: (socialLinks.youtube || '').trim(),
    facebook: (socialLinks.facebook || '').trim(),
    telegram: (socialLinks.telegram || '').trim(),
  };
}

export function validateSocialLinks(socialLinks) {
  const errors = {};
  if (!socialLinks || typeof socialLinks !== 'object') {
    return errors;
  }

  for (const [platform, url] of Object.entries(socialLinks)) {
    const trimmed = (url || '').trim();
    if (!trimmed) continue;

    const config = SOCIAL_PLATFORM_CONFIG[platform];
    if (!config) {
      errors[platform] = `Unsupported social platform: ${platform}`;
      continue;
    }

    if (!config.validate(trimmed)) {
      errors[platform] = config.errorMsg;
    }
  }

  return errors;
}

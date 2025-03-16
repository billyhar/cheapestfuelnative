export const EMAIL_APPS = [
  {
    name: 'Gmail',
    icon: 'gmail',
    color: '#EA4335',
    scheme: 'googlegmail://',
    fallbackUrl: 'https://mail.google.com'
  },
  {
    name: 'Outlook',
    icon: 'microsoft-outlook',
    color: '#0078D4',
    scheme: 'ms-outlook://',
    fallbackUrl: 'https://outlook.live.com'
  },
  {
    name: 'Mail',
    icon: 'email',
    color: '#1A91FF',
    scheme: 'mailto://',
    fallbackUrl: 'https://www.apple.com/mail/'
  }
] as const;

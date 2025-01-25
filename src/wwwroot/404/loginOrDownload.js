(() => {
  'use strict';

  const platforms = {
    IOS: {
      text: 'Download on the App Store',
      href: '/api/download?platform=ios',
      hideLogin: true,
    },
    ANDROID: {
      text: 'Download on Google Play',
      href: '/api/download?platform=android',
      hideLogin: true,
    },
    WINDOWS: {
      text: 'Download for Windows',
      href: '/api/download?platform=win',
    },
    MAC: { text: 'Download for Mac', href: '/api/download?platform=osx' },
    LINUX: { text: 'Download for Linux', href: '/api/download?platform=linux' },
  };

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform;

  const devicePlatform = /iphone|ipad|ipod/.test(userAgent)
    ? 'IOS'
    : /android/.test(userAgent)
    ? 'ANDROID'
    : ['win32', 'win64', 'windows', 'wince'].includes(platform.toLowerCase())
    ? 'WINDOWS'
    : ['macintosh', 'macintel', 'macppc', 'mac68k'].includes(
        platform.toLowerCase(),
      )
    ? 'MAC'
    : /linux/.test(platform.toLowerCase())
    ? 'LINUX'
    : 'UNKNOWN';

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';

  const urls = {
    register: `${protocol}//${hostname}${port}/register`,
    login: `${protocol}//${hostname}${port}/login`,
    dashboard: `${protocol}//${hostname}${port}/channels/@me`,
  };

  const isLoggedIn = window.localStorage.getItem('token') !== null;

  const buttons = [
    {
      selector: '.open-or-signup-js',
      text: isLoggedIn ? 'Open LiventCord' : 'Sign up',
      href: isLoggedIn ? urls.dashboard : urls.register,
    },
    {
      selector: '.login-button-js',
      text: isLoggedIn ? 'Open LiventCord' : 'Login',
      href: isLoggedIn ? urls.dashboard : urls.login,
    },
    {
      selector: '.footer-open-LiventCord-button-js',
      text: isLoggedIn ? 'Open LiventCord' : 'Download',
      href: isLoggedIn
        ? urls.dashboard
        : `${protocol}//${hostname}${port}/download`,
    },
  ];

  const download = platforms[devicePlatform] || {
    text: platforms,
    href: '/download',
  };

  const downloadButtons = [
    { selector: '.download-button', text: download.text, href: download.href },
    {
      selector: '.menu-button-login',
      hidden: download.hideLogin,
      text: '',
      href: '',
    },
    {
      selector: '.ua-download-btn',
      text: 'Download',
      href: download.href,
      track: 'banner-download',
    },
    {
      selector: '.download-other',
      text: 'Download',
      href: download.href,
      track: 'other-download',
    },
    {
      selector: '.button-blue-menu',
      text: 'Download',
      href: download.href,
      track: 'menu-download',
    },
  ];

  buttons.forEach(({ selector, text, href }) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (text) el.innerText = text;
      if (href) el.href = href;
    });
  });

  downloadButtons.forEach(({ selector, text, href, hidden, track }) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (hidden !== undefined) el.hidden = hidden;
      if (text) el.innerText = text;
      if (href) el.href = href;
      if (track) {
        el.addEventListener('click', () => {
          fbq('trackCustom', 'Download', { source: track });
          rdt('track', 'Purchase');
        });
      }
    });
  });
})();

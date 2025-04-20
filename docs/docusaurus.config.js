const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'LiventCord Docs',
  tagline: 'Dinosaurs are cool',
  url: 'https://liventcord.github.io',
  baseUrl: '/LiventCord/', 
  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'liventcord',
  projectName: 'LiventCord',

  trailingSlash: false,
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          routeBasePath: '/', 
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/LiventCord/liventcord/edit/main/docs',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'LiventCord',
      logo: {
        alt: 'LiventCord Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: 'Tutorial',
        },
        {
          to: '/app/',
          label: 'App',
          position: 'left',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Tutorial',
              to: '/',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/liventcord/',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} LiventCord Project. Built with Docusaurus.`,
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
    },
  },
};

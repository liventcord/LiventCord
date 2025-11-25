// Patch explanation:
// Goal : Need to patch node_modules/@docusaurus/theme-classic/lib/theme/NotFound/Content/index.js 

// Injects this script inside react to redirect to app from docusaurus 404 page

// const fullPath = window.location.pathname + window.location.search + window.location.hash;
// window.location.href = "https://liventcord.github.io" + "/LiventCord/app?page=" + encodeURIComponent(fullPath);



const fs = require('fs')
const path = require('path')


const { execSync } = require('child_process')


const filePath = path.resolve('./node_modules/@docusaurus/theme-classic/lib/theme/NotFound/Content/index.js')

const modifiedContent = `
import React, { useEffect } from 'react';
import clsx from 'clsx';
import Translate from '@docusaurus/Translate';
import Heading from '@theme/Heading';

export default function NotFoundContent({ className }) {
  useEffect(() => {
    const fullPath = window.location.pathname + window.location.search + window.location.hash;
    window.location.href = "https://liventcord.github.io" + "/LiventCord/app?page=" + encodeURIComponent(fullPath);
  }, []);
  
  return null;
}

`.trim()

fs.writeFileSync(filePath, modifiedContent, 'utf-8')
console.log('✅ Not found page updated with redirect logic.')

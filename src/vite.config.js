import { defineConfig } from 'vite';

export default defineConfig(({mode}) => {
  const isDev = mode === 'development';

  return {

  
  root: './assets',
  base: isDev ? '/' : '/app',
  build: {
    outDir: '../wwwroot/app',
    assetsDir: 'js',
    emptyOutDir: true,
    minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
    terserOptions: {
      compress: {
        drop_console: false,
      },
      mangle: {
        toplevel: true,
      },
    },
    sourcemap: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        require('autoprefixer'),
        require('cssnano')({ preset: 'default' }),
      ],
    },
  },
  server: {
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
      '/vendor': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
      '/images': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
      '/guilds': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
    },
  }
}
});

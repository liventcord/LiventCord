import { defineConfig } from 'vite';
import eslintPlugin from 'vite-plugin-eslint';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    root: './assets',
    base: isDev ? '/' : '/app',
    build: {
      outDir: '../wwwroot/app',
      assetsDir: 'js',
      emptyOutDir: true,
      minify: isDev ? false : 'terser',
      terserOptions: {
        compress: { drop_console: !isDev },
        mangle: { toplevel: true },
      },
      sourcemap: isDev,
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
        plugins: [autoprefixer, cssnano({ preset: 'default' })],
      },
    },
    plugins: [eslintPlugin()],
    server: {
      hmr: true,
      proxy: {
        '/api': { target: 'http://localhost:5005', changeOrigin: true, secure: false },
        '/vendor': { target: 'http://localhost:5005', changeOrigin: true, secure: false },
        '/profiles': { target: 'http://localhost:5005', changeOrigin: true, secure: false },
        '/images': { target: 'http://localhost:5005', changeOrigin: true, secure: false },
        '/guilds': { target: 'http://localhost:5005', changeOrigin: true, secure: false },
        '/auth': { target: 'http://localhost:5005', changeOrigin: true, secure: false },
        '/socket': { target: 'http://localhost:5005', changeOrigin: true, secure: false, ws: true },
      },
    },
  };
});

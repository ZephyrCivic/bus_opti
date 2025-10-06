/**
 * postcss.config.cjs
 * PostCSS pipeline that wires Tailwind CSS and Autoprefixer for the Vite build.
 * Keeps processing minimal until design tokens are introduced.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

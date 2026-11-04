// Colors come from CSS variables in src/styles/theme.css — restyle the app there.
const c = (n) => `rgb(var(--c-${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), 'surface-2': c('surface-2'), line: c('line'),
        fg: c('fg'), muted: c('muted'), brand: c('brand'), 'brand-fg': c('brand-fg'),
        danger: c('danger'), ok: c('ok'), side: c('side'), 'side-fg': c('side-fg'),
      },
      borderRadius: { ui: 'var(--radius)' },
      fontFamily: { sans: 'var(--font-sans)', display: 'var(--font-display)' },
    },
  },
  plugins: [],
};

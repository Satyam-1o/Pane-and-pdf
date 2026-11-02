const VARIANTS = {
  primary: 'bg-brand text-brand-fg hover:opacity-90',
  secondary: 'bg-surface-2 text-fg hover:bg-line',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:opacity-90',
};
const SIZES = { sm: 'px-2.5 py-1 text-sm', md: 'px-3.5 py-2 text-sm', icon: 'p-2' };

export default function Button({ variant = 'secondary', size = 'md', className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-ui font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

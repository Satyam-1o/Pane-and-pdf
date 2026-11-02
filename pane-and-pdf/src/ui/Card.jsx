export default function Card({ className = '', children, ...rest }) {
  return <div className={`rounded-ui border border-line bg-surface p-4 ${className}`} {...rest}>{children}</div>;
}

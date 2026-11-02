import { ShieldCheck } from 'lucide-react';
import { PRIVACY_STATEMENT } from '../config/app';

export default function PrivacyNotice({ className = '' }) {
  return <p className={`flex items-start gap-2 text-xs ${className}`}><ShieldCheck size={14} className="mt-0.5 shrink-0" />{PRIVACY_STATEMENT}</p>;
}

import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ChainVerification({ status, verifying, onVerify }) {
  return (
    <div className="flex items-center gap-3 flex-wrap justify-end">
      {status === 'success' && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-900">
          <ShieldCheck size={14} className="text-success shrink-0" />
          <div>
            <div className="text-[11px] font-bold tracking-wide">CHAIN VERIFIED</div>
            <div className="text-[10px] text-green-700">All hashes intact — no tampering detected</div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-900">
          <ShieldAlert size={14} className="text-risk shrink-0" />
          <div>
            <div className="text-[11px] font-bold tracking-wide">INTEGRITY CHECK FAILED</div>
            <div className="text-[10px] text-red-700">Hash mismatch — chain may have been tampered</div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onVerify}
        disabled={verifying}
        className={cn(
          'flex items-center gap-1.5 h-8 px-4 text-[12px] font-semibold rounded border transition-colors',
          verifying
            ? 'text-muted-foreground border-border bg-muted cursor-not-allowed'
            : 'text-foreground border-border bg-surface hover:bg-muted'
        )}
        aria-label="Verify chain integrity"
      >
        {verifying ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <ShieldCheck size={12} />
        )}
        {verifying ? 'Verifying…' : 'Verify Chain'}
      </button>
    </div>
  );
}

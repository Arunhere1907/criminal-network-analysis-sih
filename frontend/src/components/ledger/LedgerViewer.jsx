import React, { useEffect, useState } from 'react';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchLedger, verifyLedger } from '../../api';
import { ActionBadge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import ChainVerification from './ChainVerification';
import { cn, formatTimestamp } from '../../lib/utils';

function HashDisplay({ value }) {
  const [expanded, setExpanded] = useState(false);
  if (!value || value === 'GENESIS') {
    return <span className="font-mono text-[11px] text-stone-300">—</span>;
  }
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left break-all"
      title={value}
    >
      {expanded ? value : `${value.substring(0, 12)}…`}
    </button>
  );
}

function ActorTag({ actor }) {
  const isSystem = actor === 'system';
  return (
    <span
      className={cn(
        'text-[10px] font-medium px-1.5 py-0.5 rounded-sm',
        isSystem ? 'bg-muted text-muted-foreground' : 'bg-slate-100 text-slate-700'
      )}
    >
      {isSystem ? 'System' : 'Investigator'}
    </span>
  );
}

export default function LedgerViewer() {
  const [blocks, setBlocks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const perPage = 20;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLedger(page)
      .then((res) => {
        setBlocks(res.data.blocks || res.data || []);
        setTotal(res.data.total || 0);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load audit ledger.');
      })
      .finally(() => setLoading(false));
  }, [page]);

  const handleVerify = () => {
    setVerifying(true);
    setVerifyStatus(null);
    verifyLedger()
      .then((res) => {
        setVerifyStatus(res.data.valid ? 'success' : 'error');
      })
      .catch(() => setVerifyStatus('error'))
      .finally(() => setVerifying(false));
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 min-h-12 py-2 bg-surface border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ScrollText size={14} className="text-muted-foreground shrink-0" />
          <h1 className="text-[14px] font-semibold text-foreground">Audit Ledger</h1>
          {!loading && total > 0 && (
            <span className="text-[11px] text-muted-foreground truncate">
              {total} blocks · data provenance
            </span>
          )}
        </div>
        <ChainVerification
          status={verifyStatus}
          verifying={verifying}
          onVerify={handleVerify}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="px-4 sm:px-6 py-5 space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="px-6 py-16 text-center">
            <p className="text-[13px] text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && blocks.length === 0 && (
          <div className="px-6 py-16 text-center">
            <ScrollText size={28} className="text-stone-300 mx-auto mb-3" />
            <p className="text-[13px] font-medium text-foreground">Ledger is empty</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Blocks are recorded as data is processed and investigators take actions.
            </p>
          </div>
        )}

        {!loading && !error && blocks.length > 0 && (
          <>
            <div className="min-w-[860px]">
              <div className="px-4 sm:px-6 py-2 grid grid-cols-[48px_150px_1fr_90px_110px_1fr_1fr] gap-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-surface sticky top-0 z-10">
                <span>#</span>
                <span>Timestamp</span>
                <span>Action</span>
                <span>Actor</span>
                <span>Reference</span>
                <span>Hash</span>
                <span>Previous Hash</span>
              </div>

              <div className="divide-y divide-border">
                {blocks.map((block, i) => (
                  <div
                    key={block.block_id ?? i}
                    className="px-4 sm:px-6 py-3 grid grid-cols-[48px_150px_1fr_90px_110px_1fr_1fr] gap-3 items-center hover:bg-surface/80"
                  >
                    <span className="text-[12px] font-mono text-muted-foreground">
                      {block.block_id}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatTimestamp(block.timestamp)}
                    </span>
                    <ActionBadge action={block.action} />
                    <ActorTag actor={block.actor} />
                    <span className="font-mono text-[11px] text-foreground/80 truncate">
                      {block.ref || '—'}
                    </span>
                    <HashDisplay value={block.hash} />
                    <HashDisplay value={block.prev_hash} />
                  </div>
                ))}
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-4 border-t border-border sticky bottom-0 bg-background">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 h-8 px-3 text-[12px] text-muted-foreground border border-border rounded bg-surface hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft size={12} /> Previous
                </button>
                <span className="text-[12px] text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 h-8 px-3 text-[12px] text-muted-foreground border border-border rounded bg-surface hover:bg-muted disabled:opacity-40"
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

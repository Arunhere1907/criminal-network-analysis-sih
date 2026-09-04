import React, { useEffect, useState } from 'react';
import { UsersRound, ChevronRight, Network } from 'lucide-react';
import { fetchCommunities } from '../../api';
import { RoleBadge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { cn, formatRole } from '../../lib/utils';

const COMMUNITY_COLORS = [
  '#1E3A5F', '#57534E', '#047857', '#B45309', '#9F1239',
  '#334155', '#78716C', '#166534', '#92400E', '#7F1D1D',
];

function getRolesSummary(members) {
  const counts = {};
  members.forEach((m) => {
    const role = typeof m === 'object' ? m.role : 'unknown';
    counts[role] = (counts[role] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
}

export default function Communities({ onViewInGraph }) {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchCommunities()
      .then((res) => {
        const comms = res.data.communities || res.data || [];
        setCommunities(comms);
        if (comms.length > 0) setSelected(comms[0]);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load community data.');
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedIdx = communities.findIndex(
    (c) => c.community_id === selected?.community_id
  );
  const accentColor = COMMUNITY_COLORS[Math.max(0, selectedIdx) % COMMUNITY_COLORS.length];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 sm:px-6 h-12 bg-surface border-b border-border shrink-0">
        <UsersRound size={14} className="text-muted-foreground" />
        <h1 className="text-[14px] font-semibold text-foreground">Communities</h1>
        {!loading && (
          <span className="text-[11px] text-muted-foreground ml-1">
            {communities.length} detected via Louvain
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="md:w-56 shrink-0 bg-surface border-b md:border-b-0 md:border-r border-border overflow-y-auto max-h-40 md:max-h-none">
          {loading && (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="p-4 text-[12px] text-muted-foreground">{error}</div>
          )}

          {!loading && !error && communities.length === 0 && (
            <div className="p-4 text-[12px] text-muted-foreground">No communities detected.</div>
          )}

          {!loading &&
            !error &&
            communities.map((comm, idx) => {
              const color = COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length];
              const isActive = selected?.community_id === comm.community_id;
              const memberCount = comm.members?.length || 0;
              const roles = getRolesSummary(comm.members || []);

              return (
                <button
                  key={comm.community_id ?? idx}
                  type="button"
                  onClick={() => setSelected(comm)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border/60 transition-colors',
                    isActive ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span
                      className={cn(
                        'text-[12px] font-semibold',
                        isActive ? 'text-foreground' : 'text-foreground/80'
                      )}
                    >
                      Community {comm.community_id}
                    </span>
                    {isActive && (
                      <ChevronRight size={12} className="text-muted-foreground ml-auto" />
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground ml-4">
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    {roles[0] && ` · ${formatRole(roles[0][0])}`}
                  </div>
                </button>
              );
            })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          )}

          {!loading && !selected && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Network size={28} className="text-stone-300 mb-3" />
              <p className="text-[13px] text-muted-foreground">
                Select a community to view members
              </p>
            </div>
          )}

          {!loading && selected && (() => {
            const members = selected.members || [];
            const roles = getRolesSummary(members);
            const memberIds = members.map((m) =>
              typeof m === 'object' ? m.node_id : m
            );

            return (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: accentColor }}
                      />
                      <h2 className="text-[16px] font-semibold text-foreground">
                        Community {selected.community_id}
                      </h2>
                    </div>
                    <p className="text-[12px] text-muted-foreground ml-5">
                      {members.length} members · Louvain community detection
                    </p>
                  </div>
                  {onViewInGraph && memberIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onViewInGraph(memberIds.slice(0, 12))}
                      className="h-8 px-3 text-[12px] font-medium border border-border rounded bg-surface hover:bg-muted inline-flex items-center gap-1.5"
                    >
                      <Network size={12} />
                      Highlight in graph
                    </button>
                  )}
                </div>

                {roles.length > 0 && (
                  <div className="mb-6 pb-5 border-b border-border">
                    <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                      Dominant roles
                    </p>
                    <div className="space-y-1.5 max-w-md">
                      {roles.map(([role, count]) => {
                        const pct = Math.round((count / members.length) * 100);
                        return (
                          <div key={role} className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground w-20">
                              {formatRole(role)}
                            </span>
                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: accentColor }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground w-6 text-right">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                    Members
                  </p>
                  <div className="divide-y divide-border border border-border bg-surface">
                    {members.map((member, i) => {
                      const isObj = typeof member === 'object';
                      const nodeId = isObj ? member.node_id : member;
                      const name = isObj ? member.names?.[0] || nodeId : member;
                      const role = isObj ? member.role : null;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-2.5 px-3 text-[12px]"
                        >
                          <span className="font-medium text-foreground flex-1 truncate">
                            {name}
                          </span>
                          {nodeId !== name && (
                            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                              {nodeId}
                            </span>
                          )}
                          {role && <RoleBadge role={role} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

<script lang="ts">
  import type { CategoryStat, Status } from '../lib/budget'
  import { formatEUR, formatEURRounded } from '../lib/money'

  let { stat, elapsed }: { stat: CategoryStat; elapsed: number } = $props()

  const STATUS_LABEL: Record<Status, string> = {
    ok: '',
    pace: 'Rythme élevé',
    warn: 'Bientôt atteint',
    over: 'Dépassé',
  }

  const fill = $derived(stat.budget > 0 ? Math.min(1, stat.spent / stat.budget) : stat.spent > 0 ? 1 : 0)
</script>

<div class="row">
  <div class="head">
    <span class="name"><span class="emoji" aria-hidden="true">{stat.category.emoji}</span>{stat.category.name}</span>
    <span class="remaining {stat.status}">
      {#if stat.remaining >= 0}
        reste <b>{formatEURRounded(stat.remaining)}</b>
      {:else}
        <b>+{formatEURRounded(-stat.remaining)}</b> de trop
      {/if}
    </span>
  </div>
  <div
    class="bar"
    role="meter"
    aria-valuemin="0"
    aria-valuemax={stat.budget}
    aria-valuenow={stat.spent}
    aria-label={`${stat.category.name} : ${formatEUR(stat.spent)} dépensés sur ${formatEUR(stat.budget)}`}
  >
    <div class="fill {stat.status}" style:width="{fill * 100}%"></div>
    {#if elapsed > 0 && elapsed < 1 && stat.budget > 0}
      <div class="marker" style:left="{elapsed * 100}%" title="Rythme prévu à ce jour"></div>
    {/if}
  </div>
  <div class="foot">
    <span>{formatEURRounded(stat.spent)} / {formatEURRounded(stat.budget)}</span>
    {#if STATUS_LABEL[stat.status]}<span class="tag {stat.status}">{STATUS_LABEL[stat.status]}</span>{/if}
  </div>

  {#if stat.subs.some((r) => r.spent !== 0 || r.budget !== null)}
    <ul class="subs">
      {#each stat.subs as r (r.sub?.id ?? 'none')}
        {#if r.spent !== 0 || r.budget !== null}
          <li>
            <div class="subhead">
              <span>{r.sub ? `${r.sub.emoji} ${r.sub.name}` : 'Sans précision'}</span>
              {#if r.budget !== null && r.remaining !== null}
                <span class="remaining {r.status}">
                  {#if r.remaining >= 0}reste <b>{formatEURRounded(r.remaining)}</b>{:else}<b>+{formatEURRounded(-r.remaining)}</b> de trop{/if}
                </span>
              {:else}
                <!-- Négatif = plus de remboursements que de dépenses dans cette sous-catégorie -->
                <span class="spent" class:in={r.spent < 0}>{r.spent < 0 ? `+${formatEURRounded(-r.spent)}` : formatEURRounded(r.spent)}</span>
              {/if}
            </div>
            {#if r.budget !== null}
              <div class="bar small">
                <div
                  class="fill {r.status}"
                  style:width="{r.budget > 0 ? Math.min(1, r.spent / r.budget) * 100 : r.spent > 0 ? 100 : 0}%"
                ></div>
                {#if elapsed > 0 && elapsed < 1 && r.budget > 0}
                  <div class="marker" style:left="{elapsed * 100}%"></div>
                {/if}
              </div>
            {/if}
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</div>

<style>
  .row {
    display: grid;
    gap: 6px;
    padding: 12px 0;
    border-top: 1px solid var(--line);
  }
  .row:first-child {
    border-top: none;
  }
  .head,
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .name {
    display: flex;
    gap: 8px;
    font-weight: 600;
  }
  .emoji {
    width: 1.4em;
    text-align: center;
  }
  .remaining {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .remaining b {
    color: var(--text);
  }
  .remaining.over b {
    color: var(--danger);
  }
  .bar {
    position: relative;
    height: 10px;
    border-radius: 999px;
    background: var(--track);
    overflow: visible;
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background: var(--ok);
    transition: width 0.3s ease;
  }
  .fill.pace,
  .fill.warn {
    background: var(--warn);
  }
  .fill.over {
    background: var(--danger);
  }
  .marker {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    margin-left: -1px;
    border-radius: 1px;
    background: var(--text);
    opacity: 0.55;
  }
  .foot {
    font-size: 0.8rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .tag {
    font-weight: 600;
  }
  .subs {
    list-style: none;
    margin: 4px 0 0 2.2em;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .subhead {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.85rem;
  }
  .subhead .remaining,
  .spent {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .spent.in {
    color: var(--ok);
  }
  .bar.small {
    height: 6px;
    margin-top: 3px;
  }
  .tag.pace,
  .tag.warn {
    color: var(--warn);
  }
  .tag.over {
    color: var(--danger);
  }
</style>

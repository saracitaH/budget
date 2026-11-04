<script lang="ts">
  import { monthLabel } from '../lib/dates'

  let {
    monthId,
    months,
    onmonth,
  }: {
    monthId: string
    /** Mois consultables, triés du plus ancien au plus récent (le dernier = mois en cours) */
    months: string[]
    onmonth: (id: string) => void
  } = $props()

  const i = $derived(months.indexOf(monthId))
  const prev = $derived(i > 0 ? months[i - 1] : null)
  const next = $derived(i >= 0 && i < months.length - 1 ? months[i + 1] : null)
</script>

<div class="nav">
  <button type="button" disabled={!prev} onclick={() => prev && onmonth(prev)} aria-label="Mois précédent">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
  </button>
  <h1>{monthLabel(monthId)}</h1>
  <button type="button" disabled={!next} onclick={() => next && onmonth(next)} aria-label="Mois suivant">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
  </button>
</div>

<style>
  .nav {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  h1 {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  h1::first-letter {
    text-transform: uppercase;
  }
  button {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--field);
    color: var(--text);
  }
  button:first-child {
    margin-left: -4px;
  }
  button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

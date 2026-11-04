<script lang="ts">
  // Jauge en demi-cercle : un indicateur, une valeur, une couleur d'état toujours accompagnée d'un texte.
  let {
    value,
    label,
    caption,
    tone,
    status,
  }: {
    /** 0 à 1 (au-delà, la jauge reste pleine et le pourcentage affiché dit la vérité) */
    value: number
    label: string
    caption: string
    tone: 'ok' | 'warn' | 'over'
    /** Texte de l'état, pour ne jamais dépendre de la couleur seule */
    status: string
  } = $props()

  const pct = $derived(Math.round(value * 100))
  const fill = $derived(Math.max(0, Math.min(1, value)) * 100)
  const ARC = 'M 10 50 A 40 40 0 0 1 90 50'
</script>

<div class="gauge" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct} aria-label={`${label} : ${pct} %, ${status}`}>
  <span class="label">{label}</span>
  <svg viewBox="0 0 100 56" aria-hidden="true">
    <path d={ARC} class="track" pathLength="100" />
    {#if fill > 0}
      <path d={ARC} class="value {tone}" pathLength="100" stroke-dasharray="{fill} 100" />
    {/if}
  </svg>
  <span class="pct">{pct} %</span>
  <span class="status {tone}">{status}</span>
  <span class="caption">{caption}</span>
</div>

<style>
  .gauge {
    display: grid;
    justify-items: center;
    text-align: center;
    min-width: 0;
  }
  .label {
    font-size: 0.8rem;
    color: var(--muted);
  }
  svg {
    width: 100%;
    max-width: 150px;
    margin-top: 4px;
  }
  path {
    fill: none;
    stroke-width: 9;
    stroke-linecap: round;
  }
  .track {
    stroke: var(--track);
  }
  .value {
    stroke: var(--ok);
    transition: stroke-dasharray 0.4s ease;
  }
  .value.warn {
    stroke: var(--warn);
  }
  .value.over {
    stroke: var(--danger);
  }
  .pct {
    margin-top: -30px;
    font-size: 1.4rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .status {
    margin-top: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ok);
  }
  .status.warn {
    color: var(--warn);
  }
  .status.over {
    color: var(--danger);
  }
  .caption {
    font-size: 0.8rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>

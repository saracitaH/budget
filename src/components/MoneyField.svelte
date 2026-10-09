<script lang="ts">
  import { centsToInput, parseAmount } from '../lib/money'

  let {
    value = $bindable(0),
    placeholder = '0',
    ariaLabel,
    onchange,
  }: {
    value?: number
    placeholder?: string
    ariaLabel?: string
    /** Appelé à la sortie du champ si la valeur a changé */
    onchange?: (cents: number) => void
  } = $props()

  let text = $state('')
  let focused = $state(false)
  let invalid = $state(false)
  let valueAtFocus = 0

  // Reflète les changements externes (ex. « Proposer une répartition ») hors saisie
  $effect(() => {
    const v = value
    if (!focused) text = centsToInput(v)
  })

  function oninput() {
    const cents = parseAmount(text)
    invalid = cents === null
    if (cents !== null) value = cents
  }

  function onfocus() {
    focused = true
    valueAtFocus = value
  }

  function onblur() {
    focused = false
    invalid = false
    text = centsToInput(value)
    if (value !== valueAtFocus) onchange?.(value)
  }
</script>

<label class="money" class:invalid>
  <input
    type="text"
    inputmode="decimal"
    autocomplete="off"
    enterkeyhint="done"
    bind:value={text}
    {placeholder}
    aria-label={ariaLabel}
    {onfocus}
    {oninput}
    {onblur}
    onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
  />
  <span aria-hidden="true">€</span>
</label>

<style>
  .money {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--field);
    border-radius: 10px;
    padding: 0 12px;
    min-width: 0;
  }
  .money.invalid {
    outline: 2px solid var(--danger);
  }
  input {
    width: 100%;
    min-width: 0;
    height: 44px;
    border: none;
    background: transparent;
    color: var(--text);
    text-align: right;
    font-variant-numeric: tabular-nums;
    outline: none;
  }
  span {
    color: var(--muted);
  }
</style>

<script lang="ts">
  import type { KeypadKey } from '../lib/money'

  let { onkey }: { onkey: (key: KeypadKey) => void } = $props()

  const keys: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back']
</script>

<div class="keypad">
  {#each keys as key (key)}
    <button
      type="button"
      class:fn={key === 'back' || key === ','}
      aria-label={key === 'back' ? 'Effacer' : key === ',' ? 'Virgule' : key}
      onclick={() => onkey(key)}
    >
      {#if key === 'back'}
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path
            d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7z M12.5 9.5l5 5 M17.5 9.5l-5 5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {:else}
        {key}
      {/if}
    </button>
  {/each}
</div>

<style>
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  button {
    height: clamp(44px, 6.4dvh, 56px);
    border-radius: 12px;
    background: var(--key);
    color: var(--text);
    font-size: 1.55rem;
    font-weight: 500;
    display: grid;
    place-items: center;
    user-select: none;
    -webkit-user-select: none;
  }
  button.fn {
    background: transparent;
  }
  button:active {
    background: var(--key-active);
  }
</style>

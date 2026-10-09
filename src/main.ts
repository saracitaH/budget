import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initUpdates } from './lib/update.svelte'

initUpdates()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app

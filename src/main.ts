import { Notice, Plugin, normalizePath } from 'obsidian';
import { loadWasm } from './wasm_loader';

export default class DailyNoteCopierPlugin extends Plugin {
	private wasmReady = false;

	async onload() {
		await this.initWasm();

		// Example command that calls a Go-exported function.
		// Replace with your real plugin commands once you've added Go logic.
		this.addCommand({
			id: 'test-go-wasm',
			name: 'Test Go WASM',
			callback: () => {
				if (!this.wasmReady) {
					new Notice('Go WASM is not loaded yet.');
					return;
				}
				const result = goGreet('Obsidian');
				new Notice(result);
			},
		});

		console.log('Daily Note Copier: loaded');
	}

	onunload() {
		console.log('Daily Note Copier: unloaded');
	}

	private async initWasm() {
		try {
			const wasmPath = normalizePath(
				`${this.app.vault.configDir}/plugins/${this.manifest.id}/plugin.wasm`
			);
			const buffer = await this.app.vault.adapter.readBinary(wasmPath);
			await loadWasm(buffer);
			this.wasmReady = true;
			console.log('Daily Note Copier: Go WASM ready');
		} catch (err) {
			console.error('Daily Note Copier: failed to load WASM –', err);
		}
	}
}

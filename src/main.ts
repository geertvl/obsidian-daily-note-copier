import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { loadWasm } from './wasm_loader';

export default class DailyNoteCopierPlugin extends Plugin {
	private wasmReady = false;

	async onload() {
		await this.initWasm();

		this.addCommand({
			id: 'sync-long-todos',
			name: 'Sync [LONG] TODOs to TODO.md',
			callback: () => this.syncLongTodos(),
		});

		console.log('Daily Note Copier: loaded');
	}

	onunload() {
		console.log('Daily Note Copier: unloaded');
	}

	private async syncLongTodos() {
		if (!this.wasmReady) {
			new Notice('Go WASM is not loaded yet.');
			return;
		}

		const folder = this.getNotesFolder();
		if (!folder) {
			new Notice('Could not determine the daily notes folder. Open a daily note first.');
			return;
		}

		// Collect all daily note files, excluding TODO.md itself.
		const files = folder.children
			.filter((f): f is TFile =>
				f instanceof TFile && f.extension === 'md' && f.name !== 'TODO.md'
			)
			.sort((a, b) => b.name.localeCompare(a.name)); // newest first

		const sections: string[] = [];

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const todos = JSON.parse(goExtractLongTodos(content)) as string[];
			if (todos.length > 0) {
				sections.push(`## ${file.basename}\n\n${todos.join('\n')}`);
			}
		}

		const todoPath = normalizePath(
			folder.isRoot() ? 'TODO.md' : `${folder.path}/TODO.md`
		);

		if (sections.length === 0) {
			new Notice('No [LONG] TODOs found in daily notes.');
			return;
		}

		const output =
			`# Long-term TODOs\n\n` +
			`> Auto-generated — run "Sync [LONG] TODOs" to refresh.\n\n` +
			sections.join('\n\n');

		const existing = this.app.vault.getAbstractFileByPath(todoPath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, output);
		} else {
			await this.app.vault.create(todoPath, output);
		}

		new Notice(`TODO.md updated — ${sections.length} note(s) with [LONG] items.`);
	}

	private getNotesFolder(): TFolder | null {
		// 1. Use the folder of whichever note is currently open.
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile?.parent) return activeFile.parent;

		// 2. Fall back to the Daily Notes core plugin's configured folder.
		const plugin = (this.app as any).internalPlugins?.plugins?.['daily-notes'];
		const configuredPath = plugin?.instance?.options?.folder?.trim();
		if (configuredPath) {
			const folder = this.app.vault.getAbstractFileByPath(configuredPath);
			if (folder instanceof TFolder) return folder;
		}

		// 3. Fall back to vault root.
		return this.app.vault.getRoot();
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

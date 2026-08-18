import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { loadWasm } from './wasm_loader';

export default class DailyNoteCopierPlugin extends Plugin {
	private wasmReady = false;

	async onload() {
		await this.initWasm();

		this.addCommand({
			id: 'sync-todos',
			name: 'Sync daily note TODOs',
			callback: () => this.syncTodos(),
		});

		console.log('Daily Note Copier: loaded');
	}

	onunload() {
		console.log('Daily Note Copier: unloaded');
	}

	private async syncTodos() {
		if (!this.wasmReady) {
			new Notice('Go WASM is not loaded yet.');
			return;
		}

		const folder = this.getNotesFolder();
		if (!folder) {
			new Notice('Could not determine the daily notes folder. Open a daily note first.');
			return;
		}

		const files = folder.children
			.filter((f): f is TFile =>
				f instanceof TFile &&
				f.extension === 'md' &&
				f.name !== 'TODO.md' &&
				f.name !== 'Admin.md'
			)
			.sort((a, b) => b.name.localeCompare(a.name)); // newest first

		const longSections: string[] = [];
		const ppSections: string[] = [];
		const toArchive: TFile[] = [];

		for (const file of files) {
			// Skip notes already transferred.
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.status === 'archived') continue;

			const content = await this.app.vault.read(file);
			const link = `[[${file.basename}]]`;
			const longTodos = (JSON.parse(goExtractByTag(content, '[LT]')) as string[])
				.map(line => `${line} ${link}`);
			const ppTodos = (JSON.parse(goExtractByTag(content, '[PP]')) as string[])
				.map(line => `${line} ${link}`);

			if (longTodos.length > 0)
				longSections.push(longTodos.join('\n'));
			if (ppTodos.length > 0)
				ppSections.push(ppTodos.join('\n'));
			if (longTodos.length > 0 || ppTodos.length > 0)
				toArchive.push(file);
		}

		if (longSections.length === 0 && ppSections.length === 0) {
			new Notice('No new TODOs found in daily notes.');
			return;
		}

		const base = folder.isRoot() ? '' : folder.path;

		if (longSections.length > 0)
			await this.appendToFile(
				normalizePath(base ? `${base}/TODO.md` : 'TODO.md'),
				longSections,
				'Long-term TODOs'
			);

		if (ppSections.length > 0)
			await this.appendToFile(
				normalizePath(base ? `${base}/Admin.md` : 'Admin.md'),
				ppSections,
				'Admin Work'
			);

		for (const file of toArchive) {
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				fm.status = 'archived';
			});
		}

		const updated = [
			longSections.length > 0 ? 'TODO.md' : '',
			ppSections.length  > 0 ? 'Admin.md' : '',
		].filter(Boolean).join(' & ');

		new Notice(`${updated} updated — ${toArchive.length} note(s) archived.`);
	}

	private async appendToFile(path: string, sections: string[], title: string) {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			const current = await this.app.vault.read(existing);
			await this.app.vault.modify(
				existing,
				current.trimEnd() + '\n' + sections.join('\n') + '\n'
			);
		} else {
			await this.app.vault.create(
				path,
				`# ${title}\n\n` + sections.join('\n') + '\n'
			);
		}
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

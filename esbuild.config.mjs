import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';
import path from 'path';

const prod = process.argv[2] === 'production';

const vaultPluginDir = process.env.VAULT_PATH
	? path.join(process.env.VAULT_PATH, '.obsidian', 'plugins', 'obsidian-daily-note-copier')
	: null;

// In dev mode, write main.js directly into the vault plugin directory so
// Obsidian's own file watcher triggers Hot Reload on every rebuild.
// In production, write to build/ for distribution.
const outfile = (!prod && vaultPluginDir)
	? path.join(vaultPluginDir, 'main.js')
	: 'build/main.js';

const context = await esbuild.context({
	entryPoints: ['src/main.ts'],
	bundle: true,
	// wasm_exec.js is injected first so the global `Go` class is available
	// before any plugin code runs.  build.ps1 copies it to src/ before this runs.
	inject: ['./src/wasm_exec.js'],
	external: [
		'obsidian',
		'electron',
		'@codemirror/autocomplete',
		'@codemirror/collab',
		'@codemirror/commands',
		'@codemirror/language',
		'@codemirror/lint',
		'@codemirror/search',
		'@codemirror/state',
		'@codemirror/view',
		'@lezer/common',
		'@lezer/highlight',
		'@lezer/lr',
		...builtins,
	],
	format: 'cjs',
	target: 'es2018',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile,
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}

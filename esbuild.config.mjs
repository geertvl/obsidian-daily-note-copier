import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';

const prod = process.argv[2] === 'production';

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
	outfile: 'build/main.js',
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	// Watch mode: rebuilds automatically on source changes.
	await context.watch();
}

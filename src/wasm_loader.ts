/**
 * Loads the Go WASM binary and waits until Go's main() has registered
 * all exported functions.  Call this once during plugin initialisation.
 *
 * The `Go` class is made available globally by wasm_exec.js, which esbuild
 * injects at the top of the bundle (see esbuild.config.mjs).
 */
export async function loadWasm(buffer: ArrayBuffer): Promise<void> {
	const go = new Go();

	// Promise that resolves when Go calls __goWasmResolve() at the end of main().
	const ready = new Promise<void>((resolve) => {
		(globalThis as any).__goWasmResolve = resolve;
	});

	const { instance } = await WebAssembly.instantiate(buffer, go.importObject);

	// go.run() never resolves while the WASM instance is alive — don't await it.
	go.run(instance);

	await ready;
}

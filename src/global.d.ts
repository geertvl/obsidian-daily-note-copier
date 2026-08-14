// Type declarations for the Go WASM runtime (wasm_exec.js).
// This file is injected into the bundle by esbuild — no direct import needed.
declare class Go {
	argv: string[];
	env: Record<string, string>;
	exit: (code: number) => void;
	importObject: WebAssembly.Imports;
	run(instance: WebAssembly.Instance): Promise<void>;
}

// Exported Go functions — extend as you add more in go/main.go.

/** Returns a JSON-encoded string[] of lines containing "[LONG]". */
declare function goExtractLongTodos(markdownContent: string): string;

// Internal readiness hook used by wasm_loader.ts.
interface Window {
	__goWasmResolve?: () => void;
}

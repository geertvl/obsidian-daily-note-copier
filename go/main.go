//go:build js && wasm

package main

import (
	"fmt"
	"syscall/js"
)

// greet is an example Go function callable from JavaScript.
// Replace or extend this with your actual plugin logic.
func greet(this js.Value, args []js.Value) any {
	name := "World"
	if len(args) > 0 && args[0].Type() == js.TypeString {
		name = args[0].String()
	}
	return fmt.Sprintf("Hello, %s! (from Go WASM v3)", name)
}

func main() {
	// Register exported functions on the global JS object.
	// Add more js.Global().Set(...) calls here as your plugin grows.
	js.Global().Set("goGreet", js.FuncOf(greet))

	// Signal to the TypeScript side that Go is initialised and all
	// exported functions are registered.
	if resolve := js.Global().Get("__goWasmResolve"); resolve.Type() == js.TypeFunction {
		resolve.Invoke()
	}

	// Block forever — the WASM instance must stay alive for JS callbacks.
	select {}
}

//go:build js && wasm

package main

import (
	"encoding/json"
	"strings"
	"syscall/js"
)

func isCompleted(line string) bool {
	trimmed := strings.TrimLeft(line, " \t")
	return strings.HasPrefix(trimmed, "- [x]") || strings.HasPrefix(trimmed, "- [X]")
}

// extractByTag scans markdown content and returns a JSON array of every line
// that contains the given tag string and is not a completed checkbox.
func extractByTag(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return "[]"
	}
	content := args[0].String()
	tag := args[1].String()
	lines := make([]string, 0)
	for _, line := range strings.Split(content, "\n") {
		if strings.Contains(line, tag) && !isCompleted(line) {
			lines = append(lines, strings.TrimRight(line, " \t\r"))
		}
	}
	result, _ := json.Marshal(lines)
	return string(result)
}

func main() {
	js.Global().Set("goExtractByTag", js.FuncOf(extractByTag))

	if resolve := js.Global().Get("__goWasmResolve"); resolve.Type() == js.TypeFunction {
		resolve.Invoke()
	}

	select {}
}

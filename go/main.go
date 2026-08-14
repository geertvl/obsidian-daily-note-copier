//go:build js && wasm

package main

import (
	"encoding/json"
	"strings"
	"syscall/js"
)

// extractLongTodos scans markdown content and returns a JSON array of every
// line that contains "[LONG]", with trailing whitespace trimmed.
func extractLongTodos(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return "[]"
	}
	content := args[0].String()
	var todos []string
	for _, line := range strings.Split(content, "\n") {
		if strings.Contains(line, "[LONG]") {
			todos = append(todos, strings.TrimRight(line, " \t\r"))
		}
	}
	result, _ := json.Marshal(todos)
	return string(result)
}

func main() {
	js.Global().Set("goExtractLongTodos", js.FuncOf(extractLongTodos))

	if resolve := js.Global().Get("__goWasmResolve"); resolve.Type() == js.TypeFunction {
		resolve.Invoke()
	}

	select {}
}

#!/bin/bash
# Hexagonal architecture guard: domain/ files must not import external frameworks.
# Triggered on PostToolUse for Edit/Write. Exit 2 sends stderr back to Claude.

set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path","") or "")')

[[ -z "$file_path" ]] && exit 0
[[ "$file_path" == *"/src/main/kotlin/"*"/domain/"*.kt ]] || exit 0
[[ -f "$file_path" ]] || exit 0

forbidden='^import[[:space:]]+(org\.springframework|jakarta\.|org\.jooq|io\.r2dbc|kotlinx\.coroutines\.reactor|org\.flywaydb|reactor\.core|com\.fasterxml\.jackson)'

violations=$(grep -nE "$forbidden" "$file_path" || true)

if [[ -n "$violations" ]]; then
  {
    echo "Hexagonal architecture violation in $file_path"
    echo ""
    echo "domain/ must have zero external framework dependencies (CLAUDE.md rule)."
    echo "Forbidden imports found:"
    echo "$violations"
    echo ""
    echo "Move framework-dependent code to application/ or adapter/ layers."
  } >&2
  exit 2
fi

exit 0

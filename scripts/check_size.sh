#!/bin/bash

# List all GGUFs in the project's models directory with sizes, sorted largest first
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL_DIR="$SCRIPT_DIR/../models"

if [ ! -d "$MODEL_DIR" ]; then
    echo "Directory not found: $MODEL_DIR" >&2
    exit 1
fi

for f in "$MODEL_DIR"/*.gguf; do
    [ -f "$f" ] || continue
    size=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
    printf "%s\t%s\n" "$size" "$(basename "$f")"
done | sort -rn | awk -F '\t' '
function repeat_char(ch, count,    out, i) {
    out = ""
    for (i = 0; i < count; i++) {
        out = out ch
    }
    return out
}
function print_border(left, mid, right, w1, w2) {
    printf "%s%s%s%s%s\n", left, repeat_char("-", w1 + 2), mid, repeat_char("-", w2 + 2), right
}
{
    size_mb = $1 / 1024 / 1024
    if (size_mb >= 1024) {
        size_str = sprintf("%.2f GB", size_mb / 1024)
    } else {
        size_str = sprintf("%.2f MB", size_mb)
    }

    rows++
    names[rows] = $2
    sizes[rows] = size_str

    if (length($2) > name_w) {
        name_w = length($2)
    }
    if (length(size_str) > size_w) {
        size_w = length(size_str)
    }
}
END {
    if (length("Filename") > name_w) {
        name_w = length("Filename")
    }
    if (length("Size") > size_w) {
        size_w = length("Size")
    }
    if (rows == 0 && length("No .gguf files found") > name_w) {
        name_w = length("No .gguf files found")
    }

    print_border("+", "+", "+", name_w, size_w)
    printf "| %-*s | %-*s |\n", name_w, "Filename", size_w, "Size"
    print_border("+", "+", "+", name_w, size_w)

    if (rows == 0) {
        printf "| %-*s | %-*s |\n", name_w, "No .gguf files found", size_w, "-"
    } else {
        for (i = 1; i <= rows; i++) {
            printf "| %-*s | %*s |\n", name_w, names[i], size_w, sizes[i]
        }
    }

    print_border("+", "+", "+", name_w, size_w)
}'

# Local type assets

Manrope is the approved interface face. `manrope-variable.woff2` is copied unchanged from `context/lanrith-brand/assets/fonts/manrope-latin-variable.woff2`, has a 200–800 weight range, and uses `OFL-manrope.txt` from the supplied brand licence. The interface uses 400/500/600 weights and a 16px body scale.

IBM Plex Mono 400/500 (Latin subset) uses `OFL-mono.txt`. Unused legacy IBM Plex Sans 400/500/600 binaries remain available with their own correct `OFL-plex-sans.txt`; `OFL-sans.txt` is a compatibility copy of that licence. The Sans licence is restored from `https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans@5.3.0/LICENSE`, matching the original Fontsource package. Neither Sans nor Manrope may use the other family’s licence.

Runtime references are relative and local. Other scripts use the declared system fallbacks; this draft does not include full multilingual coverage.

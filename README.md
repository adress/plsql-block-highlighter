# PL/SQL Block Highlighter

A VS Code extension that highlights the structural keywords of the innermost PL/SQL block containing the cursor — with **soft colour-coding by nesting depth**.

Move the cursor inside any block and its frame keywords light up instantly. Deeper blocks use a different colour so you can visually orient yourself inside complex nested code without any visual noise from other parts of the file.

---

## Supported structures

| Structure | Opening | Middle | Closing |
|-----------|---------|--------|---------|
| Anonymous / named block | `BEGIN` (+ optional `DECLARE`) | `EXCEPTION` | `END` |
| IF statement | `IF` | `ELSIF`, `ELSE` | `END IF` |
| LOOP / FOR / WHILE | `LOOP` | — | `END LOOP` |
| CASE statement | `CASE` | `WHEN`, `ELSE` | `END` (or `END CASE`) |

> **CASE expressions are ignored.** `CASE` is only detected as a block when it
> is a statement, not when it appears after `:=`, `=`, `(`, `RETURN`, `IN`, `,`
> or any other operator.

---

## Visual behaviour

- **Active block** — the innermost block containing the cursor is highlighted with a 2 px underline.
- **Parent block** — the immediate parent is highlighted with a dimmer 1 px underline.
- **No other blocks** are touched — zero visual noise on the rest of the file.
- **Colours by nesting level** (modulo 5, works on both dark and light themes):

| Level | Colour |
|-------|--------|
| 0 | Blue |
| 1 | Green |
| 2 | Amber |
| 3 | Purple |
| 4 | Teal |

---

## Examples

### Simple block

```sql
DECLARE                       -- highlighted (cursor is here)
  v_count NUMBER;
BEGIN                         -- highlighted
  NULL;
EXCEPTION                     -- highlighted
  WHEN OTHERS THEN NULL;
END;                          -- highlighted
```

### Nested IF inside BEGIN

```sql
BEGIN                           -- dim parent underline
  IF v_count > 0 THEN           -- active underline (cursor inside)
    NULL;                       -- ← cursor here
  ELSIF v_count = 0 THEN        -- active underline
    NULL;
  END IF;                       -- active underline (both END and IF)
END;
```

### FOR loop and CASE

```sql
BEGIN
  FOR i IN 1 .. 10 LOOP         -- active underline (LOOP keyword)
    CASE i                      -- would be active if cursor were here
      WHEN 1 THEN NULL;
      WHEN 2 THEN NULL;
      ELSE NULL;
    END;                        -- closes the CASE
  END LOOP;
END;
```

---

## Installation (development)

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18.x or later |
| npm | 9.x or later |
| VS Code | 1.85.0 or later |

### Steps

```bash
git clone <repo-url>
cd plsql-block-highlighter
npm install
npm run compile
```

---

## Testing in VS Code

### Extension Development Host (recommended)

1. Open the project folder: `File > Open Folder…`
2. Press **F5** (or `Run > Start Debugging`)
3. A second VS Code window opens — **[Extension Development Host]**
4. Open any `.sql` / `.pls` file and move the cursor
5. Block keywords highlight automatically

> The `watch` build task starts automatically; reload the Extension Development
> Host with **Ctrl+R** / **Cmd+R** after source changes.

### Via command line

```bash
npm run compile
code --extensionDevelopmentPath=$(pwd) .
```

---

## Running the tests

```bash
# Run all unit tests (no VS Code required)
npm test

# Watch mode
npm run test:unit:watch

# With coverage report
npm run test:unit:coverage
```

Expected output:

```
 ✓ test/unit/scanner/tokenizer.test.ts         (25 tests)
 ✓ test/unit/parser/blockParser.test.ts        (30 tests)
 ✓ test/unit/resolver/blockResolver.test.ts    (17 tests)
 ✓ test/unit/application/highlightService.test.ts (18 tests)

 Test Files  4 passed (4)
      Tests  90 passed (90)
```

---

## Commands

| Command | Description |
|---------|-------------|
| **PL/SQL: Show PL/SQL Structure Tree** | Prints the parsed block tree for the active document in the *PL/SQL Structure* Output Channel. Useful for debugging or understanding complex PL/SQL files. |

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type `Show PL/SQL Structure Tree`.

Example output:

```
═══ PL/SQL Structure Tree ═══
File : /path/to/package.pkb

[0] DECLARE → BEGIN  L1–L42
  [1] IF  L5–L12
    [2] LOOP  L7–L10
  [1] IF  L15–L30
    [2] CASE  L17–L28
```

---

## Configuration

All settings live under `plsqlBlockHighlighter.*`
(`Ctrl+,` → search **PL/SQL Block Highlighter**).

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the extension |
| `languages` | string[] | `["sql","plsql"]` | Language IDs where the extension activates |
| `highlightParent` | boolean | `true` | Show a dimmer underline on the immediate parent block |

---

## Linting & formatting

```bash
npm run lint          # check for lint errors
npm run lint:fix      # auto-fix lint errors
npm run format:check  # check Prettier formatting
npm run format        # auto-format
```

---

## Project structure

```
plsql-block-highlighter/
├── src/
│   ├── extension.ts                 # activate / deactivate
│   ├── domain/
│   │   └── models.ts                # Token, BlockNode, HighlightResult, …
│   ├── scanner/
│   │   └── tokenizer.ts             # hand-written lexer
│   ├── parser/
│   │   └── blockParser.ts           # builds BlockNode tree
│   ├── resolver/
│   │   └── blockResolver.ts         # cursor → active block
│   ├── application/
│   │   └── highlightService.ts      # pure business logic + formatTree()
│   └── editor/
│       ├── decorationManager.ts     # VS Code decorations (nesting colours)
│       └── editorEventHandler.ts    # events, caching, debug command
├── test/
│   └── unit/
│       ├── scanner/tokenizer.test.ts
│       ├── parser/blockParser.test.ts
│       ├── resolver/blockResolver.test.ts
│       └── application/highlightService.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Architecture overview

```
Text document
     │
     ▼ (on content change)
  Scanner  →  Token[]
     │
     ▼
  Parser   →  BlockNode tree  (cached per document version)
     │
     ▼ (on cursor move — hot path)
  Resolver →  active BlockNode + tokens to highlight
     │
     ▼
  DecorationManager  →  VS Code underlines
```

**Key performance decision:** the tree is rebuilt only when document content changes. Cursor movement just walks the already-built tree, which is very fast even for large files.

---

## Current limitations

- **CASE expression detection** is heuristic (based on the previous token). It correctly handles `:=`, comparisons, `(`, `RETURN`, `IN`, `,`. Rare edge cases in generated or obfuscated SQL may be misclassified.
- **Labels** (e.g. `<<my_loop>>`) are not tracked; a labeled `END my_loop;` is treated as a bare `END`.
- **CURSOR FOR loops** with inline SELECT are supported (the LOOP keyword opens the block regardless of what precedes it).
- **Trigger bodies** and **package bodies** that start with `AS BEGIN` are parsed correctly because `BEGIN` is the block opener.
- No support yet for `OPEN cursor FOR …` or other exotic PL/SQL constructs.

---

## Supported file extensions

| Extension | Language ID |
|-----------|-------------|
| `.sql` | `sql` |
| `.pls` | `plsql` |
| `.pkb` | `plsql` |
| `.pks` | `plsql` |
| `.pck` | `plsql` |
| `.fnc` | `plsql` |
| `.prc` | `plsql` |
| `.trg` | `plsql` |

---

## License

MIT

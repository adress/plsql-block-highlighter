# PL/SQL Block Highlighter

A VS Code extension that highlights the structural keywords — **DECLARE**, **BEGIN**, **EXCEPTION**, and **END** — of the innermost PL/SQL block containing the cursor.

When you move the cursor inside any block, all four boundary keywords light up instantly, making it easy to see where a block starts and ends inside deeply nested code.

---

## Features

- Highlights `DECLARE`, `BEGIN`, `EXCEPTION`, `END` of the block under the cursor
- Tracks nesting: always highlights the **innermost** block
- Three visual styles: `border` (default), `background`, `bold`
- Respects `END IF`, `END LOOP`, `END CASE` — does **not** confuse them with block ends
- Skips string literals and comments during parsing (no false positives)
- Works on `.sql`, `.pls`, `.pkb`, `.pks`, `.pck`, `.fnc`, `.prc`, `.trg` files
- Configurable language list, style, and enable/disable toggle

---

## Quick demo

```sql
DECLARE                     -- highlighted (cursor is inside this block)
  v_count NUMBER;
BEGIN                       -- highlighted
  IF v_count > 0 THEN
    BEGIN                   -- NOT highlighted (inner block, cursor not here)
      NULL;
    END;
  END IF;
EXCEPTION                   -- highlighted
  WHEN OTHERS THEN NULL;
END;                        -- highlighted
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
# 1. Clone the repo
git clone <repo-url>
cd plsql-block-highlighter

# 2. Install dependencies
npm install

# 3. Compile TypeScript
npm run compile
```

---

## Testing in VS Code (Extension Development Host)

The fastest way to try the extension is with the built-in **Extension Development Host**.

### Option A — via the Run & Debug panel (recommended)

1. Open the project folder in VS Code: `File > Open Folder…`
2. Press **F5** (or go to **Run > Start Debugging**)
3. VS Code opens a second window titled **[Extension Development Host]**
4. In that second window, open any `.sql` or `.pls` file
5. Move the cursor inside a PL/SQL block — the boundary keywords highlight automatically

> The task `watch` runs automatically before launch, so any change you make to
> `src/` is recompiled live. Just reload the Extension Development Host window
> with **Ctrl+R** / **Cmd+R** to pick up the change.

### Option B — via the command line

```bash
# Compile once
npm run compile

# Then open VS Code pointing at the extension folder
code --extensionDevelopmentPath=$(pwd) .
```

---

## Running the tests

### Unit tests (fast, no VS Code required)

```bash
npm test
# or with watch mode:
npm run test:unit:watch
# or with coverage report:
npm run test:unit:coverage
```

Output example:

```
 ✓ test/unit/parser/tokenizer.test.ts        (7 tests)
 ✓ test/unit/parser/blockParser.test.ts      (8 tests)
 ✓ test/unit/parser/highlightService.test.ts (6 tests)

 Test Files  3 passed (3)
      Tests  21 passed (21)
```

### Lint & format

```bash
npm run lint          # check for lint errors
npm run lint:fix      # auto-fix lint errors
npm run format:check  # check Prettier formatting
npm run format        # auto-format all files
```

---

## Configuration

All settings live under `plsqlBlockHighlighter.*` in VS Code settings
(`Ctrl+,` / `Cmd+,`, search for **PL/SQL Block Highlighter**).

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable or disable the extension |
| `decorationStyle` | `"border"` \| `"background"` \| `"bold"` | `"border"` | Visual style of the highlighted keywords |
| `languages` | string[] | `["sql","plsql"]` | Language IDs where the extension activates |

### Changing the style

Open your `settings.json` and add:

```json
"plsqlBlockHighlighter.decorationStyle": "background"
```

Or use the Settings UI: search for **PL/SQL Block Highlighter** and pick a style from the dropdown.

---

## Project structure

```
plsql-block-highlighter/
├── src/
│   ├── extension.ts                  # activate / deactivate entry point
│   ├── domain/
│   │   └── models.ts                 # Position, BlockKeyword, PlsqlBlock
│   ├── parser/
│   │   ├── tokenizer.ts              # hand-written lexer (strips comments/strings)
│   │   └── blockParser.ts            # stack-based block parser
│   ├── application/
│   │   └── highlightService.ts       # cursor → keywords service (pure, no VS Code)
│   └── editor/
│       ├── decorationManager.ts      # manages VS Code TextEditorDecorationType
│       └── editorEventHandler.ts     # wires selection / document / config events
├── test/
│   └── unit/
│       └── parser/
│           ├── tokenizer.test.ts
│           ├── blockParser.test.ts
│           └── highlightService.test.ts
├── .vscode/
│   ├── launch.json                   # F5 launch configs
│   └── tasks.json                    # build tasks
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## How it works

1. **Tokenizer** (`tokenizer.ts`) — walks the raw text character by character, emitting keyword tokens while skipping string literals, single-line comments (`--`), and block comments (`/* */`).

2. **Block parser** (`blockParser.ts`) — maintains a stack of open `BEGIN` blocks. When it sees `END IF`, `END LOOP`, or `END CASE` it pops a separate non-block counter so those `END` tokens never close a real block.

3. **Highlight service** (`highlightService.ts`) — filters all parsed blocks to those whose range contains the cursor, then picks the deepest one and returns its keyword list.

4. **Editor layer** — `EditorEventHandler` listens to `onDidChangeTextEditorSelection`, `onDidChangeTextDocument`, and `onDidChangeConfiguration`, calling the service on every change and applying VS Code decorations via `DecorationManager`.

---

## Supported file extensions

| Extension | Description |
|-----------|-------------|
| `.sql` | Generic SQL (language ID `sql`) |
| `.pls` | PL/SQL source |
| `.pkb` | Package body |
| `.pks` | Package specification |
| `.pck` | Package (combined) |
| `.fnc` | Function |
| `.prc` | Procedure |
| `.trg` | Trigger |

---

## License

MIT

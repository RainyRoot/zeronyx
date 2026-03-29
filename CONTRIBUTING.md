# Contributing to ZeroNyx

Thank you for your interest in contributing! This document explains how to get involved.

---

## Ways to Contribute

- **Bug reports** — Open an [issue](https://github.com/RainyRoot/zeronyx/issues) with steps to reproduce
- **Feature requests** — Open an issue with the `enhancement` label
- **Pull requests** — Bug fixes, new tool adapters, UI improvements
- **Plugins** — Build and publish plugins to the marketplace
- **Docs** — Improve or translate documentation

---

## Development Setup

### Prerequisites

- Node.js 20+
- Python 3.12+
- Git

### Clone and install

```bash
git clone https://github.com/RainyRoot/zeronyx.git
cd zeronyx
npm install

cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### Run in dev mode

```bash
npm run dev        # Starts Electron + Vite + Python backend
```

### Run tests

```bash
# Backend
cd backend && .venv/bin/pytest

# Frontend type check
npx tsc --noEmit -p frontend/tsconfig.json
```

---

## Pull Request Guidelines

1. **One PR per concern** — Don't bundle unrelated changes
2. **Branch from `dev`**, not `main` — `main` is the stable release branch
3. **Write a clear PR description** — What does it do and why?
4. **Match existing code style** — No reformatting of unrelated code
5. **Don't break existing tests** — Add tests for new functionality
6. **No co-author markers or AI-generated commit footers** — Keep commits clean

### Commit style

```
type(scope): short imperative description

Optional body if the change needs explanation.
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

Examples:
```
feat(adapters): add ffuf integration
fix(proxy): handle chunked transfer encoding correctly
docs(sdk): add plugin hook reference
```

---

## Adding a New Tool Adapter

1. Create `backend/adapters/{tool}_adapter.py` extending `ToolAdapter`
2. Implement `run()`, `is_installed()`, and a parser in `backend/parsers/`
3. Register it in `backend/adapters/__init__.py`
4. Add UI in `frontend/src/pages/Scans/`
5. Add a REST route if needed

See `backend/adapters/nmap_adapter.py` as a reference implementation.

---

## Plugin Development

See [docs/PLUGIN_SDK.md](docs/PLUGIN_SDK.md) for the full SDK reference.

---

## Code of Conduct

Be respectful. This project is used in professional security contexts — contributions should reflect that standard. Offensive language, harassment, or politically charged content will not be tolerated.

---

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

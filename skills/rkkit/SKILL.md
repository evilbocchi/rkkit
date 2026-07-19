---
name: rkkit
description: "Guide for integrating rkkit into Roblox projects. Use when setting up dev tooling, configuring CI pipelines, managing rokit.toml, or running tools via rkkit."
---

# rkkit Project Integration

This skill provides guidance for developers using `rkkit` in their Roblox projects to manage toolchains (Rojo, Lune, etc.).

## Quick Start

1. **Install rkkit** as a dev dependency:

    ```bash
    npm install rkkit --save-dev
    ```

2. **Initialize rokit.toml** (if you don't have one):

    ```bash
    npx rokit init
    ```

3. **Run a tool**:

    ```bash
    # Using the universal runner
    npx rk rojo --help
    npx rk lune run script.luau

    # Using shorthands (if configured in package.json bin)
    npx rojo serve
    npx lune run script.luau
    ```

## Core Concepts

- **rokit.toml**: The source of truth for project tools. Defines tool names and exact versions.
- **Universal Runner (`rk`)**: `npx rk <tool> [args]` resolves the tool from `rokit.toml`, installs it if missing, and runs it.
- **Auto-Install**: `rkkit` automatically downloads and caches missing tools defined in `rokit.toml`.
- **Tool Shorthands**: Popular tools like `rojo` and `lune` are available as direct binaries via `npx`.

## Common Patterns

### Dev Tooling

Use `rkkit` scripts in your `package.json` for common workflows:

```json
{
    "scripts": {
        "build": "npx rojo build -o place.rbxl",
        "watch": "npx rojo build -o place.rbxl --watch",
        "test": "npx lune run tests/init.luau",
        "fmt": "npx rk stylua .",
        "lint": "npx rk selene ."
    }
}
```

### CI Integration

In CI environments (GitHub Actions, etc.), `rkkit` works out of the box without pre-installing tools.

**Example GitHub Action**:

```yaml
steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
          node-version: "20"
    - run: npm ci
    - name: Build Place
      run: npx rojo build -o build.rbxl
    - name: Run Tests
      run: npx lune run tests/init.luau
```

## Gotchas

- **No Global Installs Required**: Avoid installing Rojo/Lune globally. Let `rkkit` manage them per-project.
- **CI Caching**: Tool binaries are cached in `~/.rokit/rkkit`.
- **Permissions**: Ensure `rkkit` has execute permissions on downloaded binaries (usually handled automatically).

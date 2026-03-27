# rkkit

Next-generation toolchain manager for Roblox projects. `rkkit` is a lightweight, fast, and powerful CLI tool to manage your Roblox project's tools via `rokit.toml`.

## Installation

```bash
npm install rkkit
```

## Why rkkit?

- **Unified Tooling**: Version-control Rokit into your project.
- **Automated Tool Installation**: Automatically installs tools defined in `rokit.toml` if they are not found.
- **Project-Specific Tools**: Define different versions of tools for each project.

## Usage

### Run a tool defined in `rokit.toml`

```bash
# Use any Rokit tool with `rk`
npx rk lune --help
npx rk rojo --help
npx rojo --help # We provide shorthands for popular tools (rojo/lune)
```

### Initialize `rokit.toml`

```bash
npx rokit init
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

## License

MIT

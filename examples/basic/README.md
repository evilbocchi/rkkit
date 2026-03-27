# Basic Example

This is a basic example of how to use `rkkit` with a `rokit.toml` file.

## Setup

1.  Navigate to this directory: `cd examples/basic`
2.  Install dependencies: `npm install -g rkkit` (if you haven't already)
3.  Run a tool: `rk lune --version` or `rk rojo --version`

## How it works

The `rokit.toml` file defines the tools and their versions:

```toml
[tools]
lune = "0.23.0"
rojo = "7.4.4"
```

When you run `rk lune`, `rkkit` will:

1.  Look up `lune` in `rokit.toml`.
2.  Find version `0.23.0`.
3.  Check if it's already installed via Rokit.
4.  If not, install it.
5.  Execute it.

/// <reference types="jest" />
/// <reference types="node" />

// TypeScript no longer auto-includes node_modules/@types packages, so the
// jest globals (describe/it/expect) and the node types used by the test
// harness (node:sqlite/fs/path) are referenced explicitly here; the tsconfig
// include picks this file up for all sources.

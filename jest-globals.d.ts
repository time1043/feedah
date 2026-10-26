/// <reference types="jest" />
/// <reference types="node" />

// TypeScript 6 no longer auto-includes node_modules/@types packages, so the
// jest globals (describe/it/expect/jest) and the node types used by the test
// harness (node:sqlite/fs/path) are referenced explicitly here; the tsconfig
// include picks this file up for all sources.

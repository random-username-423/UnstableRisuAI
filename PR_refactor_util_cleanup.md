# refactor: util.ts cleanup and type improvements

## Summary

Refactored `util.ts` for better code quality, type safety, and maintainability. Extracted string/multilang utilities to a separate module and modernized various utility functions.

## Changes

- **refactor: unify file picker API with openFilePicker**
  - Consolidated file picker logic into a single reusable function

- **refactor: improve checkNullish type safety**
  - Enhanced type narrowing for nullish checks

- **refactor: use File.arrayBuffer() instead of FileReader**
  - Modernized file reading with async/await pattern

- **refactor: add explicit return type to sleep function**
  - Added type annotation for better code clarity

- **refactor: simplify getBasename with regex split**
  - Simplified path parsing logic using regex

- **refactor: extract deriveObfuscationKey helper from encrypt/decrypt functions**
  - Reduced code duplication in encryption utilities

- **refactor: simplify bufferToText and fix naming convention**
  - Cleaned up buffer conversion function and improved naming

- **refactor: modernize multilang string functions with matchAll and fix xx key bug**
  - Updated regex handling and fixed language key parsing bug

- **refactor: simplify toLangName with early return and null coalescing**
  - Streamlined language name conversion logic

- **refactor: extract string/multilang utilities to util_string.ts**
  - Separated string utilities into dedicated module for better organization

- **fix: add nullish coalescing for DisplayNames.of() return type**
  - Fixed potential null reference issue

- **fix: replace explicit any types with JSONSchema type definition**
  - Improved type safety by replacing `any` with proper types

- **docs: add TODO comments for simplifySchema refactoring**
  - Documented future improvement areas for schema simplification

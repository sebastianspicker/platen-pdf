# Changelog

This file records public-facing changes to Platen. The project follows
semantic versioning for release identifiers, but alpha releases may change
interfaces and output contracts without backward compatibility.

## Source audit fixes (2026-11-02)

- ZIP-based inputs (Office, OpenDocument, review exchange, comparison packages)
  now stop unpacking at each entry's declared size, so a crafted archive can no
  longer exhaust host memory.
- `professional-capability` no longer runs handlers for capabilities the catalog
  marks as planned; those IDs now fail with `PROFESSIONAL_HANDLER_MISSING`
  instead of reporting success on built-in sample data.
- Plugin package install, selection, and rollback now refuse to run without the
  local admin policy, as documented; the HTTP rollback route calls the store
  correctly; a CLI change whose audit record cannot be written reports
  `ADMIN_AUDIT_INCOMPLETE`.
- The CLI runs when started through a symlink; host shutdown no longer waits on
  in-flight jobs; a failed startup removes its private session folder; workspace
  routes reject non-object JSON with 400.
- Restored the Node test suite (`npm test`).

## Development paused (2026-10-14)

- Paused product development until further notice in favor of
  [PdfCraft](https://github.com/storytold/pdfcraft), a working product built
  around almost the same idea. The repository remains available for reference.
- The `0.3.0-alpha.1` candidate will not be published.

## 0.3.0-alpha.1

Release status: candidate, not published.

- Prepared a dependency-free local browser GUI and CLI for public alpha review.
- Added machine-readable coverage for 318 professional capability records while
  keeping planned, blocked, prototype, and excluded states separate.
- Added source-bound local PDF operations, immutable-source storage, validated
  output promotion, optional local engine adapters, and macOS PDFKit subsets.
- Added focused Node contract and integration tests, production-module
  reachability checks, native Swift source inventory, local release validation,
  and screenshot provenance.
- Documented current limitations, trust boundaries, contribution rules, and the
  public-alpha release process.

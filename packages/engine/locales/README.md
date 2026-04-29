# Locale files

Translation strings for the Sveltedraw editor UI. Each file is a flat
JSON map of locale strings, keyed by stable identifier.

## Editing

To add or revise a translation, edit the corresponding `<lang>.json`
directly and open a PR.

## Completion

[percentages.json](./percentages.json) records the completion ratio
per language. It is regenerated on CI when translation files change
(see `.github/workflows/locales-coverage.yml`). Languages below the
completion threshold are excluded from the runtime language picker.

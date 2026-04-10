# Materialize Workflow Scaffold Refactor

Capture the scaffold refactor as the next concrete implementation slice.

Execution contract:

- treat `02-SPEC/SPEC.md` as the canonical architecture boundary for this mission
- do not put workflow source under `.missions`
- do not add compatibility fallbacks
- centralize workflow definition before converting templates
- keep runtime state, workflow schema, and template content as separate concerns

Expected implementation order:

1. Define the workflow manifest contract.
2. Introduce manifest loading and validation.
3. Route stage and artifact resolution through the manifest.
4. Replace code-backed templates with Markdown templates.
5. update tests to match the new contract.
6. remove obsolete constants, switches, and legacy paths.
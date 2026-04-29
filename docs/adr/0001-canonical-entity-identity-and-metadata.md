# Canonical Entity Identity And Metadata

Mission entity schemas use `id` as the canonical identity field, with entity id values owned by the daemon in `table:uniqueId` form. Relationship fields use explicit domain names such as `missionId`, `repositoryId`, `stageId`, or `taskId`, but an Entity's own identity is always `id` so JSON-backed storage and future database-backed storage share the same identity model.

Entity schema modules are not behavior owners. They preserve separate input, storage, and data schema roles, and keep field and relationship metadata close to validation so persistence, indexing, event publication, and future database mapping can share one source of truth. Entity contracts bind those schemas to an Entity class's remote methods and presentation metadata, but the Entity class owns the behavior and invariants.

These schema roles also define the future replication contract. Input schemas describe daemon-validated mutation intent and any surface-local command outbox payloads. Storage schemas describe canonical persisted Entity records and are the only Entity record shape eligible for daemon-to-surface replication. Data schemas describe hydrated read views, including computed or linked fields, and must not be treated as replicated source of truth.

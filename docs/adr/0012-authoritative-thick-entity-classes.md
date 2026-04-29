# Authoritative Thick Entity Classes

Mission Entities are authoritative domain classes, not passive records paired with outboard procedural handlers. The abstract Entity base owns shared mechanics such as clone-protected data access, optional UI state, method command ids, availability naming, and remote method dispatch. A concrete Entity class owns its own identity, invariants, behavior, and remote method targets.

Each Entity follows a three-file ownership pattern. `<Entity>.ts` owns execution and behavior. `<Entity>Schema.ts` owns Zod v4 schemas and exported `z.infer` data types. `<Entity>Contract.ts` owns daemon-readable remote method metadata only: payload schemas, result schemas, execution mode, events, and UI presentation hints. The contract routes to the class; it must not become the behavior owner.

Repository is the first reference implementation of this pattern. `Repository` owns local repository identity derivation, registration, settings document handling, Mission scaffolding, GitHub issue lookup through adapters, Mission preparation, and method availability. Its schema module owns Repository input, storage, data, payload, result, and acknowledgement shapes, with `id` as the canonical Entity identity field. Its contract binds those methods to the Entity remote protocol.

Class-level Entity methods are appropriate for collection-level behavior such as discovery, creation, registration, and resolving instances. Instance-level Entity methods are appropriate for behavior that depends on the Entity's current state, such as reading a Repository snapshot, preparing a Repository, removing it, listing issues, or starting a Mission.

Adapters remain important, but they are not Entity behavior owners. Platform adapters translate external systems such as GitHub into Mission concepts. Storage adapters persist accepted records. Orchestrators may coordinate across boundaries, but they must not replace Entity truth for behavior that belongs to a single Entity.

This decision does not repeal the Mission state store direction. Entity RPC remains the surface mutation interface, and future state-store-backed writes should still enter through State store transactions. Until that store is fully introduced, transitional Entity persistence may use the existing Entity factory and filesystem store, but new Entity behavior should still be designed around the thick Entity class as the authoritative owner.

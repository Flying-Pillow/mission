---
layout: default
title: Architecture
nav_order: 5
has_children: true
---

# Architecture

<section class="mission-section-hero">
	<span class="mission-section-kicker">System Design</span>
	<div class="mission-section-title">Go deeper into the architecture behind the operator experience.</div>
	<p class="mission-section-lead">These pages explain the design boundaries that make Mission feel safe and recoverable: a daemon-owned control plane, a reducer-driven workflow engine, and a runtime layer that can evolve independently from the mission model.</p>
</section>

<div class="mission-section-grid mission-section-grid--three">
	<a class="mission-section-card" href="{{ '/architecture/airport-control-plane/' | relative_url }}">
		<span class="mission-section-card__eyebrow">Layout Authority</span>
		<span class="mission-section-card__title">Airport Control Plane</span>
		<span class="mission-section-card__text">Understand why Tower is a client of the daemon-owned layout system instead of the source of truth.</span>
	</a>
	<a class="mission-section-card" href="{{ '/architecture/workflow-engine/' | relative_url }}">
		<span class="mission-section-card__eyebrow">Execution State</span>
		<span class="mission-section-card__title">Workflow Engine</span>
		<span class="mission-section-card__text">See how Mission persists runtime state and derives stages, gates, tasks, and session behavior from it.</span>
	</a>
	<a class="mission-section-card" href="{{ '/architecture/agent-runtime/' | relative_url }}">
		<span class="mission-section-card__eyebrow">Runtime Contract</span>
		<span class="mission-section-card__title">Agent Runtime</span>
		<span class="mission-section-card__text">Explore the provider-neutral execution boundary that keeps the workflow open to different runtimes.</span>
	</a>
</div>
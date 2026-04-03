<!--
	@file apps/vscode-extension/src/webview/Gauge.svelte
	@description Renders a custom SVG cockpit gauge with segmented arcs and a directional pointer.
-->
<svelte:options runes={true} />

<script lang="ts">
	import type {
		MissionCockpitGaugeModel,
		MissionCockpitGaugeSegment
	} from '../MissionCockpitViewModel.js';

	type Props = {
		gauge: MissionCockpitGaugeModel;
		size?: number;
		onSegmentClick?: (segment: MissionCockpitGaugeSegment) => void;
	};

	let { gauge, size = 168, onSegmentClick }: Props = $props();

	const startAngle = 240;
	const sweepAngle = 240;
	const labelRadiusRatio = 0.48;
	const arcRadiusRatio = 0.34;
	const arcWidthRatio = 0.085;

	const center = $derived(size / 2);
	const radius = $derived(size * arcRadiusRatio);
	const arcWidth = $derived(size * arcWidthRatio);
	const labelRadius = $derived(size * labelRadiusRatio);

	const segments = $derived(gauge.segments);
	const segmentSweep = $derived(segments.length > 0 ? sweepAngle / segments.length : 0);
	const pointerDegrees = $derived(startAngle + segmentSweep * (gauge.activeIndex + 0.5));
	const pointerTarget = $derived(polarToCartesian(pointerDegrees, radius - arcWidth * 0.5));
	const centerLabel = $derived(gauge.title === 'Stage Gauge' ? 'STAGE' : 'TASKS');
	const centerLabelY = $derived(size * 0.85);
	const centerBadgeWidth = $derived(centerLabel === 'STAGE' ? 60 : 58);
	const centerBadgeHeight = 16;
	const centerBadgeX = $derived(center - centerBadgeWidth / 2);
	const centerBadgeY = $derived(centerLabelY - centerBadgeHeight / 2);

	function polarToCartesian(angleDegrees: number, targetRadius: number): { x: number; y: number } {
		const radians = (angleDegrees - 90) * (Math.PI / 180);
		return {
			x: center + targetRadius * Math.cos(radians),
			y: center + targetRadius * Math.sin(radians)
		};
	}

	function describeArc(start: number, end: number): string {
		const startPoint = polarToCartesian(end, radius);
		const endPoint = polarToCartesian(start, radius);
		const largeArcFlag = end - start <= 180 ? '0' : '1';
		return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${endPoint.x} ${endPoint.y}`;
	}

	function segmentPath(index: number): string {
		const gap = Math.min(5, segmentSweep * 0.14);
		const start = startAngle + segmentSweep * index + gap / 2;
		const end = startAngle + segmentSweep * (index + 1) - gap / 2;
		return describeArc(start, end);
	}

	function labelPosition(index: number): { x: number; y: number } {
		return polarToCartesian(startAngle + segmentSweep * (index + 0.5), labelRadius);
	}

	function segmentClass(segment: MissionCockpitGaugeSegment): string {
		switch (segment.state) {
			case 'ready':
				return 'mc-gauge-segment-ready';
			case 'active':
				return 'mc-gauge-segment-active';
			case 'warning':
				return 'mc-gauge-segment-warning';
			case 'blocked':
				return 'mc-gauge-segment-blocked';
			case 'idle':
			default:
				return 'mc-gauge-segment-idle';
		}
	}

	function handleSegmentClick(segment: MissionCockpitGaugeSegment): void {
		onSegmentClick?.(segment);
	}

	function handleSegmentKeydown(event: KeyboardEvent, segment: MissionCockpitGaugeSegment): void {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		event.preventDefault();
		handleSegmentClick(segment);
	}
</script>

<div class="mc-gauge-card rounded-4xl px-3 pb-3 pt-2">
	<svg
		class="mc-gauge-svg"
		viewBox={`0 0 ${size} ${size}`}
		aria-label={`${gauge.title}: ${gauge.activeLabel}`}
	>
		<circle class="mc-gauge-face" cx={center} cy={center} r={radius + arcWidth * 1.7} />
		<circle class="mc-gauge-face-inner" cx={center} cy={center} r={radius - arcWidth * 1.5} />

		{#each segments as segment, index (segment.id)}
			<g
				class={segment.artifactKey ? 'mc-gauge-segment-actionable' : ''}
				role={segment.artifactKey ? 'button' : undefined}
				onclick={() => {
					if (segment.artifactKey) {
						handleSegmentClick(segment);
					}
				}}
				onkeydown={(event) => {
					if (segment.artifactKey) {
						handleSegmentKeydown(event, segment);
					}
				}}
			>
				<path
					class={`mc-gauge-segment ${segmentClass(segment)} ${segment.active ? 'mc-gauge-segment-current' : ''}`}
					d={segmentPath(index)}
					stroke-width={arcWidth}
				/>
				<text
					class={`mc-gauge-label ${segment.active ? 'mc-gauge-label-current' : ''}`}
					x={labelPosition(index).x}
					y={labelPosition(index).y}
					text-anchor="middle"
					dominant-baseline="middle"
				>
					{segment.shortLabel}
				</text>
			</g>
		{/each}

		<line
			class="mc-gauge-pointer"
			x1={center}
			y1={center}
			x2={pointerTarget.x}
			y2={pointerTarget.y}
		/>
		<rect
			class="mc-gauge-center-badge"
			x={centerBadgeX}
			y={centerBadgeY}
			width={centerBadgeWidth}
			height={centerBadgeHeight}
			rx={centerBadgeHeight / 2}
			ry={centerBadgeHeight / 2}
		/>
		<text
			class="mc-gauge-center-title"
			x={center}
			y={centerLabelY}
			text-anchor="middle"
			dominant-baseline="central"
		>
			{centerLabel}
		</text>
		<circle class="mc-gauge-hub-ring" cx={center} cy={center} r={arcWidth * 0.7} />
		<circle class="mc-gauge-hub" cx={center} cy={center} r={arcWidth * 0.42} />
	</svg>
</div>

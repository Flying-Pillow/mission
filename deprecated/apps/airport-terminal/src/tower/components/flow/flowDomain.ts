import type {
	MissionSelector,
	OperatorActionDescriptor,
	OperatorActionExecutionStep,
	OperatorActionFlowDescriptor,
	OperatorActionFlowStep,
	OperatorStatus,
} from '@flying-pillow/mission-core';
import { towerThemes, type TowerThemeName } from '../towerTheme.js';
import type { SelectItem } from '../types.js';

export type FlowSelectionValue = {
	kind: 'selection';
	stepId: string;
	label: string;
	optionIds: string[];
	optionLabels: string[];
};

export type FlowTextValue = {
	kind: 'text';
	stepId: string;
	label: string;
	value: string;
};

export type FlowStepValue = FlowSelectionValue | FlowTextValue;

export type FlowResult = {
	flowId: string;
	steps: FlowStepValue[];
};

export type FlowSelectionStep = {
	kind: 'selection';
	id: string;
	label: string;
	title: string;
	emptyLabel: string;
	helperText: string;
	selectionMode: 'single' | 'multiple';
	items: (steps: FlowStepValue[]) => SelectItem[];
};

export type FlowTextStep = {
	kind: 'text';
	id: string;
	label: string;
	title: string;
	helperText: string;
	placeholder: string;
	initialValue: string;
	inputMode: 'compact' | 'expanded';
	format: 'plain' | 'markdown';
};

export type FlowStep = FlowSelectionStep | FlowTextStep;

export type FlowDefinition = {
	id: string;
	owner?: 'repository' | 'mission';
	targetLabel: string;
	actionLabel: string;
	steps: FlowStep[];
	resolveDefinition?: (steps: FlowStepValue[]) => Promise<FlowDefinition>;
	onComplete: (result: FlowResult) => Promise<FlowCompletion | void>;
};

export type FlowCompletion = {
	kind: 'close';
} | {
	kind: 'restart';
	definition: FlowDefinition;
};

export type FlowState = {
	definition: FlowDefinition;
	stepIndex: number;
	steps: FlowStepValue[];
};

export type CommandFlowCompletion = FlowCompletion;
export type CommandFlowDefinition = FlowDefinition;
export type CommandFlowResult = FlowResult;
export type CommandFlowSelectionValue = FlowSelectionValue;
export type CommandFlowState = FlowState;
export type CommandFlowStep = FlowStep;
export type CommandFlowStepValue = FlowStepValue;

export type ActiveFlowDraft =
	| {
		kind: 'selection';
		highlightedItemId: string | undefined;
		selectedItemIds: string[];
	  }
	| {
		kind: 'text';
		value: string;
	  };

export function buildThemePickerItems(selectedTheme: TowerThemeName): SelectItem[] {
	return Object.keys(towerThemes).map((themeName) => {
		const isSelected = themeName === selectedTheme;
		return {
			id: themeName,
			label: themeName.toUpperCase(),
			description: isSelected ? 'Current session theme' : 'Apply for this tower session'
		};
	});
}

export function resolveFlowStep(
	definition: FlowDefinition,
	stepIndex: number
): FlowStep | undefined {
	return definition.steps[stepIndex];
}

export function buildFlowStep(step: OperatorActionFlowDescriptor['steps'][number]): FlowStep {
	if (step.kind === 'selection') {
		return {
			kind: 'selection',
			id: step.id,
			label: step.label,
			title: step.title,
			emptyLabel: step.emptyLabel,
			helperText: step.helperText,
			selectionMode: step.selectionMode,
			items: () => step.options.map((option) => ({
				id: option.id,
				label: option.label,
				description: option.description
			}))
		};
	}
	return {
		kind: 'text',
		id: step.id,
		label: step.label,
		title: step.title,
		helperText: step.helperText,
		placeholder: step.placeholder,
		initialValue: step.initialValue ?? '',
		inputMode: step.inputMode,
		format: step.format
	};
}

export function buildFlowExecutionSteps(steps: FlowStepValue[]): OperatorActionExecutionStep[] {
	return steps.map((step) =>
		step.kind === 'selection'
			? {
				kind: 'selection',
				stepId: step.stepId,
				optionIds: [...step.optionIds]
			}
			: {
				kind: 'text',
				stepId: step.stepId,
				value: step.value
			}
	);
}

export function buildFlowSummaryItems(
	steps: FlowStepValue[]
): Array<{ label: string; value: string }> {
	return steps.map((step) => ({
		label: step.label,
		value: step.kind === 'selection'
			? step.optionLabels.join(', ')
			: formatFlowTextSummary(step.value)
	}));
}

export function buildFlowStepTitle(
	targetLabel: string | undefined,
	stepLabel: string | undefined,
	actionLabel: string | undefined
): string {
	return [targetLabel, stepLabel, actionLabel]
		.map((segment) => (typeof segment === 'string' ? segment.trim() : ''))
		.filter((segment) => segment.length > 0)
		.map((segment) => segment.toUpperCase())
		.join(' > ');
}

type BuildCommandFlowDefinitionOptions = {
	command: OperatorActionDescriptor | undefined;
	executeSelector: MissionSelector;
	executeAction: (input: {
		actionId: string;
		steps: OperatorActionExecutionStep[];
		selector: MissionSelector;
	}) => Promise<{ status: OperatorStatus }>;
	loadControlFlowDescriptor: (input: {
		actionId: string;
		steps: OperatorActionExecutionStep[];
		selector: MissionSelector;
	}) => Promise<OperatorActionFlowDescriptor>;
	onComplete?: (input: {
		command: OperatorActionDescriptor;
		executionResult: { status: OperatorStatus };
		flowResult: FlowResult;
	}) => void;
};

export function buildCommandFlowDefinition(
	options: BuildCommandFlowDefinitionOptions
): FlowDefinition | undefined {
	const command = options.command;
	if (!command?.flow) {
		return undefined;
	}
	const flow = command.flow as OperatorActionFlowDescriptor & {
		actionLabel: string;
		steps: OperatorActionFlowStep[];
	};

	const completeFlow = async (result: FlowResult) => {
		const executionResult = await options.executeAction({
			actionId: command.id,
			steps: buildFlowExecutionSteps(result.steps),
			selector: options.executeSelector,
		});
		options.onComplete?.({ command, executionResult, flowResult: result });
		return { kind: 'close' } satisfies FlowCompletion;
	};

	const buildDefinition = (descriptor: OperatorActionFlowDescriptor): FlowDefinition => ({
		id: command.id,
		owner: command.id.startsWith('control.') ? 'repository' : 'mission',
		targetLabel: descriptor.targetLabel,
		actionLabel: descriptor.actionLabel,
		steps: descriptor.steps.map((step) => buildFlowStep(step)),
		...(command.id.startsWith('control.')
			? {
				resolveDefinition: async (stepValues: FlowStepValue[]) =>
					buildDefinition(await options.loadControlFlowDescriptor({
						actionId: command.id,
						steps: buildFlowExecutionSteps(stepValues),
						selector: options.executeSelector,
					}))
			}
			: {}),
		onComplete: completeFlow
	});

	return buildDefinition(flow);
}

function formatFlowTextSummary(value: string): string {
	const normalized = value.trim();
	if (!normalized) {
		return '(empty)';
	}
	const firstLine = normalized.split(/\r?\n/u)[0] ?? normalized;
	return normalized.includes('\n') ? `${firstLine}...` : firstLine;
}
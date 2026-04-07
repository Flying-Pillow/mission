import type {
	ControlActionDescribe,
	ControlDocumentRead,
	ControlDocumentResponse,
	ControlDocumentWrite,
	ControlIssuesList,
	ControlSettingsUpdate,
	ControlWorkflowSettingsInitialize,
	ControlWorkflowSettingsInitializeResponse,
	ControlWorkflowSettingsUpdate,
	ControlActionExecute,
	ControlWorkflowSettingsUpdateResponse
} from '../daemon/contracts.js';
import type { WorkflowSettingsGetResult } from '../settings/types.js';
import type {
	MissionActionDescriptor,
	MissionActionExecutionStep,
	MissionActionFlowDescriptor,
	MissionStatus,
	TrackedIssueSummary
} from '../types.js';
import { DaemonClient } from './DaemonClient.js';

export class DaemonControlApi {
	public constructor(private readonly client: DaemonClient) { }

	public async getStatus(): Promise<MissionStatus> {
		return this.client.request<MissionStatus>('control.status');
	}

	public async listAvailableActions(): Promise<MissionActionDescriptor[]> {
		return (await this.getStatus()).availableActions ?? [];
	}

	public async executeAction(
		actionId: string,
		steps: MissionActionExecutionStep[] = []
	): Promise<MissionStatus> {
		const params: ControlActionExecute = {
			actionId,
			...(steps.length > 0 ? { steps } : {})
		};
		return this.client.request<MissionStatus>('control.action.execute', params);
	}

	public async describeActionFlow(
		actionId: string,
		steps: MissionActionExecutionStep[] = []
	): Promise<MissionActionFlowDescriptor> {
		const params: ControlActionDescribe = {
			actionId,
			...(steps.length > 0 ? { steps } : {})
		};
		return this.client.request<MissionActionFlowDescriptor>('control.action.describe', params);
	}

	public async updateSetting(
		field: ControlSettingsUpdate['field'],
		value: string
	): Promise<MissionStatus> {
		return this.client.request<MissionStatus>('control.settings.update', { field, value });
	}

	public async readDocument(filePath: string): Promise<ControlDocumentResponse> {
		const params: ControlDocumentRead = { filePath };
		return this.client.request<ControlDocumentResponse>('control.document.read', params);
	}

	public async writeDocument(filePath: string, content: string): Promise<ControlDocumentResponse> {
		const params: ControlDocumentWrite = { filePath, content };
		return this.client.request<ControlDocumentResponse>('control.document.write', params);
	}

	public async getWorkflowSettings(): Promise<WorkflowSettingsGetResult> {
		return this.client.request<WorkflowSettingsGetResult>('control.workflow.settings.get');
	}

	public async initializeWorkflowSettings(
		params: ControlWorkflowSettingsInitialize = {}
	): Promise<ControlWorkflowSettingsInitializeResponse> {
		return this.client.request<ControlWorkflowSettingsInitializeResponse>(
			'control.workflow.settings.initialize',
			params
		);
	}

	public async updateWorkflowSettings(
		params: ControlWorkflowSettingsUpdate
	): Promise<ControlWorkflowSettingsUpdateResponse> {
		return this.client.request<ControlWorkflowSettingsUpdateResponse>(
			'control.workflow.settings.update',
			params
		);
	}

	public async listOpenIssues(
		limit = 50
	): Promise<TrackedIssueSummary[]> {
		const params: ControlIssuesList = { limit };
		return this.client.request<TrackedIssueSummary[]>('control.issues.list', params);
	}
}
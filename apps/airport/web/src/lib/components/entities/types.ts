import type {
    GitHubIssueDetail,
    AgentSessionSnapshot,
    MissionSnapshot,
    MissionReference,
    AgentSessionTerminalSnapshot,
    MissionTerminalSnapshot,
    Repository,
    RepositorySnapshot,
    TrackedIssueSummary,
    GitHubVisibleRepository,
} from "@flying-pillow/mission-core/entities";
import type {
    MissionStageId,
    MissionTowerTreeNode,
    OperatorActionDescriptor,
    OperatorActionExecutionStep,
    OperatorActionFlowStep,
    OperatorActionListSnapshot,
    OperatorActionQueryContext,
    OperatorActionTargetContext,
    OperatorStatus,
} from "@flying-pillow/mission-core/browser";
import type { AirportRuntimeEventEnvelope } from "$lib/contracts/runtime-events";

export type RepositorySummary = Repository;
export type GitHubVisibleRepositorySummary = GitHubVisibleRepository;
export type MissionSummary = MissionReference;
export type SidebarRepositorySummary = RepositorySummary & {
    missions?: MissionSummary[];
};
export type IssueSummary = TrackedIssueSummary;
export type MissionSessionSummary = AgentSessionSnapshot;
export type SelectedMissionSummary = MissionSnapshot;
export type SelectedIssueSummary = GitHubIssueDetail;
export type RepositorySnapshotData = RepositorySnapshot;
export type MissionRuntimeEventEnvelope = AirportRuntimeEventEnvelope;
export type MissionSessionTerminalSnapshotData = AgentSessionTerminalSnapshot;
export type MissionTerminalSnapshotData = MissionTerminalSnapshot;
export type MissionStageIdData = MissionStageId;
export type MissionTowerTreeNodeData = MissionTowerTreeNode;
export type OperatorActionDescriptorData = OperatorActionDescriptor;
export type OperatorActionExecutionStepData = OperatorActionExecutionStep;
export type OperatorActionFlowStepData = OperatorActionFlowStep;
export type OperatorActionListSnapshotData = OperatorActionListSnapshot;
export type OperatorActionQueryContextData = OperatorActionQueryContext;
export type OperatorActionTargetContextData = OperatorActionTargetContext;
export type OperatorStatusData = OperatorStatus;

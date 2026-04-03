import type { MissionStageId, MissionStageStatus } from '../../types.js';
import type { Mission } from './Mission.js';
import { Task } from './Task.js';

export class Stage {
	public constructor(
		private readonly mission: Mission,
		private readonly snapshot: MissionStageStatus
	) {}

	public get data(): MissionStageStatus {
		return this.getState();
	}

	public get stage(): MissionStageId {
		return this.snapshot.stage;
	}

	public get status(): MissionStageStatus['status'] {
		return this.snapshot.status;
	}

	public get taskCount(): number {
		return this.snapshot.taskCount;
	}

	public get completedTaskCount(): number {
		return this.snapshot.completedTaskCount;
	}

	public get activeTaskIds(): string[] {
		return [...this.snapshot.activeTaskIds];
	}

	public get readyTaskIds(): string[] {
		return [...this.snapshot.readyTaskIds];
	}

	public getId(): MissionStageId {
		return this.snapshot.stage;
	}

	public getState(): MissionStageStatus {
		return {
			...this.snapshot,
			activeTaskIds: [...this.snapshot.activeTaskIds],
			readyTaskIds: [...this.snapshot.readyTaskIds],
			tasks: this.snapshot.tasks.map((task) => ({
				...task,
				dependsOn: [...task.dependsOn],
				blockedBy: [...task.blockedBy]
			}))
		};
	}

	public tasks(): Task[] {
		return this.snapshot.tasks.map((task) => new Task(this.mission, task));
	}

	public task(taskId: string): Task | undefined {
		const state = this.snapshot.tasks.find((task) => task.taskId === taskId);
		return state ? new Task(this.mission, state) : undefined;
	}

	public activeTasks(): Task[] {
		return this.snapshot.tasks
			.filter((task) => this.snapshot.activeTaskIds.includes(task.taskId))
			.map((task) => new Task(this.mission, task));
	}

	public readyTasks(): Task[] {
		return this.snapshot.tasks
			.filter((task) => this.snapshot.readyTaskIds.includes(task.taskId))
			.map((task) => new Task(this.mission, task));
	}

	public async refresh(): Promise<Stage | undefined> {
		return this.mission.stage(this.snapshot.stage);
	}
}
export type EntryContext = {
	controlRoot: string;
	launchCwd: string;
	args: string[];
	json: boolean;
};

export type MissionEntryHandler = (context: EntryContext) => Promise<void>;
export type CommandContext = {
	repoRoot: string;
	args: string[];
	json: boolean;
};

export type ParsedFlagMap = Map<string, string | true>;

export type CommandHandler = (context: CommandContext) => Promise<void>;
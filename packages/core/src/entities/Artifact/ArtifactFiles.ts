import { FilesystemAdapter } from '../../lib/FilesystemAdapter.js';
import { MISSION_ARTIFACTS, type MissionArtifactKey } from '../../types.js';

export async function collectArtifactFiles(input: {
    adapter: FilesystemAdapter;
    missionDir: string;
}): Promise<Partial<Record<MissionArtifactKey, string>>> {
    const entries = await Promise.all(
        (Object.keys(MISSION_ARTIFACTS) as MissionArtifactKey[]).map(async (artifact) => {
            const filePath = await input.adapter.readArtifactRecord(input.missionDir, artifact).then(
                (record) => record?.filePath
            );
            const exists = await input.adapter.artifactExists(input.missionDir, artifact);
            return exists && filePath ? ([artifact, filePath] as const) : undefined;
        })
    );

    const result: Partial<Record<MissionArtifactKey, string>> = {};
    for (const entry of entries) {
        if (!entry) {
            continue;
        }
        result[entry[0]] = entry[1];
    }
    return result;
}

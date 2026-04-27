import { z } from 'zod/v4';
import { repositorySchema } from '@flying-pillow/mission-core/entities';

export const airportHomeSnapshotSchema = z.object({
    operationalMode: z.string().trim().min(1).optional(),
    controlRoot: z.string().trim().min(1).optional(),
    currentBranch: z.string().trim().min(1).optional(),
    settingsComplete: z.boolean().optional(),
    repositories: z.array(repositorySchema),
    selectedRepositoryRoot: z.string().trim().min(1).optional()
}).strict();

export type AirportHomeSnapshot = z.infer<typeof airportHomeSnapshotSchema>;

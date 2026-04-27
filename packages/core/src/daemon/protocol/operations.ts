export const PROTOCOL_VERSION = 28;

export type Method =
    | 'ping'
    | 'event.subscribe'
    | 'system.status'
    | 'airport.status'
    | 'airport.client.connect'
    | 'airport.client.observe'
    | 'airport.pane.bind'
    | 'entity.query'
    | 'entity.command'
    | 'control.status'
    | 'control.settings.update'
    | 'control.document.read'
    | 'control.document.write'
    | 'control.workflow.settings.get'
    | 'control.workflow.settings.initialize'
    | 'control.workflow.settings.update'
    | 'control.repositories.list'
    | 'control.repositories.add'
    | 'control.github.issue.detail'
    | 'control.issues.list'
    | 'control.action.list'
    | 'control.action.describe'
    | 'control.action.execute'
    | 'mission.from-brief'
    | 'mission.from-issue'
    | 'mission.operator-status'
    | 'mission.status'
    | 'mission.action.list'
    | 'mission.action.execute'
    | 'mission.gate.evaluate'
    | 'mission.terminal.ensure'
    | 'mission.terminal.state'
    | 'mission.terminal.input'
    | 'session.list'
    | 'session.console.state'
    | 'session.terminal.state'
    | 'session.terminal.input'
    | 'session.prompt'
    | 'session.command'
    | 'session.complete'
    | 'session.cancel'
    | 'session.terminate';

export type MethodWorkspaceRoute = 'none' | 'control' | 'mission';

export type MethodMetadata = {
    includeSurfacePath: boolean;
    workspaceRoute: MethodWorkspaceRoute;
};

export const METHOD_METADATA: Record<Method, MethodMetadata> = {
    'ping': { includeSurfacePath: false, workspaceRoute: 'none' },
    'event.subscribe': { includeSurfacePath: false, workspaceRoute: 'none' },
    'system.status': { includeSurfacePath: true, workspaceRoute: 'none' },
    'airport.status': { includeSurfacePath: true, workspaceRoute: 'none' },
    'airport.client.connect': { includeSurfacePath: true, workspaceRoute: 'none' },
    'airport.client.observe': { includeSurfacePath: true, workspaceRoute: 'none' },
    'airport.pane.bind': { includeSurfacePath: true, workspaceRoute: 'none' },
    'entity.query': { includeSurfacePath: true, workspaceRoute: 'control' },
    'entity.command': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.status': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.settings.update': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.document.read': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.document.write': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.workflow.settings.get': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.workflow.settings.initialize': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.workflow.settings.update': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.repositories.list': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.repositories.add': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.github.issue.detail': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.issues.list': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.action.list': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.action.describe': { includeSurfacePath: true, workspaceRoute: 'control' },
    'control.action.execute': { includeSurfacePath: true, workspaceRoute: 'control' },
    'mission.from-brief': { includeSurfacePath: true, workspaceRoute: 'control' },
    'mission.from-issue': { includeSurfacePath: true, workspaceRoute: 'control' },
    'mission.operator-status': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'mission.status': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'mission.action.list': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'mission.action.execute': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'mission.gate.evaluate': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'mission.terminal.ensure': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'mission.terminal.state': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'mission.terminal.input': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.list': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.console.state': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.terminal.state': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.terminal.input': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.prompt': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.command': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.complete': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.cancel': { includeSurfacePath: true, workspaceRoute: 'mission' },
    'session.terminate': { includeSurfacePath: true, workspaceRoute: 'mission' }
};

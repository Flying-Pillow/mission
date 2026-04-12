import { createEffect, createMemo, createSignal, type Accessor } from 'solid-js';
import {
	moveHeaderTabSelection,
	pickPreferredHeaderTabId,
	type HeaderTab,
} from './headerDomain.js';

type HeaderActivationOptions = {
	preserveFocus?: boolean;
};

type HeaderControllerOptions = {
	tabs: Accessor<HeaderTab[]>;
	activeTabId: Accessor<string>;
	onActivateRepository: (options?: HeaderActivationOptions) => Promise<void>;
	onActivateMission: (missionId: string, options?: HeaderActivationOptions) => Promise<void>;
};

export function useHeaderController(options: HeaderControllerOptions) {
	const [selectedTabId, setSelectedTabId] = createSignal<string | undefined>();

	const currentTabId = createMemo(() => selectedTabId() ?? options.activeTabId());
	const selectedTab = createMemo(() => {
		const tabId = currentTabId();
		return options.tabs().find((tab) => tab.id === tabId) ?? options.tabs()[0];
	});
	const tabsFocusable = createMemo(() => options.tabs().length > 1);

	createEffect(() => {
		setSelectedTabId((current) =>
			pickPreferredHeaderTabId(options.tabs(), current, options.activeTabId())
		);
	});

	async function activateTab(tabId: string | undefined, activationOptions?: HeaderActivationOptions): Promise<void> {
		if (!tabId) {
			return;
		}
		const tab = options.tabs().find((item) => item.id === tabId);
		if (!tab) {
			return;
		}
		setSelectedTabId(tabId);
		if (tab.target.kind === 'repository') {
			await options.onActivateRepository(activationOptions);
			return;
		}
		await options.onActivateMission(tab.target.missionId, activationOptions);
	}

	function previewSelection(delta: number): void {
		if (!tabsFocusable()) {
			return;
		}
		const nextTabId = moveHeaderTabSelection(options.tabs(), currentTabId(), delta);
		if (!nextTabId) {
			return;
		}
		void activateTab(nextTabId, { preserveFocus: true });
	}

	function selectMissionTab(missionId: string): void {
		setSelectedTabId(`mission:${missionId}`);
	}

	return {
		selectedTabId,
		currentTabId,
		selectedTab,
		tabsFocusable,
		activateTab,
		activateSelected: (activationOptions?: HeaderActivationOptions) => activateTab(currentTabId(), activationOptions),
		previewSelection,
		selectMissionTab,
	};
}
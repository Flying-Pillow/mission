<script lang="ts">
    import ScopedActionbar from "$lib/components/entities/Actionbar/ScopedActionbar.svelte";

    let {
        missionId,
        repositoryId,
        refreshNonce,
        onActionExecuted,
    }: {
        missionId: string;
        repositoryId: string;
        refreshNonce: number;
        onActionExecuted: () => Promise<void>;
    } = $props();
</script>

<ScopedActionbar
    {missionId}
    {repositoryId}
    {refreshNonce}
    scope="mission"
    class="xl:justify-end"
    buttonClass="shadow-sm"
    defaultVariant="outline"
    showEmptyState={true}
    {onActionExecuted}
/>

<script lang="ts">
  import { onMount } from "svelte";

  interface ShoppingItem {
    id: string;
    text: string;
    checked: boolean;
  }

  interface ShoppingListData {
    id: string;
    name: string;
    items: ShoppingItem[];
  }

  const STORAGE_KEY = "daison:tools:shopping-list:data";

  let lists = $state<ShoppingListData[]>([]);
  let activeListId = $state<string | null>(null);

  let newItemText = $state("");
  let creatingList = $state(false);
  let newListName = $state("");
  let renamingList = $state(false);
  let renameValue = $state("");
  let confirmingDeleteList = $state(false);

  const activeList = $derived(lists.find((list) => list.id === activeListId) ?? null);
  const checkedCount = $derived(activeList?.items.filter((item) => item.checked).length ?? 0);

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lists, activeListId }));
    } catch {
      // Storage unavailable (private mode, quota, disabled) — edits just
      // won't persist this session.
    }
  }

  function selectList(id: string) {
    activeListId = id;
    confirmingDeleteList = false;
    renamingList = false;
    persist();
  }

  function startCreateList() {
    creatingList = true;
    newListName = "";
  }

  function cancelCreateList() {
    creatingList = false;
    newListName = "";
  }

  // Fires on both Enter and input blur — guarded so a cancelled (Escape)
  // create doesn't get re-confirmed when the input unmounts and blurs.
  function confirmCreateList() {
    if (!creatingList) return;
    const name = newListName.trim();
    creatingList = false;
    if (!name) return;
    const id = crypto.randomUUID();
    lists.push({ id, name, items: [] });
    activeListId = id;
    persist();
  }

  function handleNewListKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") confirmCreateList();
    else if (event.key === "Escape") cancelCreateList();
  }

  function startRename() {
    if (!activeList) return;
    renamingList = true;
    renameValue = activeList.name;
  }

  function cancelRename() {
    renamingList = false;
  }

  function confirmRename() {
    if (!renamingList) return;
    const name = renameValue.trim();
    renamingList = false;
    if (name && activeList) activeList.name = name;
    persist();
  }

  function handleRenameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") confirmRename();
    else if (event.key === "Escape") cancelRename();
  }

  // First click asks for confirmation (changes the button's own label to
  // "confirm?"); second click deletes. No native confirm() dialog — those
  // block the page and look out of place here.
  function deleteActiveList() {
    if (!activeList) return;
    if (!confirmingDeleteList) {
      confirmingDeleteList = true;
      return;
    }
    const idx = lists.findIndex((list) => list.id === activeListId);
    if (idx !== -1) lists.splice(idx, 1);
    activeListId = lists[0]?.id ?? null;
    confirmingDeleteList = false;
    persist();
  }

  function handleAddItem(event: SubmitEvent) {
    event.preventDefault();
    const text = newItemText.trim();
    if (!text || !activeList) return;
    activeList.items.push({ id: crypto.randomUUID(), text, checked: false });
    newItemText = "";
    persist();
  }

  function toggleItem(item: ShoppingItem) {
    item.checked = !item.checked;
    persist();
  }

  function deleteItem(id: string) {
    if (!activeList) return;
    const idx = activeList.items.findIndex((item) => item.id === id);
    if (idx !== -1) activeList.items.splice(idx, 1);
    persist();
  }

  function clearChecked() {
    if (!activeList) return;
    activeList.items = activeList.items.filter((item) => !item.checked);
    persist();
  }

  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        lists = parsed.lists ?? [];
        activeListId = parsed.activeListId ?? (lists[0]?.id ?? null);
      }
    } catch {
      // Corrupt or inaccessible storage — start empty.
    }
  });
</script>

<div class="shopping-list-container mx-auto max-w-md">
  <div class="flex items-end gap-1 overflow-x-auto border-b border-ink/30">
    {#each lists as list (list.id)}
      <button
        type="button"
        onclick={() => selectList(list.id)}
        class={`shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
          list.id === activeListId ? "border-red text-red" : "border-transparent text-ink/60 hover:text-ink"
        }`}
      >
        {list.name}
      </button>
    {/each}

    {#if creatingList}
      <input
        bind:value={newListName}
        onkeydown={handleNewListKeydown}
        onblur={confirmCreateList}
        placeholder="list name"
        autofocus
        class="w-28 shrink-0 border-b-2 border-ink bg-transparent px-2 py-2 text-sm outline-none"
      />
    {:else}
      <button
        type="button"
        onclick={startCreateList}
        class="shrink-0 px-3 py-2 text-sm text-ink/50 hover:text-red"
      >
        + new
      </button>
    {/if}
  </div>

  {#if !activeList}
    <p class="py-16 text-center text-sm text-ink/50">
      {lists.length === 0 ? "No lists yet. Start one above." : "Pick a list above."}
    </p>
  {:else}
    <div class="py-4">
      <div class="flex items-center justify-between gap-3">
        {#if renamingList}
          <input
            bind:value={renameValue}
            onkeydown={handleRenameKeydown}
            onblur={confirmRename}
            autofocus
            class="min-w-0 flex-1 border-b border-ink bg-transparent text-lg font-bold outline-none"
          />
        {:else}
          <h2 class="truncate text-lg font-bold">{activeList.name}</h2>
        {/if}
        <div class="flex shrink-0 gap-3 text-xs text-ink/50">
          <button type="button" onclick={startRename} class="hover:text-red">rename</button>
          <button type="button" onclick={deleteActiveList} class="hover:text-red">
            {confirmingDeleteList ? "confirm?" : "delete list"}
          </button>
        </div>
      </div>

      {#if activeList.items.length === 0}
        <p class="py-10 text-center text-sm text-ink/50">Nothing here yet — add something below.</p>
      {:else}
        <ul class="mt-4 divide-y divide-ink/15 border-t border-b border-ink/15">
          {#each activeList.items as item (item.id)}
            <li class="flex items-center gap-1">
              <button
                type="button"
                onclick={() => toggleItem(item)}
                class="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
              >
                <span
                  class={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                    item.checked ? "border-red bg-red" : "border-ink/40"
                  }`}
                ></span>
                <span
                  class={`min-w-0 flex-1 break-words ${
                    item.checked ? "text-ink/40 line-through decoration-red decoration-2" : ""
                  }`}
                >
                  {item.text}
                </span>
              </button>
              <button
                type="button"
                onclick={() => deleteItem(item.id)}
                aria-label="delete item"
                class="shrink-0 px-2 py-2 text-ink/30 hover:text-red"
              >
                &#10005;
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <form onsubmit={handleAddItem} class="mt-4 flex gap-2">
        <input
          bind:value={newItemText}
          placeholder="add an item"
          class="min-w-0 flex-1 border border-ink/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <button
          type="submit"
          class="border border-ink bg-ink px-4 py-2 text-sm text-paper transition-colors hover:border-red hover:bg-red"
        >
          add
        </button>
      </form>

      {#if checkedCount > 0}
        <button type="button" onclick={clearChecked} class="mt-3 text-xs text-ink/50 hover:text-red">
          clear checked ({checkedCount})
        </button>
      {/if}
    </div>
  {/if}
</div>

import { forumCategories } from "../../data/appData";
import { getForumCategory, getForumToneStyles } from "../../utils/forum";
import { formatRelativeTime } from "../../utils/time";
import { sanitizeHTML } from "../../utils/sanitize";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableThread from "../ui/SortableThread";

export default function ForumsPage({
  activePage,
  currentUser,
  isAdmin,
  threadsLoading,
  threadsError,
  threads,
  selectedCategory,
  onCategorySelect,
  threadTitle,
  threadBody,
  threadCategory,
  onThreadTitleChange,
  onThreadBodyChange,
  onThreadCategoryChange,
  threadBusy,
  threadMessage,
  threadMessageTone,
  forumAdminMessage,
  forumAdminTone,
  threadAdminBusyId,
  activeThreadId,
  replies,
  repliesLoading,
  repliesError,
  replyDraft,
  onReplyDraftChange,
  replyBusy,
  replyMessage,
  replyMessageTone,
  replyAdminBusyId,
  onThreadSubmit,
  onThreadToggle,
  onThreadPinToggle,
  onThreadDelete,
  onReplySubmit,
  onReplyDelete,
  onAuthOpen,
  onThreadReorder,
}) {
  const normalizedSelection = (selectedCategory || "all").toLowerCase();
  const filteredThreads =
    normalizedSelection === "all"
      ? threads
      : threads.filter(
          (thread) =>
            (thread.category || "").toLowerCase() === normalizedSelection
        );

  const isCategoryActive = (label) =>
    normalizedSelection === label.toLowerCase();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Handle drag end event
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = filteredThreads.findIndex(
      (thread) => thread.id === active.id
    );
    const newIndex = filteredThreads.findIndex(
      (thread) => thread.id === over.id
    );

    if (oldIndex !== -1 && newIndex !== -1) {
      onThreadReorder(oldIndex, newIndex);
    }
  };

  return (
    <section
      className="page relative z-10 py-28"
      data-page="forums"
      hidden={activePage !== "forums"}
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="opacity-0 animate-fade-in-up mb-14">
          <p className="text-sm font-medium text-violet-400 uppercase tracking-widest mb-3">
            Community Hub
          </p>
          <h2 className="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
            Forums
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl">
            Ask questions, trade accounts, or organize events with the crew.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Create Thread Form */}
            <div className="opacity-0 animate-fade-in-up delay-100 glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <iconify-icon
                  icon="solar:pen-new-square-linear"
                  width="20"
                  height="20"
                  className="text-violet-400"
                ></iconify-icon>
                Start a thread
              </h3>
              {!currentUser && (
                <p className="text-sm text-slate-500 mb-4">
                  Sign in to create a thread.
                </p>
              )}
              <form onSubmit={onThreadSubmit} className="space-y-4">
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Title</span>
                  <input
                    type="text"
                    value={threadTitle}
                    onChange={onThreadTitleChange}
                    className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                    placeholder="Thread title"
                    maxLength={120}
                    disabled={!currentUser || threadBusy}
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Category</span>
                  <select
                    value={threadCategory}
                    onChange={onThreadCategoryChange}
                    className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40"
                    disabled={!currentUser || threadBusy}
                  >
                    {forumCategories.map((category) => (
                      <option key={category.label} value={category.label}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Body (optional)</span>
                  <textarea
                    value={threadBody}
                    onChange={onThreadBodyChange}
                    className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 min-h-[120px] resize-none"
                    placeholder="What's happening?"
                    maxLength={800}
                    disabled={!currentUser || threadBusy}
                  ></textarea>
                </label>
                {threadMessage && (
                  <p
                    className={`text-sm flex items-center gap-2 ${
                      threadMessageTone === "error"
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }`}
                  >
                    <iconify-icon
                      icon={
                        threadMessageTone === "error"
                          ? "solar:danger-triangle-linear"
                          : "solar:check-circle-linear"
                      }
                      width="16"
                      height="16"
                    ></iconify-icon>
                    {threadMessage}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!currentUser || threadBusy}
                  className="w-full rounded-xl bg-gradient-to-r from-white via-slate-100 to-white text-black px-4 py-3 text-sm font-semibold shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-100 hover:to-white hover:shadow-violet-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {threadBusy ? (
                    <span className="flex items-center justify-center gap-2">
                      <iconify-icon
                        icon="solar:refresh-circle-linear"
                        width="18"
                        height="18"
                        className="animate-spin-slow"
                      ></iconify-icon>
                      Posting...
                    </span>
                  ) : (
                    "Post thread"
                  )}
                </button>
                {!currentUser && (
                  <button
                    type="button"
                    onClick={onAuthOpen("signin")}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:border-violet-400/60 hover:bg-violet-500/20 active:scale-[0.99]"
                  >
                    Sign in to post
                  </button>
                )}
              </form>
            </div>

            {/* Categories */}
            <div className="opacity-0 animate-fade-in-up delay-200 glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <iconify-icon
                  icon="solar:folder-open-linear"
                  width="20"
                  height="20"
                  className="text-violet-400"
                ></iconify-icon>
                Categories
              </h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onCategorySelect("all")}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-white transition-all duration-200 ${
                    normalizedSelection === "all"
                      ? "border-violet-400/40 bg-violet-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
                        normalizedSelection === "all"
                          ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                          : "bg-white/5 text-slate-400 border border-white/10"
                      }`}
                    >
                      <iconify-icon
                        icon="solar:layers-minimalistic-linear"
                        width="18"
                        height="18"
                      ></iconify-icon>
                    </span>
                    <span>All categories</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {threads.length}
                  </span>
                </button>
                {forumCategories.map((category) => {
                  const tone = getForumToneStyles(category.tone);
                  const isActive = isCategoryActive(category.label);
                  const count = threads.filter(
                    (t) =>
                      (t.category || "").toLowerCase() ===
                      category.label.toLowerCase()
                  ).length;
                  return (
                    <button
                      type="button"
                      key={category.label}
                      onClick={() => onCategorySelect(category.label)}
                      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-white transition-all duration-200 ${
                        isActive
                          ? "border-violet-400/40 bg-violet-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${tone.icon}`}
                        >
                          <iconify-icon
                            icon={category.icon}
                            width="18"
                            height="18"
                          ></iconify-icon>
                        </span>
                        <span>{category.label}</span>
                      </div>
                      <span className="text-xs text-slate-500">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Thread List */}
          <div className="lg:col-span-2">
            {threadsLoading && (
              <div className="opacity-0 animate-fade-in glass-panel p-12 rounded-2xl text-center">
                <div className="inline-flex items-center gap-3 text-slate-400">
                  <iconify-icon
                    icon="solar:refresh-circle-linear"
                    width="24"
                    height="24"
                    className="animate-spin-slow"
                  ></iconify-icon>
                  Loading threads...
                </div>
              </div>
            )}
            {!threadsLoading && threadsError && (
              <div className="opacity-0 animate-fade-in glass-panel p-12 rounded-2xl text-center">
                <iconify-icon
                  icon="solar:danger-triangle-linear"
                  width="32"
                  height="32"
                  className="text-rose-400 mb-3"
                ></iconify-icon>
                <p className="text-rose-400">{threadsError}</p>
              </div>
            )}
            {!threadsLoading && !threadsError && filteredThreads.length === 0 && (
              <div className="opacity-0 animate-fade-in glass-panel p-12 rounded-2xl text-center">
                <iconify-icon
                  icon="solar:chat-square-linear"
                  width="40"
                  height="40"
                  className="text-slate-500 mb-4"
                ></iconify-icon>
                <p className="text-slate-400">
                  No threads in this category yet.
                </p>
              </div>
            )}
            {!threadsLoading && !threadsError && filteredThreads.length > 0 && (
              <div className="space-y-4">
                {forumAdminMessage && (
                  <div
                    className={`opacity-0 animate-fade-in rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
                      forumAdminTone === "error"
                        ? "border-rose-400/40 bg-rose-500/10 text-rose-300"
                        : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    <iconify-icon
                      icon={
                        forumAdminTone === "error"
                          ? "solar:danger-triangle-linear"
                          : "solar:check-circle-linear"
                      }
                      width="18"
                      height="18"
                    ></iconify-icon>
                    {forumAdminMessage}
                  </div>
                )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={filteredThreads.map((thread) => thread.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredThreads.map((thread, index) => {
                  const isActive = activeThreadId === thread.id;
                  const category = getForumCategory(thread.category);
                  const tone = getForumToneStyles(category.tone);
                  const latestActivity = thread.updatedAt || thread.createdAt;
                  return (
                    <SortableThread
                      key={thread.id}
                      id={thread.id}
                      isAdmin={isAdmin}
                    >
                      <div
                        className="opacity-0 animate-fade-in-up glass-panel rounded-2xl overflow-hidden border border-white/10 transition-all duration-300 hover:border-white/20"
                        style={{ animationDelay: `${100 + index * 50}ms` }}
                      >
                      <div
                        className="cursor-pointer px-6 py-5 transition-colors duration-200 hover:bg-white/[0.02]"
                        onClick={() => onThreadToggle(thread.id)}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="col-span-6 flex items-center gap-4">
                            <span
                              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ${tone.icon}`}
                            >
                              <iconify-icon
                                icon={category.icon}
                                width="22"
                                height="22"
                              ></iconify-icon>
                            </span>
                            <div>
                              <h4 className="text-lg font-medium text-white mb-1 group-hover:text-violet-200 transition-colors">
                                {sanitizeHTML(thread.title)}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{thread.authorName}</span>
                                <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                <span>{category.label}</span>
                                {thread.pinned && (
                                  <>
                                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                    <span className="flex items-center gap-1 text-violet-400">
                                      <iconify-icon icon="solar:crown-star-linear"></iconify-icon>{" "}
                                      Pinned
                                    </span>
                                  </>
                                )}
                                {thread.body && (
                                  <>
                                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                    <span className="truncate max-w-[220px]">
                                      {sanitizeHTML(thread.body)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 hidden md:flex justify-center">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${tone.badge}`}
                            >
                              {category.label}
                            </span>
                          </div>
                          <div className="col-span-2 hidden md:flex justify-center items-center gap-2 text-slate-400 text-sm font-medium">
                            <iconify-icon
                              icon="solar:chat-round-linear"
                              width="16"
                              height="16"
                            ></iconify-icon>
                            {thread.replyCount}
                          </div>
                          <div className="col-span-4 md:col-span-2 flex flex-col items-end gap-2 text-slate-400 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{formatRelativeTime(latestActivity)}</span>
                              {latestActivity && (
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    onThreadPinToggle(event, thread)
                                  }
                                  disabled={Boolean(threadAdminBusyId)}
                                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80 transition-all duration-200 hover:border-violet-400/60 hover:bg-violet-500/20 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {thread.pinned ? "Unpin" : "Pin"}
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    onThreadDelete(event, thread)
                                  }
                                  disabled={Boolean(threadAdminBusyId)}
                                  className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200 transition-all duration-200 hover:border-rose-300/60 hover:bg-rose-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Replies Section */}
                      {isActive && (
                        <div className="p-5 bg-black/40 border-t border-white/5 animate-fade-in">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="text-sm font-medium text-white flex items-center gap-2">
                              <iconify-icon
                                icon="solar:chat-round-linear"
                                width="16"
                                height="16"
                                className="text-violet-400"
                              ></iconify-icon>
                              Replies
                            </h5>
                            <span className="text-xs text-slate-500">
                              {thread.replyCount} total
                            </span>
                          </div>
                          {repliesLoading && (
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                              <iconify-icon
                                icon="solar:refresh-circle-linear"
                                width="16"
                                height="16"
                                className="animate-spin-slow"
                              ></iconify-icon>
                              Loading replies...
                            </p>
                          )}
                          {!repliesLoading && repliesError && (
                            <p className="text-sm text-rose-400 flex items-center gap-2">
                              <iconify-icon
                                icon="solar:danger-triangle-linear"
                                width="16"
                                height="16"
                              ></iconify-icon>
                              {repliesError}
                            </p>
                          )}
                          {!repliesLoading &&
                            !repliesError &&
                            replies.length === 0 && (
                              <p className="text-sm text-slate-500">
                                Be the first to reply.
                              </p>
                            )}
                          {!repliesLoading &&
                            !repliesError &&
                            replies.length > 0 && (
                              <div className="space-y-3 mb-5">
                                {replies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-200 hover:bg-white/[0.08]"
                                  >
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                      <span className="font-medium text-slate-400">
                                        {reply.authorName}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span>
                                          {formatRelativeTime(reply.createdAt)}
                                        </span>
                                        {isAdmin && (
                                          <button
                                            type="button"
                                            onClick={(event) =>
                                              onReplyDelete(event, reply.id)
                                            }
                                            disabled={Boolean(replyAdminBusyId)}
                                            className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200 transition-all duration-200 hover:border-rose-500/60 hover:bg-rose-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-sm text-slate-200">
                                      {sanitizeHTML(reply.body)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                          {/* Reply Form */}
                          <form onSubmit={onReplySubmit} className="space-y-3">
                            <label className="block text-sm text-slate-300">
                              <span className="mb-2 block">Add a reply</span>
                              <textarea
                                value={replyDraft}
                                onChange={onReplyDraftChange}
                                className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 min-h-[90px] resize-none"
                                placeholder="Share your thoughts..."
                                maxLength={600}
                                disabled={!currentUser || replyBusy}
                              ></textarea>
                            </label>
                            {replyMessage && (
                              <p
                                className={`text-sm flex items-center gap-2 ${
                                  replyMessageTone === "error"
                                    ? "text-rose-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                <iconify-icon
                                  icon={
                                    replyMessageTone === "error"
                                      ? "solar:danger-triangle-linear"
                                      : "solar:check-circle-linear"
                                  }
                                  width="16"
                                  height="16"
                                ></iconify-icon>
                                {replyMessage}
                              </p>
                            )}
                            {!currentUser && (
                              <p className="text-sm text-slate-500">
                                Sign in to reply.
                              </p>
                            )}
                            <button
                              type="submit"
                              disabled={!currentUser || replyBusy}
                              className="w-full rounded-xl bg-gradient-to-r from-white via-slate-100 to-white text-black px-4 py-3 text-sm font-semibold shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-100 hover:to-white hover:shadow-violet-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {replyBusy ? (
                                <span className="flex items-center justify-center gap-2">
                                  <iconify-icon
                                    icon="solar:refresh-circle-linear"
                                    width="18"
                                    height="18"
                                    className="animate-spin-slow"
                                  ></iconify-icon>
                                  Posting...
                                </span>
                              ) : (
                                "Post reply"
                              )}
                            </button>
                          </form>
                        </div>
                      )}
                      </div>
                    </SortableThread>
                  );
                })}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            <div className="mt-6 md:hidden text-center">
              <button className="w-full py-3 border border-white/10 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:bg-white/5 hover:border-white/20 active:scale-[0.99]">
                View all threads
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

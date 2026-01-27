/**
 * Utility functions for thread ordering and sorting
 */

/**
 * Sorts threads by pinned status first, then by orderIndex
 * @param {Array} threads - Array of thread objects
 * @returns {Array} Sorted array of threads
 */
export const sortThreadsByPinnedAndOrder = (threads) => {
  return [...threads].sort((a, b) => {
    // Tier 1: Pinned threads always at top
    if (a.pinned !== b.pinned) {
      return b.pinned - a.pinned; // true (1) comes before false (0)
    }

    // Tier 2: Within same pinned status, sort by orderIndex ascending
    return (a.orderIndex || 0) - (b.orderIndex || 0);
  });
};

/**
 * Recalculates orderIndex values after a drag-and-drop operation
 * @param {Array} threads - Current array of threads
 * @param {number} oldIndex - Original index of dragged thread
 * @param {number} newIndex - New index of dragged thread
 * @returns {Array} Array of threads with updated orderIndex values
 */
export const recalculateOrderIndexes = (threads, oldIndex, newIndex) => {
  const reordered = [...threads];

  // Remove thread from old position
  const [movedThread] = reordered.splice(oldIndex, 1);

  // Insert thread at new position
  reordered.splice(newIndex, 0, movedThread);

  // Reassign orderIndex to all threads with gaps of 10
  // This allows future insertions without full recalculation
  return reordered.map((thread, index) => ({
    ...thread,
    orderIndex: index * 10,
  }));
};

/**
 * Gets the next orderIndex value for a new thread
 * @param {Array} threads - Existing array of threads
 * @returns {number} Next orderIndex value
 */
export const getNextOrderIndex = (threads) => {
  if (!threads || threads.length === 0) {
    return 0;
  }

  // Find max orderIndex
  const maxOrder = Math.max(
    ...threads.map((thread) => thread.orderIndex || 0)
  );

  // Return max + 10 to leave gap for future insertions
  return maxOrder + 10;
};

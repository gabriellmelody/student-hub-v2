import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getEffortLabel,
  getEffortClass,
  getPlanBlockKey,
  getTaskSignalBadges,
  parseDateKey,
} from "../utils/appUtils.js";
import TaskSourceBadge from "../components/TaskSourceBadge.jsx";

function createManualBlockDraft() {
  return {
    type: "study",
    title: "",
    subject: "",
    duration: 30,
  };
}

function PlanPage({
  planBlocks,
  clearPlan,
  addManualPlanBlock,
  movePlanStudyBlock,
  updatePlanBlockDuration,
  removePlanBlock,
  togglePlanBlockLocked,
  reorderPlanBlock,
  planMoveFeedback,
  completeTaskFromPlan,
  stalePlanDate,
  startFreshPlan,
  openEveningPlanner,
}) {
  const hasLockedBlocks = planBlocks.some((block) => block.locked === true);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [durationDraft, setDurationDraft] = useState("");
  const [openMenuBlockId, setOpenMenuBlockId] = useState(null);
  const [showAddBlockForm, setShowAddBlockForm] = useState(false);
  const [manualBlockDraft, setManualBlockDraft] = useState(
    createManualBlockDraft
  );
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [dragOverBlockId, setDragOverBlockId] = useState(null);
  const [droppedBlockId, setDroppedBlockId] = useState(null);
  const planBlockNodesRef = useRef(new Map());
  const flipFirstRectsRef = useRef(null);
  const flipAnimationFrameRef = useRef(null);
  const activeDragIdRef = useRef(null);
  const lastDragOverIdRef = useRef(null);
  const dropSettleTimerRef = useRef(null);
  const openMenuRef = useRef(null);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(flipAnimationFrameRef.current);
      clearTimeout(dropSettleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!openMenuBlockId) return undefined;

    function handlePointerDown(event) {
      if (!openMenuRef.current?.contains(event.target)) {
        setOpenMenuBlockId(null);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpenMenuBlockId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuBlockId]);

  useLayoutEffect(() => {
    const firstRects = flipFirstRectsRef.current;

    if (!firstRects) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flipFirstRectsRef.current = null;
      return;
    }

    flipFirstRectsRef.current = null;
    cancelAnimationFrame(flipAnimationFrameRef.current);
    const isDragReorder = Boolean(activeDragIdRef.current);
    const transformDuration = isDragReorder ? 210 : 460;

    const animatedBlocks = [];

    planBlockNodesRef.current.forEach((node, key) => {
      const firstRect = firstRects.get(key);

      if (!firstRect) return;

      const lastRect = node.getBoundingClientRect();
      const deltaX = firstRect.left - lastRect.left;
      const deltaY = firstRect.top - lastRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      node.style.transition = "none";
      node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      node.style.zIndex =
        node.dataset.planBlockId === activeDragIdRef.current ||
        node.dataset.planBlockId === planMoveFeedback?.blockId
          ? "2"
          : "1";
      node.style.willChange = "transform";
      animatedBlocks.push(node);
    });

    flipAnimationFrameRef.current = requestAnimationFrame(() => {
      animatedBlocks.forEach((node) => {
        node.style.transition =
          `transform ${transformDuration}ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms ease, background 180ms ease, box-shadow 180ms ease`;
        node.style.transform = "";
      });
    });

    const cleanupTimer = setTimeout(() => {
      animatedBlocks.forEach((node) => {
        node.style.transition = "";
        node.style.transform = "";
        node.style.zIndex = "";
        node.style.willChange = "";
      });
    }, transformDuration + 60);

    return () => clearTimeout(cleanupTimer);
  }, [planBlocks, planMoveFeedback]);

  function setPlanBlockRef(key, node) {
    if (node) {
      planBlockNodesRef.current.set(key, node);
    } else {
      planBlockNodesRef.current.delete(key);
    }
  }

  function getPlanBlockRects() {
    const rects = new Map();

    planBlockNodesRef.current.forEach((node, key) => {
      rects.set(key, node.getBoundingClientRect());
    });

    return rects;
  }

  function handleMovePlanStudyBlock(blockId, direction) {
    if (!canMoveStudyBlock(blockId, direction)) return;

    flipFirstRectsRef.current = getPlanBlockRects();
    movePlanStudyBlock(blockId, direction);
    setOpenMenuBlockId(null);
  }

  function closeAddBlockForm() {
    setShowAddBlockForm(false);
    setManualBlockDraft(createManualBlockDraft());
  }

  function handleManualBlockTypeChange(nextType) {
    setManualBlockDraft((currentDraft) => ({
      ...currentDraft,
      type: nextType,
      title:
        nextType === "break"
          ? currentDraft.title || "Break"
          : currentDraft.title === "Break"
            ? ""
            : currentDraft.title,
      duration: nextType === "break" ? 10 : 30,
    }));
  }

  function submitManualBlock(event) {
    event.preventDefault();
    addManualPlanBlock(manualBlockDraft);
    closeAddBlockForm();
  }

  function openBlockEditor(block) {
    if (block.locked) return;

    setOpenMenuBlockId(null);
    setEditingBlockId(block.id);
    setDurationDraft(String(block.duration));
  }

  function saveBlockDuration(event) {
    event.preventDefault();

    if (!editingBlockId || !Number.isFinite(Number(durationDraft))) return;

    updatePlanBlockDuration(editingBlockId, durationDraft);
    setEditingBlockId(null);
    setDurationDraft("");
  }

  function cancelBlockEdit() {
    setEditingBlockId(null);
    setDurationDraft("");
  }

  function handleRemovePlanBlock(blockId) {
    const block = planBlocks.find((planBlock) => planBlock.id === blockId);

    if (block?.locked) return;

    setOpenMenuBlockId(null);
    removePlanBlock(blockId);
    cancelBlockEdit();
  }

  function resetDragState() {
    activeDragIdRef.current = null;
    lastDragOverIdRef.current = null;
    setDraggedBlockId(null);
    setDragOverBlockId(null);
  }

  function canReorderBlock(activeBlockId, overBlockId) {
    const activeIndex = planBlocks.findIndex(
      (block) => block.id === activeBlockId
    );
    const overIndex = planBlocks.findIndex((block) => block.id === overBlockId);

    if (activeIndex < 0 || overIndex < 0) return false;

    const rangeStart = Math.min(activeIndex, overIndex);
    const rangeEnd = Math.max(activeIndex, overIndex);

    return !planBlocks
      .slice(rangeStart, rangeEnd + 1)
      .some((block) => block.locked);
  }

  function canMoveStudyBlock(blockId, direction) {
    const studyPositions = planBlocks.reduce((positions, block, index) => {
      if (block.type === "study") positions.push(index);
      return positions;
    }, []);
    const currentStudyIndex = studyPositions.findIndex(
      (blockIndex) => planBlocks[blockIndex].id === blockId
    );
    const nextStudyIndex = currentStudyIndex + direction;

    if (
      currentStudyIndex < 0 ||
      nextStudyIndex < 0 ||
      nextStudyIndex >= studyPositions.length
    ) {
      return false;
    }

    return canReorderBlock(
      blockId,
      planBlocks[studyPositions[nextStudyIndex]].id
    );
  }

  function handleDragStart(event, blockId) {
    const block = planBlocks.find((planBlock) => planBlock.id === blockId);

    if (block?.locked) {
      event.preventDefault();
      return;
    }

    activeDragIdRef.current = blockId;
    lastDragOverIdRef.current = blockId;
    setDraggedBlockId(blockId);
    setDroppedBlockId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plan-block", blockId);
    const blockRect = event.currentTarget.getBoundingClientRect();
    const dragOffsetX = Math.max(
      16,
      Math.min(blockRect.width - 16, event.clientX - blockRect.left)
    );
    const dragOffsetY = Math.max(
      12,
      Math.min(blockRect.height - 12, event.clientY - blockRect.top)
    );
    event.dataTransfer.setDragImage(
      event.currentTarget,
      dragOffsetX,
      dragOffsetY
    );
  }

  function handleDragOver(event, overBlockId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const activeBlockId =
      activeDragIdRef.current || event.dataTransfer.getData("text/plan-block");
    const activeIndex = planBlocks.findIndex(
      (block) => block.id === activeBlockId
    );
    const overIndex = planBlocks.findIndex((block) => block.id === overBlockId);

    if (
      !activeBlockId ||
      activeBlockId === overBlockId ||
      activeIndex < 0 ||
      overIndex < 0 ||
      lastDragOverIdRef.current === overBlockId ||
      !canReorderBlock(activeBlockId, overBlockId)
    ) {
      setDragOverBlockId(null);
      event.dataTransfer.dropEffect = "none";
      return;
    }

    setDragOverBlockId(overBlockId);

    const overRect = event.currentTarget.getBoundingClientRect();
    const overMidpoint = overRect.top + overRect.height / 2;
    const movingDown = activeIndex < overIndex;

    if (
      (movingDown && event.clientY < overMidpoint) ||
      (!movingDown && event.clientY > overMidpoint)
    ) {
      return;
    }

    flipFirstRectsRef.current = getPlanBlockRects();
    lastDragOverIdRef.current = overBlockId;
    reorderPlanBlock(activeBlockId, overBlockId);
  }

  function handleDrop(event) {
    event.preventDefault();
    const droppedId = activeDragIdRef.current;
    resetDragState();

    if (!droppedId) return;

    clearTimeout(dropSettleTimerRef.current);
    setDroppedBlockId(droppedId);
    dropSettleTimerRef.current = setTimeout(() => {
      setDroppedBlockId(null);
    }, 240);
  }

  function handleDragHandleKeyDown(event, blockId) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    const currentIndex = planBlocks.findIndex((block) => block.id === blockId);
    const nextIndex = currentIndex + (event.key === "ArrowUp" ? -1 : 1);

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= planBlocks.length) {
      return;
    }

    if (!canReorderBlock(blockId, planBlocks[nextIndex].id)) return;

    event.preventDefault();
    flipFirstRectsRef.current = getPlanBlockRects();
    reorderPlanBlock(blockId, planBlocks[nextIndex].id);
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Today’s Plan</p>
        <h2>Build today’s plan</h2>
        <p>Generate a schedule, then adjust it to fit your day.</p>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h3>Plan</h3>

          <div className="plan-actions">
            <button
              type="button"
              className="small-button secondary plan-add-block-button"
              aria-expanded={showAddBlockForm}
              onClick={() =>
                showAddBlockForm
                  ? closeAddBlockForm()
                  : setShowAddBlockForm(true)
              }
            >
              Add block
            </button>

            {planBlocks.length > 0 && (
              <button
                className="small-button secondary"
                title={
                  hasLockedBlocks
                    ? "Locked blocks will remain in the plan"
                    : undefined
                }
                onClick={clearPlan}
              >
                Clear
              </button>
            )}

            <button
              type="button"
              className="small-button plan-primary-create-button"
              onClick={openEveningPlanner}
            >
              {planBlocks.length > 0 ? "Regenerate plan" : "Create plan"}
            </button>
          </div>
        </div>

        {stalePlanDate && (
          <div className="stale-plan-notice">
            <div>
              <strong>
                Saved plan from{" "}
                {parseDateKey(stalePlanDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </strong>
              <p>It was not restored as Today’s Plan.</p>
            </div>
            <button type="button" onClick={startFreshPlan}>
              Start fresh
            </button>
          </div>
        )}

        {showAddBlockForm && (
          <form className="manual-plan-block-form" onSubmit={submitManualBlock}>
            <div className="manual-plan-block-heading">
              <div>
                <h3>Add a custom block</h3>
                <p>Add study time or a break.</p>
              </div>
              <button
                type="button"
                aria-label="Close add block form"
                onClick={closeAddBlockForm}
              >
                ×
              </button>
            </div>

            <div className="manual-plan-block-fields">
              <label>
                <span>Type</span>
                <select
                  value={manualBlockDraft.type}
                  onChange={(event) =>
                    handleManualBlockTypeChange(event.target.value)
                  }
                >
                  <option value="study">Study block</option>
                  <option value="break">Break block</option>
                </select>
              </label>

              <label>
                <span>Title</span>
                <input
                  type="text"
                  value={manualBlockDraft.title}
                  placeholder={
                    manualBlockDraft.type === "break" ? "Break" : "Study block"
                  }
                  required
                  onChange={(event) =>
                    setManualBlockDraft((currentDraft) => ({
                      ...currentDraft,
                      title: event.target.value,
                    }))
                  }
                />
              </label>

              {manualBlockDraft.type === "study" && (
                <label>
                  <span>Subject <small>Optional</small></span>
                  <input
                    type="text"
                    value={manualBlockDraft.subject}
                    placeholder="e.g. Maths"
                    onChange={(event) =>
                      setManualBlockDraft((currentDraft) => ({
                        ...currentDraft,
                        subject: event.target.value,
                      }))
                    }
                  />
                </label>
              )}

              <label>
                <span>Duration</span>
                <span className="manual-plan-duration-input">
                  <input
                    type="number"
                    min={manualBlockDraft.type === "break" ? 5 : 10}
                    max={manualBlockDraft.type === "break" ? 60 : 240}
                    step="5"
                    value={manualBlockDraft.duration}
                    required
                    onChange={(event) =>
                      setManualBlockDraft((currentDraft) => ({
                        ...currentDraft,
                        duration: event.target.value,
                      }))
                    }
                  />
                  <small>minutes</small>
                </span>
              </label>
            </div>

            <div className="manual-plan-block-actions">
              <button type="button" onClick={closeAddBlockForm}>
                Cancel
              </button>
              <button type="submit">Add block</button>
            </div>
          </form>
        )}

        {planBlocks.length === 0 && (
          <div className="empty-plan">
            <h3>Ready when you are.</h3>
            <p>Add tasks or a custom block to start.</p>
          </div>
        )}

        {planBlocks.map((block, index) => {
          const blockKey = getPlanBlockKey(block, index);

          if (block.type === "message") {
            return (
              <div className="empty-plan" key={blockKey}>
                <h3>{block.title}</h3>
                <p>{block.note}</p>
              </div>
            );
          }

          const canMoveStudyUp =
            block.type === "study" && canMoveStudyBlock(block.id, -1);
          const canMoveStudyDown =
            block.type === "study" && canMoveStudyBlock(block.id, 1);
          const isMovedStudyBlock =
            block.type === "study" && planMoveFeedback?.blockId === block.id;
          const moveClassName = isMovedStudyBlock ? " plan-block-moved" : "";
          const lockClassName = block.locked ? " plan-block-locked" : "";
          const dragClassName = `${
            draggedBlockId === block.id ? " plan-block-dragging" : ""
          }${dragOverBlockId === block.id ? " plan-block-drag-over" : ""}${
            droppedBlockId === block.id ? " plan-block-dropped" : ""
          }${openMenuBlockId === block.id ? " plan-block-menu-open" : ""}`;
          const signalBadges = getTaskSignalBadges(block);

          return (
            <div
              className={
                block.type === "break"
                  ? `plan-block break-block${lockClassName}${dragClassName}`
                  : `plan-block${moveClassName}${lockClassName}${dragClassName}`
              }
              key={blockKey}
              ref={(node) => setPlanBlockRef(blockKey, node)}
              data-plan-block-id={block.id}
              onDragStart={(event) => handleDragStart(event, block.id)}
              onDragOver={(event) => handleDragOver(event, block.id)}
              onDrop={handleDrop}
              onDragEnd={resetDragState}
            >
              <div className="plan-block-header">
                <div className="plan-time">
                  {block.start} – {block.end}
                  {block.edited && <span>Adjusted</span>}
                  {block.locked && (
                    <span className="plan-lock-indicator">Locked</span>
                  )}
                </div>
                <div className="plan-block-header-actions">
                  <button
                    type="button"
                    className="plan-drag-handle"
                    draggable={!block.locked && editingBlockId !== block.id}
                    disabled={block.locked || editingBlockId === block.id}
                    aria-label={
                      block.locked
                        ? `${block.title} is locked`
                        : `Move ${block.title}. Use drag or arrow keys.`
                    }
                    title={block.locked ? "Unlock to reorder" : "Drag to reorder"}
                    onKeyDown={(event) =>
                      handleDragHandleKeyDown(event, block.id)
                    }
                  >
                    <span aria-hidden="true">⠿</span>
                  </button>
                  {editingBlockId !== block.id && (
                    <div
                      className="plan-more-menu-wrap"
                      ref={
                        openMenuBlockId === block.id ? openMenuRef : undefined
                      }
                    >
                      <button
                        type="button"
                        className="plan-more-button"
                        aria-label={`More actions for ${block.title}`}
                        title="More actions"
                        aria-haspopup="menu"
                        aria-expanded={openMenuBlockId === block.id}
                        onClick={() =>
                          setOpenMenuBlockId((currentBlockId) =>
                            currentBlockId === block.id ? null : block.id
                          )
                        }
                      >
                        <span aria-hidden="true">⋯</span>
                      </button>

                      {openMenuBlockId === block.id && (
                        <div className="plan-more-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              togglePlanBlockLocked(block.id);
                              setOpenMenuBlockId(null);
                            }}
                          >
                            {block.locked ? "Unlock block" : "Lock block"}
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            disabled={block.locked}
                            onClick={() => openBlockEditor(block)}
                          >
                            Edit duration
                          </button>

                          {block.type === "study" && (
                            <>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={!canMoveStudyUp}
                                onClick={() =>
                                  handleMovePlanStudyBlock(block.id, -1)
                                }
                              >
                                Move up
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={!canMoveStudyDown}
                                onClick={() =>
                                  handleMovePlanStudyBlock(block.id, 1)
                                }
                              >
                                Move down
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            role="menuitem"
                            className="plan-menu-remove"
                            disabled={block.locked}
                            onClick={() => handleRemovePlanBlock(block.id)}
                          >
                            {block.type === "break"
                              ? "Remove break"
                              : "Remove from plan"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {block.type === "study" &&
                (block.subject || block.effort || signalBadges.length > 0) && (
                <div className="plan-study-meta">
                  {block.subject && <p className="plan-subject">{block.subject}</p>}
                  {block.effort && (
                    <span className={`effort-pill ${getEffortClass(block.effort)}`}>
                      {getEffortLabel(block.effort)} · {block.effort}/5
                    </span>
                  )}
                  <TaskSourceBadge task={block} />
                  {signalBadges.slice(0, 1).map((badge) => (
                    <span
                      className={`task-signal-badge task-signal-${badge.tone}`}
                      key={`${badge.tone}-${badge.label}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              )}

              <h3>{block.title}</h3>
              {block.tip && <p>{block.tip}</p>}

              {editingBlockId === block.id && (
                <form className="plan-block-editor" onSubmit={saveBlockDuration}>
                  <label>
                    <span>Duration</span>
                    <span className="plan-duration-input">
                      <input
                        type="number"
                        min={block.type === "break" ? 5 : 10}
                        max={block.type === "break" ? 60 : 240}
                        step="5"
                        value={durationDraft}
                        autoFocus
                        required
                        onChange={(event) => setDurationDraft(event.target.value)}
                      />
                      <small>minutes</small>
                    </span>
                  </label>
                  <div className="plan-editor-actions">
                    <button
                      type="button"
                      className="cancel-plan-edit-button"
                      onClick={cancelBlockEdit}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="save-plan-edit-button">
                      Save
                    </button>
                  </div>
                </form>
              )}

              {block.type === "study" &&
                block.taskId !== null &&
                editingBlockId !== block.id && (
                <div className="plan-block-controls">
                  <button
                    type="button"
                    className="complete-plan-button"
                    disabled={block.locked}
                    title={block.locked ? "Unlock to mark this task done" : undefined}
                    onClick={() => completeTaskFromPlan(block.taskId)}
                  >
                    Mark done
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlanPage;

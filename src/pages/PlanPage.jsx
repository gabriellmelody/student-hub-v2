import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getEffortLabel,
  getEffortClass,
  getPlanBlockKey,
} from "../utils/appUtils.js";

function PlanPage({
  planBlocks,
  startTime,
  setStartTime,
  generatePlan,
  clearPlan,
  movePlanStudyBlock,
  updatePlanBlockDuration,
  removePlanBlock,
  reorderPlanBlock,
  planMoveFeedback,
  completeTaskFromPlan,
  hoursAvailable,
  setHoursAvailable,
}) {
  const studyPlanBlocks = planBlocks.filter((block) => block.type === "study");
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [durationDraft, setDurationDraft] = useState("");
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [dragOverBlockId, setDragOverBlockId] = useState(null);
  const [droppedBlockId, setDroppedBlockId] = useState(null);
  const planBlockNodesRef = useRef(new Map());
  const flipFirstRectsRef = useRef(null);
  const flipAnimationFrameRef = useRef(null);
  const activeDragIdRef = useRef(null);
  const lastDragOverIdRef = useRef(null);
  const dropSettleTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(flipAnimationFrameRef.current);
      clearTimeout(dropSettleTimerRef.current);
    };
  }, []);

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
        key === `study-${planMoveFeedback?.taskId}`
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

  function handleMovePlanStudyBlock(taskId, direction) {
    flipFirstRectsRef.current = getPlanBlockRects();
    movePlanStudyBlock(taskId, direction);
  }

  function openBlockEditor(block) {
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
    removePlanBlock(blockId);
    cancelBlockEdit();
  }

  function resetDragState() {
    activeDragIdRef.current = null;
    lastDragOverIdRef.current = null;
    setDraggedBlockId(null);
    setDragOverBlockId(null);
  }

  function handleDragStart(event, blockId) {
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
    setDragOverBlockId(overBlockId);

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
      lastDragOverIdRef.current === overBlockId
    ) {
      return;
    }

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

    event.preventDefault();
    flipFirstRectsRef.current = getPlanBlockRects();
    reorderPlanBlock(blockId, planBlocks[nextIndex].id);
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Today’s plan</p>
        <h2>Build a study plan</h2>
        <p>Use your available time and task list to generate a simple schedule.</p>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h3>Plan</h3>

          <div className="plan-actions">
            {planBlocks.length > 0 && (
              <button className="small-button secondary" onClick={clearPlan}>
                Clear
              </button>
            )}

            <button className="small-button" onClick={generatePlan}>
              {planBlocks.length > 0 ? "Regenerate" : "Plan my day"}
            </button>
          </div>
        </div>

        <div className="setup-row">
          <label>
            <span>Hours available</span>
            <input
              type="number"
              min="0"
              max="12"
              value={hoursAvailable}
              onChange={(event) => setHoursAvailable(event.target.value)}
            />
          </label>

          <label>
            <span>Start time</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
        </div>

        {planBlocks.length === 0 && (
          <div className="empty-plan">
            <h3>Ready when you are.</h3>
            <p>
              Set your available hours, choose a start time, then generate a
              simple study plan.
            </p>
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

          const studyIndex =
            block.type === "study"
              ? studyPlanBlocks.findIndex(
                  (studyBlock) => studyBlock.taskId === block.taskId
                )
              : -1;
          const isFirstStudyBlock = studyIndex === 0;
          const isLastStudyBlock = studyIndex === studyPlanBlocks.length - 1;
          const isMovedStudyBlock =
            block.type === "study" && planMoveFeedback?.taskId === block.taskId;
          const moveClassName = isMovedStudyBlock ? " plan-block-moved" : "";
          const dragClassName = `${
            draggedBlockId === block.id ? " plan-block-dragging" : ""
          }${dragOverBlockId === block.id ? " plan-block-drag-over" : ""}${
            droppedBlockId === block.id ? " plan-block-dropped" : ""
          }`;

          return (
            <div
              className={
                block.type === "break"
                  ? `plan-block break-block${dragClassName}`
                  : `plan-block${moveClassName}${dragClassName}`
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
                </div>
                <div className="plan-block-header-actions">
                  <button
                    type="button"
                    className="plan-drag-handle"
                    draggable={editingBlockId !== block.id}
                    disabled={editingBlockId === block.id}
                    aria-label={`Move ${block.title}. Use drag or arrow keys.`}
                    title="Drag to reorder"
                    onKeyDown={(event) =>
                      handleDragHandleKeyDown(event, block.id)
                    }
                  >
                    <span aria-hidden="true">⠿</span>
                  </button>
                  <button
                    type="button"
                    className="plan-edit-button"
                    aria-expanded={editingBlockId === block.id}
                    onClick={() =>
                      editingBlockId === block.id
                        ? cancelBlockEdit()
                        : openBlockEditor(block)
                    }
                  >
                    {editingBlockId === block.id ? "Close" : "Edit"}
                  </button>
                </div>
              </div>

              {block.type === "study" && (
                <div className="plan-study-meta">
                  <p className="plan-subject">{block.subject}</p>
                  <span className={`effort-pill ${getEffortClass(block.effort)}`}>
                    {getEffortLabel(block.effort)} · {block.effort}/5
                  </span>
                </div>
              )}

              <h3>{block.title}</h3>
              <p>{block.tip}</p>

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
                      className="remove-plan-block-button"
                      onClick={() => handleRemovePlanBlock(block.id)}
                    >
                      {block.type === "break" ? "Remove break" : "Remove from plan"}
                    </button>
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

              {block.type === "study" && editingBlockId !== block.id && (
                <div className="plan-block-controls">
                  <button
                    type="button"
                    className="move-plan-button"
                    onClick={() => handleMovePlanStudyBlock(block.taskId, -1)}
                    disabled={isFirstStudyBlock}
                  >
                    Move up
                  </button>

                  <button
                    type="button"
                    className="move-plan-button"
                    onClick={() => handleMovePlanStudyBlock(block.taskId, 1)}
                    disabled={isLastStudyBlock}
                  >
                    Move down
                  </button>

                  <button
                    type="button"
                    className="complete-plan-button"
                    onClick={() => completeTaskFromPlan(block.taskId)}
                  >
                    Mark task done
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

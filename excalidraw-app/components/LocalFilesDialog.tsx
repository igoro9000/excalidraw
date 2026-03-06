import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { ScenesIndexedDBAdapter, type SavedScene } from "../data/LocalData";

const formatDate = (ms: number) => {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface Props {
  excalidrawAPI: ExcalidrawImperativeAPI;
  activeSceneId: string | null;
  onSceneActivated: (id: string | null) => void;
  onOpenScene: (scene: SavedScene) => void;
  onClose: () => void;
}

export const LocalFilesDialog: React.FC<Props> = ({
  excalidrawAPI,
  activeSceneId,
  onSceneActivated,
  onOpenScene,
  onClose,
}) => {
  const [scenes, setScenes] = useState<SavedScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    const list = await ScenesIndexedDBAdapter.list();
    setScenes(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleOpen = useCallback(
    async (scene: SavedScene) => {
      await ScenesIndexedDBAdapter.setLastActiveId(scene.id);
      onSceneActivated(scene.id);
      onClose();
      // Scene loading happens in App.tsx after dialog is closed
      onOpenScene(scene);
    },
    [onSceneActivated, onClose, onOpenScene],
  );

  const handleSaveCurrent = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    const now = Date.now();
    const id = `scene-${now}-${Math.random().toString(36).slice(2)}`;
    const scene: SavedScene = {
      id,
      name: trimmed,
      elements,
      appState: clearAppStateForLocalStorage(appState),
      files,
      created: now,
      modified: now,
    };
    await ScenesIndexedDBAdapter.save(scene);
    await ScenesIndexedDBAdapter.setLastActiveId(id);
    onSceneActivated(id);
    setNewName("");
    await refreshList();
  }, [excalidrawAPI, newName, onSceneActivated, refreshList]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this drawing?")) {
        return;
      }
      await ScenesIndexedDBAdapter.delete(id);
      if (id === activeSceneId) {
        await ScenesIndexedDBAdapter.clearLastActiveId();
        onSceneActivated(null);
      }
      await refreshList();
    },
    [activeSceneId, onSceneActivated, refreshList],
  );

  const handleRenameStart = useCallback((scene: SavedScene) => {
    setRenamingId(scene.id);
    setRenameValue(scene.name);
  }, []);

  const handleRenameConfirm = useCallback(
    async (scene: SavedScene) => {
      const trimmed = renameValue.trim();
      if (trimmed && trimmed !== scene.name) {
        const updated: SavedScene = {
          ...scene,
          name: trimmed,
          modified: Date.now(),
        };
        await ScenesIndexedDBAdapter.save(updated);
        await refreshList();
      }
      setRenamingId(null);
    },
    [renameValue, refreshList],
  );

  const handleNewDrawing = useCallback(async () => {
    excalidrawAPI.resetScene();
    await ScenesIndexedDBAdapter.clearLastActiveId();
    onSceneActivated(null);
    onClose();
  }, [excalidrawAPI, onSceneActivated, onClose]);

  return (
    <Dialog title="Local Drawings" onCloseRequest={onClose} size="regular">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Save current section */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "12px",
            background: "var(--color-surface-mid)",
            borderRadius: "8px",
          }}
        >
          <input
            type="text"
            placeholder="Name for current drawing..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveCurrent()}
            style={{
              flex: 1,
              padding: "6px 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              background: "var(--color-surface-lowest)",
              color: "var(--color-on-surface)",
              fontSize: "13px",
            }}
          />
          <button
            onClick={handleSaveCurrent}
            disabled={!newName.trim()}
            style={{
              padding: "6px 14px",
              background: "var(--color-primary)",
              color: "var(--color-primary-contrast)",
              border: "none",
              borderRadius: "4px",
              cursor: newName.trim() ? "pointer" : "not-allowed",
              opacity: newName.trim() ? 1 : 0.5,
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Save as new
          </button>
          <button
            onClick={handleNewDrawing}
            style={{
              padding: "6px 14px",
              background: "var(--color-surface-high)",
              color: "var(--color-on-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            New drawing
          </button>
        </div>

        {/* Scene list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px", opacity: 0.6 }}>
            Loading...
          </div>
        ) : scenes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", opacity: 0.6 }}>
            No saved drawings yet. Save the current drawing above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {scenes.map((scene) => (
              <div
                key={scene.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  background:
                    scene.id === activeSceneId
                      ? "var(--color-primary-light)"
                      : "var(--color-surface-mid)",
                  border:
                    scene.id === activeSceneId
                      ? "1px solid var(--color-primary)"
                      : "1px solid transparent",
                  borderRadius: "6px",
                }}
              >
                {/* Name / rename input */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renamingId === scene.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleRenameConfirm(scene);
                        } else if (e.key === "Escape") {
                          setRenamingId(null);
                        }
                      }}
                      onBlur={() => handleRenameConfirm(scene)}
                      style={{
                        width: "100%",
                        padding: "3px 6px",
                        border: "1px solid var(--color-primary)",
                        borderRadius: "4px",
                        background: "var(--color-surface-lowest)",
                        color: "var(--color-on-surface)",
                        fontSize: "13px",
                      }}
                    />
                  ) : (
                    <>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "13px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {scene.name}
                        {scene.id === activeSceneId && (
                          <span
                            style={{
                              marginLeft: "6px",
                              fontSize: "10px",
                              opacity: 0.7,
                              fontWeight: 400,
                            }}
                          >
                            (active)
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          opacity: 0.6,
                          marginTop: "2px",
                        }}
                      >
                        {formatDate(scene.modified)}
                        {" · "}
                        {scene.elements.length} element
                        {scene.elements.length !== 1 ? "s" : ""}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                {renamingId !== scene.id && (
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button
                      onClick={() => handleOpen(scene)}
                      title="Open"
                      style={btnStyle("var(--color-primary)")}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleRenameStart(scene)}
                      title="Rename"
                      style={btnStyle("var(--color-surface-high)")}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(scene.id)}
                      title="Delete"
                      style={btnStyle(
                        "var(--color-danger)",
                        "var(--color-danger-text, white)",
                      )}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};

const btnStyle = (
  bg: string,
  color = "var(--color-on-surface)",
): React.CSSProperties => ({
  padding: "4px 10px",
  background: bg,
  color,
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
});

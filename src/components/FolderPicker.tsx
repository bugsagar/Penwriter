import { useState, useEffect } from "react";
import { Folder, X } from "lucide-react";

interface FolderPickerProps {
  open: boolean;
  onClose: () => void;
  onFolderSelect: (path: string) => void;
}

export function FolderPicker({ open, onClose, onFolderSelect }: FolderPickerProps) {
  const [folders, setFolders] = useState<{ path: string; name: string }[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const normalize = (list: unknown): { path: string; name: string }[] => {
    if (!Array.isArray(list)) return [];
    return list.map((f) =>
      typeof f === "string" ? { path: f, name: f } : (f as { path: string; name: string }),
    );
  };

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setIsLoading(true);
    fetch("http://localhost:5173/").then((r) => r.text()).then((html) => {
      const match = html.match(/<meta name="folder" content="([^)]*)" >/);
      if (match) {
        const path = match[1];
        fetch(`http://localhost:5173/api/folders?path=${path}`).then((r) => r.json()).then((data) => {
          if (data.error) {
            setFolders([]);
          } else {
            setFolders(normalize(data.folders));
          }
        }).catch(() => setFolders([])).finally(() => setIsLoading(false));
      } else {
        setFolders([]);
        setIsLoading(false);
      }
    }).catch(() => { setFolders([]); setIsLoading(false); });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (open && !searchQuery) {
      setIsLoading(true);
      fetch(`http://localhost:5173/api/folders?path=${currentFolder}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setFolders([]);
          } else {
            setFolders(normalize(data.folders));
          }
        })
        .catch(() => setFolders([]))
        .finally(() => setIsLoading(false));
    }
  }, [open, currentFolder]);

  useEffect(() => {
    if (open && searchQuery) {
      setIsLoading(true);
      fetch(`http://localhost:5173/api/folders?path=${currentFolder}&query=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setFolders([]);
          } else {
            setFolders(normalize(data.folders));
          }
        })
        .catch(() => setFolders([]))
        .finally(() => setIsLoading(false));
    }
  }, [open, currentFolder, searchQuery]);

  const handleFolderSelect = (path: string) => {
    setCurrentFolder(path);
    setFolders([]);
    setSearchQuery("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="flex h-[70vh] w-[600px] max-w-full sm:h-[55vh] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl dark:border-ink-800 dark:bg-ink-900">
        <div className="flex items-center justify-between border-b border-ink-200 p-4 dark:border-ink-800">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-ink-500" />
            <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">Select Save Folder</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-ink-200 p-3 dark:border-ink-800">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search folders..."
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brass-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
            />
            <button onClick={() => { setCurrentFolder("/"); setFolders([]); setSearchQuery(""); }} className="rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800">
              All Drives
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {folders.length === 0 ? (
              <div className="flex h-full items-center justify-center text-ink-400">
                {isLoading
                  ? "Loading..."
                  : currentFolder === "" ? "No folders found" : "No folders found"}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {folders.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => handleFolderSelect(folder.path)}
                    className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white p-3 text-left hover:border-brass-400 hover:shadow-sm dark:border-ink-700 dark:bg-ink-900 dark:hover:border-brass-500"
                  >
                    <Folder className="h-4 w-4 text-ink-400" />
                    <span className="flex-1 truncate text-sm text-ink-700 dark:text-ink-300">{folder.name || folder.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-ink-200 p-3 dark:border-ink-800">
            <button
              onClick={onClose}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800"
            >
              Cancel
            </button>
            <button
              disabled={!currentFolder}
              onClick={() => {
                onFolderSelect(currentFolder)
                onClose()
              }}
              className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-ink-50 dark:text-ink-900"
            >
              Select folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

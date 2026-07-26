import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Header } from "./components/Header";
import { Omnibar } from "./components/Omnibar";
import { MediaGrid } from "./components/MediaGrid";
import { DeepPlayerModal } from "./components/DeepPlayerModal";
import { CullingStudio, CullMode } from "./components/CullingStudio";
import { LandingFoyer } from "./components/LandingFoyer";
import { Sidebar } from "./components/Sidebar";
import { CustomDialog, DialogConfig } from "./components/Dialog";
import { fetchMedia, searchMedia, exportAlbum, undoExport, emptyTrash } from "./lib/api";
import { applySessionAccent } from "./utils/colorSampler";
import type { ParentMedia } from "./types";
import { Download, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { imageUrlFor } from "./lib/api";

type WorkspaceTab = "home" | "search" | "cull";
type MediaFilter = "all" | "photo" | "video";

export default function App() {
  // Global Data
  const [library, setLibrary] = useState<ParentMedia[]>([]);
  const [searchResults, setSearchResults] = useState<ParentMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Routing State
  const [location, setLocation] = useLocation();
  const showFoyer = location === "/" || location === "";
  const workspace: WorkspaceTab = location === "/search" ? "search" 
                                : location === "/cull" ? "cull" 
                                : "home";

  // UX State
  const [cullMode, setCullMode] = useState<CullMode>("lobby");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParent, setSelectedParent] = useState<ParentMedia | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const handleToggleReviewed = useCallback((parentId: string, reviewed: boolean) => {
    setReviewedIds(prev => {
      const next = new Set(prev);
      if (reviewed) next.add(parentId);
      else next.delete(parentId);
      return next;
    });
  }, []);

  // Dialog State
  const [dialogConfig, setDialogConfig] = useState<DialogConfig>({ isOpen: false, type: "alert", title: "" });

  const showAlert = (title: string, message?: string) => {
    return new Promise<void>((resolve) => {
      setDialogConfig({
        isOpen: true, type: "alert", title, message,
        onConfirm: () => { setDialogConfig(prev => ({ ...prev, isOpen: false })); resolve(); },
        onCancel: () => { setDialogConfig(prev => ({ ...prev, isOpen: false })); resolve(); }
      });
    });
  };

  const showPrompt = (title: string, defaultValue?: string) => {
    return new Promise<string | null>((resolve) => {
      setDialogConfig({
        isOpen: true, type: "prompt", title, defaultValue,
        onConfirm: (val) => { setDialogConfig(prev => ({ ...prev, isOpen: false })); resolve(val || null); },
        onCancel: () => { setDialogConfig(prev => ({ ...prev, isOpen: false })); resolve(null); }
      });
    });
  };

  const showConfirm = (title: string, message?: string) => {
    return new Promise<boolean>((resolve) => {
      setDialogConfig({
        isOpen: true, type: "confirm", title, message,
        onConfirm: () => { setDialogConfig(prev => ({ ...prev, isOpen: false })); resolve(true); },
        onCancel: () => { setDialogConfig(prev => ({ ...prev, isOpen: false })); resolve(false); }
      });
    });
  };

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    const { items } = await fetchMedia(100);
    setLibrary(items);
    
    // Sample dominant colour from first few capsule thumbnails before revealing grid
    const thumbUrls = items
      .slice(0, 5)
      .flatMap((p) => p.capsules.slice(0, 1))
      .map((c) => imageUrlFor(c.capsule_id));
    if (thumbUrls.length > 0) {
      await applySessionAccent(thumbUrls);
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Dismiss foyer on global Cmd+K
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (showFoyer) {
          setLocation("/library");
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [showFoyer]);

  // Navigate from Omnibar quick actions
  function handleOmnibarNavigate(ws: "home" | "search" | "cull") {
    if (ws === "home") setLocation("/library");
    else if (ws === "search") setLocation("/search");
    else if (ws === "cull") {
      setCullMode("lobby");
      setLocation("/cull");
    }
  }

  // Enhancement #8: tag chip search fires from DeepPlayerModal
  function handleTagSearch(tag: string) {
    setSearchQuery(tag);
    setLocation("/search");
    setIsLoading(true);
    searchMedia(tag).then(({ items }) => {
      setSearchResults(items);
      setIsLoading(false);
    });
    setSelectedParent(null);
  }

  // --- ACTIONS ---
  async function handleSearch(q: string) {
    setSearchQuery(q);
    setIsLoading(true);
    const { items } = await searchMedia(q);
    setSearchResults(items);
    setIsLoading(false);
  }

  async function triggerExport(itemsToExport: ParentMedia[], defaultName: string) {
    if (itemsToExport.length === 0) return;
    const albumName = await showPrompt("Name your export catalog", defaultName);
    if (!albumName) return;

    setIsExporting(true);
    try {
      const ids = itemsToExport.map(i => i.parent_id);
      await exportAlbum(albumName, ids);
      await showAlert("Export Complete", `Successfully generated virtual album: ${albumName}. You can find it in the Sila Exports folder.`);
    } catch (e) {
      await showAlert("Export Failed", "Failed to generate virtual album.");
    } finally {
      setIsExporting(false);
    }
  }

  // --- THE SMART UNDO ---
  async function triggerUndo() {
    try {
      const data = await undoExport();
      if (data.status === "empty") {
        await showAlert("Nothing to undo", "No recent exports found in the ledger.");
      } else {
        await showAlert("Undo Successful", data.message);
      }
    } catch (e) {
      await showAlert("Undo Failed", "Failed to rollback the last export operation.");
    }
  }

  // --- THE HARD DELETE ---
  async function handleEmptyTrash() {
    const confirmed = await showConfirm("Empty Trash?", "WARNING: This will permanently delete the source files from your hard drive. Proceed?");
    if (!confirmed) return;
    
    try {
      await emptyTrash();
      await showAlert("Trash Emptied", "The source files have been permanently deleted.");
      loadInitial(); // Refresh the library!
    } catch (e) {
      await showAlert("Error", "Failed to empty trash.");
    }
  }

  // --- RENDER HELPERS ---
  const homeItems = library.filter(item => mediaFilter === "all" || item.media_type === mediaFilter);
  // THE SEARCH CANVAS POPULATOR
  const searchDisplayItems = searchQuery ? searchResults : homeItems;

  return (
    <div className="relative min-h-screen aesop-paper text-[--color-aesop-ink]">
      {workspace !== "search" && !showFoyer && (
        <Omnibar
          variant="global-overlay"
          onSearch={(q) => {
            setSearchQuery(q);
            setLocation("/search");
          }}
          onClear={() => setSearchQuery("")}
          onNavigate={handleOmnibarNavigate}
          isSearching={isLoading}
          initialQuery={searchQuery}
        />
      )}
      <AnimatePresence mode="wait">
        {showFoyer ? (
          <motion.div
            key="foyer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <LandingFoyer
              library={library}
              libraryCount={library.length}
              isLoading={isLoading}
              onEnter={(ws) => {
                if (ws === "home") setLocation("/library");
                else if (ws === "search") setLocation("/search");
                else if (ws === "cull") {
                  setCullMode("lobby");
                  setLocation("/cull");
                }
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="workspace"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex min-h-screen relative"
          >
            <Sidebar
              workspace={workspace}
              libraryCount={library.length}
              cullQueueCount={library.filter(p => !reviewedIds.has(p.parent_id) && (!p.capsules || p.capsules.length === 0 || !p.capsules.every(c => c.is_junk === 1))).length}
              onNavigate={(ws) => {
                if (ws === "home") setLocation("/library");
                else if (ws === "search") setLocation("/search");
                else if (ws === "cull") {
                  setCullMode("lobby");
                  setLocation("/cull");
                }
              }}
            />

            <div className="flex flex-col flex-1" style={{ paddingLeft: "72px" }}>
      <Header count={library.length} isLoading={isLoading} isMock={false} onLogoClick={() => setLocation("/")} />

      <main className="relative mx-auto w-full max-w-[1120px] px-8 pb-40 pt-10">
        <AnimatePresence mode="wait">
          {/* WORKSPACE: HOME */}
          {workspace === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            >
              {/* Library Title */}
              <div className="mb-8">
                <h1 className="text-[48px] font-light leading-none tracking-tight text-aesop-ink" style={{ fontFamily: "var(--font-aesop-serif)" }}>Library</h1>
                <p className="text-[10px] uppercase tracking-[0.3em] text-aesop-ink/40 mt-2">{library.length.toLocaleString()} moments</p>
              </div>
              <div className="mb-10 flex items-end justify-between border-b border-[--color-aesop-ink]/10 pb-4">
                <div className="flex items-center gap-6">
                  {(["all", "photo", "video"] as MediaFilter[]).map((tab) => {
                    const isActive = mediaFilter === tab;
                    return (
                      <motion.button
                        key={tab}
                        whileTap={{ scale: 0.92, opacity: 0.8 }}
                        onClick={() => setMediaFilter(tab)}
                        className={`relative text-[10px] uppercase tracking-[0.3em] pb-1 transition-colors ${
                          isActive
                            ? "text-[--color-aesop-ink] font-bold"
                            : "text-[--color-aesop-ink]/40 cursor-pointer hover:text-[--color-aesop-ink]/80"
                        }`}
                      >
                        {tab}
                        {isActive && (
                          <motion.div
                            layoutId="activeFilterUnderline"
                            className="absolute bottom-0 left-0 right-0 h-[2px] bg-[--color-aesop-ink]"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <MediaGrid
                items={homeItems}
                isLoading={isLoading}
                isMock={false}
                onItemSelect={(item) => setSelectedParent(item)}
              />
            </motion.div>
          )}

          {/* WORKSPACE: SEARCH & FILTER */}
          {workspace === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="mb-10 flex flex-col items-center text-center pt-8">
                <h1 className="text-2xl mb-6 text-[--color-aesop-ink]/60" style={{ fontFamily: "var(--font-aesop-serif)" }}>Moment Scout</h1>
                <div className="w-full max-w-2xl">
                  <Omnibar
                    onSearch={handleSearch}
                    onClear={() => setSearchQuery("")}
                    onNavigate={handleOmnibarNavigate}
                    isSearching={isLoading}
                    initialQuery={searchQuery}
                  />
                </div>
              </div>
              
              <div className="mb-6 flex justify-between items-center border-b border-[--color-aesop-ink]/10 pb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[--color-aesop-ink]/50">
                  {searchQuery ? `Found ${searchResults.length} master files` : "Explore your entire catalog"}
                </span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={triggerUndo}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[--color-aesop-ink]/40 hover:text-[--color-aesop-ink] transition-colors cursor-pointer"
                    title="Undo Last Export"
                  >
                    <RotateCcw size={12} />
                    <span className="hidden sm:inline">Undo</span>
                  </button>
                  {searchQuery && (
                    <button 
                      onClick={() => {
                        const defaultName = searchQuery
                          .trim()
                          .split(/\s+/)
                          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ");
                        triggerExport(searchResults, defaultName);
                      }}
                      disabled={isExporting || searchResults.length === 0}
                      className="flex items-center gap-2 border border-[--color-aesop-ink]/20 bg-[--color-aesop-ink]/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] transition-colors hover:bg-[--color-aesop-ink]/10 disabled:opacity-50 cursor-pointer"
                    >
                      <Download size={12} /> Export Results
                    </button>
                  )}
                </div>
              </div>
              <LayoutGroup>
                <MediaGrid
                  items={searchDisplayItems}
                  isLoading={isLoading}
                  isMock={false}
                  query={searchQuery}
                  onItemSelect={(item) => setSelectedParent(item)}
                />
              </LayoutGroup>
            </motion.div>
          )}

          {/* WORKSPACE: CULLING STUDIO */}
          {workspace === "cull" && (
            <motion.div
              key="cull"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            >
              <CullingStudio 
                library={library} 
                onHardDelete={handleEmptyTrash}
                mode={cullMode}
                setMode={setCullMode}
                reviewedIds={reviewedIds}
                onToggleReviewed={handleToggleReviewed}
                onClose={() => setLocation("/library")}
                onStatusUpdate={(parentId, isJunk) => {
                  setLibrary(prev => prev.map(p => 
                    p.parent_id === parentId 
                      ? { ...p, capsules: p.capsules.map(c => ({ ...c, is_junk: isJunk })) }
                      : p
                  ));
                }} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
            </div>

      {/* OVERLAYS */}
      <AnimatePresence>
        {selectedParent && (
          <DeepPlayerModal
            item={selectedParent}
            onClose={() => setSelectedParent(null)}
            onTagSearch={handleTagSearch}
          />
        )}
      </AnimatePresence>

      <CustomDialog config={dialogConfig} />
    </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bookmark,
  FileText,
  Clock,
  Plus,
  Play,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { LearningNote } from "../types";
import {
  getVideoNotes,
  createLearningNote,
  updateLearningNote,
  deleteLearningNote,
} from "../services/learningService";
import { useVideoPlayer } from "../context/VideoPlayerContext";
import { formatTimestamp, parseTimestamp } from "../utils/timestamp";

interface VideoNotesPanelProps {
  videoId: string;
  isAuthenticated: boolean;
  durationSeconds?: number | null;
}

type TabType = "all" | "note" | "bookmark";

export function VideoNotesPanel({
  videoId,
  isAuthenticated,
}: VideoNotesPanelProps) {
  const player = useVideoPlayer();

  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>("all");

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [formTimestampStr, setFormTimestampStr] = useState("00:00");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formType, setFormType] = useState<"note" | "bookmark">("note");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Deleting confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load notes on mount and when videoId changes
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getVideoNotes(videoId)
      .then((data) => {
        if (cancelled) return;
        setNotes(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load your notes and bookmarks. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, isAuthenticated]);

  const refreshNotes = useCallback(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    getVideoNotes(videoId)
      .then((data) => setNotes(data))
      .catch(() => setError("Failed to load your notes and bookmarks. Please try again."))
      .finally(() => setLoading(false));
  }, [videoId, isAuthenticated]);

  // Flash success message helper
  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Open creation form capturing current video time
  const handleOpenCreate = (type: "note" | "bookmark") => {
    setError(null);
    setFormError(null);
    const currentTime = player.getCurrentTime();
    setFormTimestampStr(formatTimestamp(currentTime));
    setFormTitle(type === "bookmark" ? "Important moment" : "");
    setFormContent("");
    setFormType(type);
    setEditingNoteId(null);
    setIsFormOpen(true);
  };

  // Quick 1-click Bookmark at current time
  const handleQuickBookmark = async () => {
    if (!isAuthenticated) return;
    const currentTime = player.getCurrentTime();
    const timeFormatted = formatTimestamp(currentTime);
    setSubmitting(true);
    setError(null);
    try {
      const newNote = await createLearningNote({
        video_id: videoId,
        timestamp_seconds: Math.floor(currentTime),
        title: `Bookmark at ${timeFormatted}`,
        content: "",
        note_type: "bookmark",
      });
      setNotes((prev) =>
        [...prev, newNote].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
      );
      flashSuccess(`Bookmark saved at ${timeFormatted}!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create bookmark";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit form
  const handleOpenEdit = (note: LearningNote) => {
    setError(null);
    setFormError(null);
    setFormTimestampStr(formatTimestamp(note.timestamp_seconds));
    setFormTitle(note.title || "");
    setFormContent(note.content);
    setFormType(note.note_type);
    setEditingNoteId(note.id);
    setIsFormOpen(true);
  };

  // Close form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingNoteId(null);
    setFormError(null);
    setFormTitle("");
    setFormContent("");
  };

  // Re-capture current time while form is open
  const handleSyncCurrentTime = () => {
    const currentTime = player.getCurrentTime();
    setFormTimestampStr(formatTimestamp(currentTime));
  };

  // Save note / bookmark
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedSeconds = parseTimestamp(formTimestampStr);
    if (parsedSeconds < 0) {
      setFormError("Please enter a valid non-negative timestamp (e.g. 04:15).");
      return;
    }

    if (formType === "note" && !formContent.trim()) {
      setFormError("Note content cannot be empty.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingNoteId) {
        const updated = await updateLearningNote(editingNoteId, {
          timestamp_seconds: parsedSeconds,
          title: formTitle.trim() || (formType === "bookmark" ? "Bookmark" : null),
          content: formContent.trim(),
          note_type: formType,
        });
        setNotes((prev) =>
          prev
            .map((n) => (n.id === editingNoteId ? updated : n))
            .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
        );
        flashSuccess("Note updated successfully.");
      } else {
        const created = await createLearningNote({
          video_id: videoId,
          timestamp_seconds: parsedSeconds,
          title: formTitle.trim() || (formType === "bookmark" ? "Bookmark" : null),
          content: formContent.trim(),
          note_type: formType,
        });
        setNotes((prev) =>
          [...prev, created].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
        );
        flashSuccess(
          formType === "bookmark"
            ? `Bookmark saved at ${formatTimestamp(parsedSeconds)}.`
            : `Note added at ${formatTimestamp(parsedSeconds)}.`
        );
      }
      handleCloseForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save note";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete note
  const handleDelete = async (noteId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteLearningNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setDeletingId(null);
      flashSuccess("Note deleted successfully.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete note";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Seek video
  const handleSeek = (seconds: number) => {
    player.seekTo(seconds);
  };

  // Filter notes
  const notesCount = notes.filter((n) => n.note_type === "note").length;
  const bookmarksCount = notes.filter((n) => n.note_type === "bookmark").length;
  const filteredNotes = notes.filter((n) => {
    if (activeTab === "note") return n.note_type === "note";
    if (activeTab === "bookmark") return n.note_type === "bookmark";
    return true;
  });

  return (
    <div className="flex flex-col bg-[#25343F] border border-[#BFC9D1]/15 rounded-2xl overflow-hidden shadow-lg w-full">
      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-[#BFC9D1]/10 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF9B51]/15 text-[#FF9B51] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#EAEFEF]">Notes & Bookmarks</h2>
              <p className="text-xs text-[#BFC9D1]">
                {notes.length} saved item{notes.length === 1 ? "" : "s"} for this lecture
              </p>
            </div>
          </div>

          {/* Quick Actions (only for authenticated users) */}
          {isAuthenticated && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleQuickBookmark}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#BFC9D1]/10 hover:bg-[#BFC9D1]/20 text-[#EAEFEF] text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40 disabled:opacity-50"
                title="Quickly bookmark the current timestamp"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#FF9B51]" />
                <span className="hidden sm:inline">Quick</span> Bookmark
              </button>

              <button
                type="button"
                onClick={() => handleOpenCreate("note")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF9B51] text-[#25343F] hover:bg-[#FF9B51]/90 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            </div>
          )}
        </div>

        {/* Tabs: All / Notes / Bookmarks */}
        <div className="flex items-center gap-2 border-t border-[#BFC9D1]/10 pt-3 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeTab === "all"
                ? "bg-[#FF9B51]/20 text-[#FF9B51] font-semibold"
                : "text-[#BFC9D1] hover:text-[#EAEFEF] hover:bg-[#BFC9D1]/5"
            }`}
          >
            All ({notes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("note")}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeTab === "note"
                ? "bg-[#FF9B51]/20 text-[#FF9B51] font-semibold"
                : "text-[#BFC9D1] hover:text-[#EAEFEF] hover:bg-[#BFC9D1]/5"
            }`}
          >
            Notes ({notesCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bookmark")}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeTab === "bookmark"
                ? "bg-[#FF9B51]/20 text-[#FF9B51] font-semibold"
                : "text-[#BFC9D1] hover:text-[#EAEFEF] hover:bg-[#BFC9D1]/5"
            }`}
          >
            Bookmarks ({bookmarksCount})
          </button>
        </div>
      </div>

      {/* Banner Notifications */}
      {successMsg && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-[#FF9B51]/15 border border-[#FF9B51]/30 flex items-center gap-2 text-xs text-[#EAEFEF]">
          <CheckCircle2 className="w-4 h-4 text-[#FF9B51] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-2 text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refreshNotes}
            className="underline hover:text-white font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Inline Form (Create / Edit) */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmitForm}
          className="m-4 sm:m-5 p-4 bg-[#BFC9D1]/5 border border-[#BFC9D1]/15 rounded-xl flex flex-col gap-3.5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#EAEFEF]">
              {editingNoteId ? "Edit Item" : formType === "bookmark" ? "New Bookmark" : "New Note"}
            </h3>
            <button
              type="button"
              onClick={handleCloseForm}
              className="text-[#BFC9D1] hover:text-[#EAEFEF] p-1 rounded-lg hover:bg-[#BFC9D1]/10 transition-colors"
              aria-label="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form Controls: Type + Timestamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#BFC9D1] mb-1">
                Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as "note" | "bookmark")}
                className="w-full bg-[#25343F] border border-[#BFC9D1]/20 rounded-lg px-3 py-1.5 text-xs text-[#EAEFEF] focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40"
              >
                <option value="note">Note (with detailed text)</option>
                <option value="bookmark">Bookmark (quick marker)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#BFC9D1] mb-1">
                Timestamp (MM:SS or HH:MM:SS)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formTimestampStr}
                  onChange={(e) => setFormTimestampStr(e.target.value)}
                  placeholder="00:00"
                  className="flex-1 bg-[#25343F] border border-[#BFC9D1]/20 rounded-lg px-3 py-1.5 text-xs text-[#EAEFEF] font-mono focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40"
                />
                <button
                  type="button"
                  onClick={handleSyncCurrentTime}
                  className="px-2.5 py-1.5 rounded-lg bg-[#BFC9D1]/10 hover:bg-[#BFC9D1]/20 text-[#BFC9D1] hover:text-[#EAEFEF] text-xs transition-colors shrink-0 flex items-center gap-1"
                  title="Capture current video playback time"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Current Time</span>
                </button>
              </div>
            </div>
          </div>

          {/* Optional Title / Label */}
          <div>
            <label className="block text-xs font-medium text-[#BFC9D1] mb-1">
              Title / Label <span className="text-[#BFC9D1]/50">(optional)</span>
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={formType === "bookmark" ? "e.g. Core Algorithm explanation" : "e.g. Key Takeaway"}
              maxLength={255}
              className="w-full bg-[#25343F] border border-[#BFC9D1]/20 rounded-lg px-3 py-1.5 text-xs text-[#EAEFEF] focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40"
            />
          </div>

          {/* Content (required for note, optional for bookmark) */}
          <div>
            <label className="block text-xs font-medium text-[#BFC9D1] mb-1">
              {formType === "note" ? "Note Body *" : "Notes / Remarks (optional)"}
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={
                formType === "note"
                  ? "Write your personal notes, insights, code pointers..."
                  : "Optional notes for this bookmarked timestamp..."
              }
              rows={3}
              maxLength={5000}
              className="w-full bg-[#25343F] border border-[#BFC9D1]/20 rounded-lg p-3 text-xs text-[#EAEFEF] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40 resize-y"
            />
            <div className="flex justify-end text-[10px] text-[#BFC9D1]/60 mt-1">
              {formContent.length} / 5000 characters
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCloseForm}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#BFC9D1] hover:text-[#EAEFEF] hover:bg-[#BFC9D1]/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-[#FF9B51] text-[#25343F] hover:bg-[#FF9B51]/90 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving..." : editingNoteId ? "Update Item" : "Save Item"}
            </button>
          </div>
        </form>
      )}

      {/* Main Content Area */}
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Unauthenticated View */}
        {!isAuthenticated ? (
          <div className="p-6 text-center rounded-xl bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 flex flex-col items-center gap-3">
            <Clock className="w-8 h-8 text-[#FF9B51]/80" />
            <h3 className="text-sm font-semibold text-[#EAEFEF]">
              Personal Learning Notes & Bookmarks
            </h3>
            <p className="text-xs text-[#BFC9D1] max-w-sm">
              Capture timestamps, write lecture summaries, and jump right to key moments whenever you rewatch.
            </p>
            <Link
              href="/login"
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#FF9B51] text-[#25343F] hover:bg-[#FF9B51]/90 text-xs font-semibold transition-colors"
            >
              Sign In to Take Notes
            </Link>
          </div>
        ) : loading ? (
          /* Loading Skeletons */
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 animate-pulse flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-16 h-5 rounded bg-[#BFC9D1]/15" />
                  <div className="w-24 h-4 rounded bg-[#BFC9D1]/10" />
                </div>
                <div className="w-3/4 h-4 rounded bg-[#BFC9D1]/10" />
                <div className="w-1/2 h-3 rounded bg-[#BFC9D1]/10" />
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          /* Empty States */
          <div className="p-8 text-center rounded-xl bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 flex flex-col items-center gap-2.5">
            {activeTab === "bookmark" ? (
              <Bookmark className="w-8 h-8 text-[#BFC9D1]/40" />
            ) : (
              <FileText className="w-8 h-8 text-[#BFC9D1]/40" />
            )}
            <h3 className="text-sm font-semibold text-[#EAEFEF]">
              {notes.length === 0
                ? "No notes or bookmarks yet"
                : activeTab === "bookmark"
                ? "No bookmarks saved"
                : "No notes saved"}
            </h3>
            <p className="text-xs text-[#BFC9D1] max-w-sm">
              {notes.length === 0
                ? "Click 'Quick Bookmark' or 'Add Note' to capture the current lecture timestamp and record key ideas."
                : `You don't have any items in the ${activeTab} category.`}
            </p>
            {notes.length === 0 && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleQuickBookmark}
                  className="px-3 py-1.5 rounded-lg bg-[#BFC9D1]/10 hover:bg-[#BFC9D1]/20 text-[#EAEFEF] text-xs font-medium transition-colors"
                >
                  Bookmark Current Time
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreate("note")}
                  className="px-3 py-1.5 rounded-lg bg-[#FF9B51] text-[#25343F] hover:bg-[#FF9B51]/90 text-xs font-semibold transition-colors"
                >
                  Write First Note
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Notes & Bookmarks List */
          <div className="flex flex-col gap-3">
            {filteredNotes.map((note) => {
              const formattedTime = formatTimestamp(note.timestamp_seconds);
              const isDeleting = deletingId === note.id;

              return (
                <div
                  key={note.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 hover:border-[#BFC9D1]/25 transition-all flex flex-col gap-2.5"
                >
                  {/* Item Top Bar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {/* Interactive Timestamp Seek Button */}
                      <button
                        type="button"
                        onClick={() => handleSeek(note.timestamp_seconds)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FF9B51]/15 hover:bg-[#FF9B51]/25 text-[#FF9B51] text-xs font-mono font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/50 group"
                        title={`Seek video to ${formattedTime}`}
                        aria-label={`Seek to ${formattedTime}`}
                      >
                        <Play className="w-3 h-3 fill-current group-hover:scale-110 transition-transform" />
                        <span>{formattedTime}</span>
                      </button>

                      {/* Type Badge */}
                      <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-[#25343F] border border-[#BFC9D1]/15 text-[#BFC9D1]">
                        {note.note_type}
                      </span>
                    </div>

                    {/* Actions: Edit, Delete */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(note)}
                        className="p-1.5 text-[#BFC9D1] hover:text-[#EAEFEF] rounded-lg hover:bg-[#BFC9D1]/10 transition-colors"
                        title="Edit note"
                        aria-label="Edit note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {isDeleting ? (
                        <div className="flex items-center gap-1.5 bg-red-500/20 px-2 py-1 rounded-lg">
                          <span className="text-[10px] text-red-200">Delete?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            disabled={submitting}
                            className="text-xs text-red-400 hover:text-red-300 font-bold"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="text-xs text-[#BFC9D1] hover:text-white"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingId(note.id)}
                          className="p-1.5 text-[#BFC9D1] hover:text-red-400 rounded-lg hover:bg-[#BFC9D1]/10 transition-colors"
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title if present */}
                  {note.title && (
                    <h4 className="text-sm font-semibold text-[#EAEFEF] leading-snug">
                      {note.title}
                    </h4>
                  )}

                  {/* Body Content if present */}
                  {note.content && (
                    <p className="text-xs text-[#BFC9D1] whitespace-pre-wrap leading-relaxed break-words">
                      {note.content}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

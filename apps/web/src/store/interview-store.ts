// Small client-side state for an in-progress answer draft.
import { create } from "zustand";
interface InterviewState {
  draft: string;
  setDraft(value: string): void;
  clear(): void;
}
/** Store the current text answer while navigating the interview screen. */
export const useInterviewStore = create<InterviewState>((set) => ({
  draft: "",
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: "" }),
}));

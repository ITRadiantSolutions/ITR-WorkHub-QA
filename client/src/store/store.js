import { configureStore } from "@reduxjs/toolkit";
import sharedDataReducer, { invalidateAllSharedData } from "./sharedDataSlice";
import { DATA_MUTATED_EVENT } from "../services/api";

export const store = configureStore({
  reducer: {
    sharedData: sharedDataReducer,
  },
});

if (typeof window !== "undefined") {
  window.addEventListener(DATA_MUTATED_EVENT, () => {
    store.dispatch(invalidateAllSharedData());
  });
}

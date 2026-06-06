import { createSlice } from '@reduxjs/toolkit';

// Cross-tree state for the Workspace Views Manage drawer (Phase 3).
//
// The drawer is rendered by the module page (e.g. WmsDocumentsPage), but the trigger
// can also come from the sidebar (+N more in WorkspaceViewsSidebarSection) — which
// lives in a different React subtree. A shared Redux slice is the least invasive way
// to coordinate "open the manage drawer for module X" across those subtrees.
//
// Only one drawer is open at a time. The page that mounts the drawer checks
// `openModule` and decides whether to render its drawer.

const initialState = {
  openModule: null, // string | null
};

const workspaceViewsDrawerSlice = createSlice({
  name: 'workspaceViewsDrawer',
  initialState,
  reducers: {
    openManageDrawer(state, action) {
      state.openModule = action.payload || null;
    },
    closeManageDrawer(state) {
      state.openModule = null;
    },
  },
});

export const { openManageDrawer, closeManageDrawer } = workspaceViewsDrawerSlice.actions;
export const selectManageDrawerModule = (state) => state.workspaceViewsDrawer?.openModule || null;
export default workspaceViewsDrawerSlice.reducer;

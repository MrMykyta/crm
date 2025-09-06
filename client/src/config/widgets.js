export const WIDGETS = {
  kpi:         { id:'kpi',         minW:2, minH:2, defaultW:4, defaultH:2, titleKey:'widgets.kpi' },
  funnel:      { id:'funnel',      minW:3, minH:2, defaultW:6, defaultH:3, titleKey:'widgets.funnel' },
  tasks:       { id:'tasks',       minW:3, minH:2, defaultW:4, defaultH:3, titleKey:'widgets.tasks' },
  ordersQueue: { id:'ordersQueue', minW:3, minH:2, defaultW:6, defaultH:3, titleKey:'widgets.ordersQueue' },
  miniCal:     { id:'miniCal',     minW:2, minH:2, defaultW:3, defaultH:2, titleKey:'widgets.calendar' },
};

export const DEFAULT_LAYOUT = [
  { i:'kpi', x:0, y:0, w:4, h:2 },
  { i:'funnel', x:4, y:0, w:6, h:3 },
  { i:'tasks', x:0, y:2, w:4, h:3 },
  { i:'ordersQueue', x:4, y:3, w:6, h:3 },
  { i:'miniCal', x:0, y:5, w:3, h:2 },
];
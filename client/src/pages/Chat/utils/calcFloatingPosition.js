const EDGE_PADDING = 8;
const VERTICAL_GAP = 8;

// clamp: вспомогательная логика компонента.
const clamp = (value, min, max) => {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
};

// toLocalRect: вспомогательная логика компонента.
const toLocalRect = (targetRect, containerRect) => ({
  left: targetRect.left - containerRect.left,
  top: targetRect.top - containerRect.top,
  width: targetRect.width,
  height: targetRect.height,
  right: targetRect.right - containerRect.left,
  bottom: targetRect.bottom - containerRect.top,
});

// calcFloatingPosition: вспомогательная логика компонента.
export default function calcFloatingPosition({
  bubbleEl,
  containerEl,
  prefer = 'left',
  menuSize = {},
  reactionsSize = null,
}) {
  if (!bubbleEl || !containerEl) {
    return {
      left: EDGE_PADDING,
      top: EDGE_PADDING,
      placement: 'fallback',
      reactions: null,
    };
  }

  const bubbleRect = bubbleEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  const bubble = toLocalRect(bubbleRect, containerRect);
  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;

  const menuWidth = Math.max(180, Number(menuSize.width) || 200);
  const menuHeight = Math.max(120, Number(menuSize.height) || 240);

  const minLeft = EDGE_PADDING;
  const maxLeft = Math.max(EDGE_PADDING, containerWidth - menuWidth - EDGE_PADDING);
  const minTop = EDGE_PADDING;
  const maxTop = Math.max(EDGE_PADDING, containerHeight - menuHeight - EDGE_PADDING);

  const isRightPreferred = prefer === 'right';
  const preferredLeft = isRightPreferred ? bubble.right - menuWidth : bubble.left;
  const left = clamp(preferredLeft, minLeft, maxLeft);
  const horizontalPlacement = left === preferredLeft ? prefer : 'clamped';

  const openDownTop = bubble.bottom + VERTICAL_GAP;
  const openUpTop = bubble.top - menuHeight - VERTICAL_GAP;
  const shouldOpenUp = openDownTop > maxTop && openUpTop >= minTop;
  const preferredTop = shouldOpenUp ? openUpTop : openDownTop;
  const top = clamp(preferredTop, minTop, maxTop);
  const verticalPlacement = shouldOpenUp ? 'top' : 'bottom';

  let reactions = null;
  if (reactionsSize) {
    const reactionsWidth = Math.max(128, Number(reactionsSize.width) || 180);
    const reactionsHeight = Math.max(36, Number(reactionsSize.height) || 40);

    const reactionsMaxWidth = Math.max(
      128,
      Math.min(
        Math.round(bubble.width),
        containerWidth - EDGE_PADDING * 2
      )
    );
    const reactionsRenderWidth = Math.min(reactionsWidth, reactionsMaxWidth);

    const centeredLeft = bubble.left + bubble.width / 2 - reactionsRenderWidth / 2;
    const reactionsLeft = clamp(
      centeredLeft,
      EDGE_PADDING,
      Math.max(EDGE_PADDING, containerWidth - reactionsRenderWidth - EDGE_PADDING)
    );

    const topPreferred =
      verticalPlacement === 'bottom'
        ? top - reactionsHeight - VERTICAL_GAP
        : top + menuHeight + VERTICAL_GAP;
    const reactionsTop = clamp(
      topPreferred,
      EDGE_PADDING,
      Math.max(EDGE_PADDING, containerHeight - reactionsHeight - EDGE_PADDING)
    );

    reactions = {
      left: reactionsLeft,
      top: reactionsTop,
      maxWidth: reactionsMaxWidth,
    };
  }

  return {
    left,
    top,
    placement: `${horizontalPlacement}-${verticalPlacement}`,
    reactions,
  };
}


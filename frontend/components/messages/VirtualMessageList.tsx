import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useCallback } from "react";

export interface Message {
  id: number;
  content: string;
  user_id: number;
  conversation_id: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface VirtualMessageListProps {
    messages: Message[];
    renderMessage: (message: Message, index: number) => React.ReactNode;
    height?: number;
    overscan?: number;
    estimateSize?: number;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
}

/**
 * Virtual scrolling component for efficiently rendering large message lists
 * Only renders visible items and nearby items (overscan)
 * Dramatically improves performance with thousands of messages
 *
 * @param messages - Array of message objects
 * @param renderMessage - Render function for each message
 * @param height - Container height in pixels (default: 400)
 * @param overscan - Number of items to render outside viewport (default: 5)
 * @param estimateSize - Estimated height of each item in pixels (default: 80)
 * @param onLoadMore - Callback to load more messages at the top
 * @param isLoadingMore - Whether currently loading more messages
 *
 * @example
 * ```tsx
 * <VirtualMessageList
 *   messages={messages}
 *   renderMessage={(msg) => <MessageItem message={msg} />}
 *   height={600}
 *   onLoadMore={() => fetchMoreMessages()}
 * />
 * ```
 */
export function VirtualMessageList({
  messages,
  renderMessage,
  height = 400,
  overscan = 5,
  estimateSize = 80,
  onLoadMore,
  isLoadingMore = false,
}: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const hasScrolledToTopRef = useRef(false);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin: 0,
  });

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const handleScroll = useCallback(() => {
    if (!parentRef.current || !onLoadMore || isLoadingMore) return;

    const scrollTop = parentRef.current.scrollTop;

    if (scrollTop < 200 && !hasScrolledToTopRef.current) {
      hasScrolledToTopRef.current = true;
      onLoadMore();

      setTimeout(() => {
        hasScrolledToTopRef.current = false;
      }, 500);
    }
  }, [onLoadMore, isLoadingMore]);

  return (
    <div
      ref={parentRef}
      style={{
        height: `${height}px`,
        overflow: "auto",
        position: "relative",
      }}
      onScroll={handleScroll}
      className="flex flex-col"
    >
      {isLoadingMore ? (
        <div className="flex items-center justify-center py-2">
          <div className="text-xs text-gray-400">Loading earlier messages...</div>
        </div>
      ) : null}

      <div
        style={{
          height: `${totalSize}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {items.length > 0 ? (
          items.map((virtualItem) => (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderMessage(messages[virtualItem.index], virtualItem.index)}
            </div>
          ))
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            No messages yet
          </div>
        )}
      </div>
    </div>
  );
}

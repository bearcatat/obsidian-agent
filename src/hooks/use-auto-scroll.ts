import { useRef, useCallback, useState } from 'react';

export function useAutoScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  // 处理滚动事件
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // 检测滚动方向和是否到达底部
    const isScrollingUp = scrollTop < lastScrollTop;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px阈值
    
    // 用户向上滚动时，暂停自动滚动
    if (isScrollingUp && !isAtBottom) {
      setIsUserScrolling(true);
    }
    
    // 用户滚动到底部时，恢复自动滚动
    if (isAtBottom) {
      setIsUserScrolling(false);
    }
    
    // 更新上次滚动位置
    setLastScrollTop(scrollTop);
  }, [lastScrollTop, isUserScrolling]);

  // 自动滚动逻辑 - 只处理流式生成
  const autoScroll = useCallback((isStreaming: boolean) => {
    if (!isStreaming) return;
    
    // 如果用户正在主动滚动，跳过自动滚动
    if (isUserScrolling) return;
    
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [scrollToBottom, isUserScrolling]);

  // 重置用户滚动状态（用于新消息发送时）
  const resetUserScrolling = useCallback(() => {
    setIsUserScrolling(false);
  }, []);

  return {
    containerRef,
    handleScroll,
    autoScroll,
    scrollToBottom,
    resetUserScrolling,
    isUserScrolling
  };
}

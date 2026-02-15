export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const adjustHeight = (scrollDOM: HTMLElement, minHeight?: number) => {
  scrollDOM.style.height = 'auto';
  const height = Math.max(scrollDOM.scrollHeight, minHeight ?? 0);
  scrollDOM.style.height = `${height}px`;
};

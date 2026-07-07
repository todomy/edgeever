export const getStandaloneMobileEditorHref = (memoId: string, returnTo = "/") => {
  const params = new URLSearchParams({
    memoId,
    returnTo,
  });
  return `/mobile-edit.html#${params.toString()}`;
};

export const openStandaloneMobileEditor = (memoId: string, returnTo = "/") => {
  window.location.href = getStandaloneMobileEditorHref(memoId, returnTo);
};

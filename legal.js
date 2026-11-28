document.addEventListener('click', (event) => {
  const copyButton = event.target.closest('[data-copy-email]');
  if (copyButton) copyText(copyButton.dataset.copyEmail, 'Copied email address');
});

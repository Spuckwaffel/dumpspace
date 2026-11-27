const TARGET_WIDTH = 640;

self.onmessage = async ({ data: url }) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(url + ' returned HTTP ' + response.status);

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    if (bitmap.width <= TARGET_WIDTH * 1.5) {
      bitmap.close();
      self.postMessage({ url, blob });
      return;
    }

    const height = Math.round((bitmap.height * TARGET_WIDTH) / bitmap.width);
    const canvas = new OffscreenCanvas(TARGET_WIDTH, height);
    const context = canvas.getContext('2d');

    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, TARGET_WIDTH, height);
    bitmap.close();

    const thumbnail = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });

    self.postMessage({ url, blob: thumbnail });
  } catch {
    self.postMessage({ url, blob: null });
  }
};

// Normalise any browser-decodable image to JPEG/PNG bytes that pdf-lib can embed.
export async function normalizeImage(file) {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return { buffer: await file.arrayBuffer(), type: file.type === 'image/png' ? 'png' : 'jpg' };
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(`"${file.name}" is not an image this browser can read.`); }
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  c.width = 0;
  return { buffer: await blob.arrayBuffer(), type: 'png' };
}

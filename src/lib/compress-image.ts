/** Reduce image dimensions by half before sending it to storage. */
export async function compressImageByHalf(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width / 2));
    canvas.height = Math.max(1, Math.round(bitmap.height / 2));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        resolve,
        file.type,
        file.type === "image/jpeg" || file.type === "image/webp" ? 0.78 : undefined,
      ),
    );
    if (!blob) return file;
    return new File([blob], file.name, {
      type: blob.type || file.type,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

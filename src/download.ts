/**
 * Browser download helper (UI layer — this is the only place the MIDI feature
 * touches the DOM/Blob). The engine produces bytes; this turns them into a file.
 */
export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mime = 'application/octet-stream',
): void {
  // Copy into a freshly allocated ArrayBuffer so the BlobPart type is concrete
  // (Uint8Array is now generic over ArrayBufferLike, which Blob's types reject).
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

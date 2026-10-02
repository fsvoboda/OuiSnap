// Réduit une image avant envoi : JPEG de 2560 px au plus sur le grand côté.
// Suffisant pour un tirage 20x30, et environ cinq fois plus léger que l'original.
const MAX_SIDE = 2560;
const QUALITY = 0.85;

type Source = { image: CanvasImageSource; width: number; height: number; release?: () => void };

async function decode(file: Blob): Promise<Source> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Navigateurs sans createImageBitmap complet : passage par une balise image.
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    return { image, width: image.naturalWidth, height: image.naturalHeight };
  }
}

// zoom > 1 ne garde que le centre de l'image (zoom numérique de l'appareil photo).
export async function toJpeg(input: Blob | HTMLVideoElement, zoom = 1): Promise<Blob> {
  const source: Source =
    input instanceof Blob
      ? await decode(input)
      : { image: input, width: input.videoWidth, height: input.videoHeight };
  if (!source.width || !source.height) throw new Error("Image vide");

  const width = source.width / zoom;
  const height = source.height / zoom;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas
    .getContext("2d")!
    .drawImage(
      source.image,
      (source.width - width) / 2,
      (source.height - height) / 2,
      width,
      height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  source.release?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Conversion impossible"))),
      "image/jpeg",
      QUALITY,
    );
  });
}

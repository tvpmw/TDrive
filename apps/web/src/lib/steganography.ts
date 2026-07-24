/**
  * Steganography utility for encoding hidden vault data into PNG pixels.
  * Uses Least Significant Bit (LSB) embedding on RGBA channels.
  */

export function embedDataInImageData(imageData: ImageData, payload: string): ImageData {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);
  const data = imageData.data;
  
  // Store length in first 32 bits
  const length = bytes.length;
  for (let i = 0; i < 32; i++) {
    const bit = (length >> (31 - i)) & 1;
    data[i * 4] = (data[i * 4] & 0xfe) | bit;
  }

  // Embed byte data
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
      const bit = (byte >> (7 - bitIdx)) & 1;
      const pixelOffset = (32 + i * 8 + bitIdx) * 4;
      if (pixelOffset < data.length) {
        data[pixelOffset] = (data[pixelOffset] & 0xfe) | bit;
      }
    }
  }

  return imageData;
}

export function extractDataFromImageData(imageData: ImageData): string | null {
  const data = imageData.data;
  
  // Read length from first 32 bits
  let length = 0;
  for (let i = 0; i < 32; i++) {
    const bit = data[i * 4] & 1;
    length = (length << 1) | bit;
  }

  if (length <= 0 || length * 8 + 32 > data.length / 4) {
    return null;
  }

  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    let byte = 0;
    for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
      const pixelOffset = (32 + i * 8 + bitIdx) * 4;
      const bit = data[pixelOffset] & 1;
      byte = (byte << 1) | bit;
    }
    bytes[i] = byte;
  }

  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

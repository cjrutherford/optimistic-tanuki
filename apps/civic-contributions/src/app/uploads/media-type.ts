/**
 * What a file is, from its own bytes. The name and the type a browser
 * declares are both the uploader's say-so; the first bytes are not. Only
 * formats a contributor needs for civic evidence are accepted — documents,
 * photographs, and audio — and nothing a browser would run: no HTML, no SVG,
 * no scripts, no archives that could hide any of them.
 */

export interface AcceptedType {
  mediaType: string;
  extension: string;
  describe: string;
}

const SIGNATURES: {
  bytes: (number | null)[];
  offset?: number;
  type: AcceptedType;
}[] = [
  {
    bytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
    type: {
      mediaType: 'application/pdf',
      extension: 'pdf',
      describe: 'PDF document',
    },
  },
  {
    bytes: [0xff, 0xd8, 0xff],
    type: {
      mediaType: 'image/jpeg',
      extension: 'jpg',
      describe: 'JPEG photograph',
    },
  },
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    type: { mediaType: 'image/png', extension: 'png', describe: 'PNG image' },
  },
  // RIFF....WEBP and RIFF....WAVE share the container header.
  {
    bytes: [
      0x52,
      0x49,
      0x46,
      0x46,
      null,
      null,
      null,
      null,
      0x57,
      0x45,
      0x42,
      0x50,
    ],
    type: {
      mediaType: 'image/webp',
      extension: 'webp',
      describe: 'WebP image',
    },
  },
  {
    bytes: [
      0x52,
      0x49,
      0x46,
      0x46,
      null,
      null,
      null,
      null,
      0x57,
      0x41,
      0x56,
      0x45,
    ],
    type: {
      mediaType: 'audio/wav',
      extension: 'wav',
      describe: 'WAV recording',
    },
  },
  {
    bytes: [0x49, 0x44, 0x33],
    type: {
      mediaType: 'audio/mpeg',
      extension: 'mp3',
      describe: 'MP3 recording',
    },
  },
  {
    bytes: [0xff, 0xfb],
    type: {
      mediaType: 'audio/mpeg',
      extension: 'mp3',
      describe: 'MP3 recording',
    },
  },
  {
    bytes: [0x4f, 0x67, 0x67, 0x53],
    type: {
      mediaType: 'audio/ogg',
      extension: 'ogg',
      describe: 'Ogg recording',
    },
  },
  // ISO base media (M4A): "ftyp" at offset 4, then an audio brand.
  {
    bytes: [0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41],
    offset: 4,
    type: {
      mediaType: 'audio/mp4',
      extension: 'm4a',
      describe: 'M4A recording',
    },
  },
];

export function detectMediaType(content: Buffer): AcceptedType | null {
  for (const { bytes, offset = 0, type } of SIGNATURES) {
    if (content.length < offset + bytes.length) continue;
    if (
      bytes.every(
        (byte, index) => byte === null || content[offset + index] === byte
      )
    )
      return type;
  }
  return null;
}

export const ACCEPTED_DESCRIPTION =
  'a PDF, a JPEG, PNG or WebP photograph, or an MP3, M4A, WAV or Ogg recording';

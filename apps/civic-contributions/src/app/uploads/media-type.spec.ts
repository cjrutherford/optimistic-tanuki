import { detectMediaType } from './media-type';

const bytes = (...values: number[]) => Buffer.from(values);

describe('detectMediaType', () => {
  it.each([
    ['%PDF-1.4', 'application/pdf'],
    ['ID3\u0003', 'audio/mpeg'],
    ['OggS\u0000', 'audio/ogg'],
  ])('recognizes %j by its bytes', (text, mediaType) => {
    expect(detectMediaType(Buffer.from(text, 'latin1'))?.mediaType).toBe(
      mediaType
    );
  });

  it('recognizes images and RIFF audio by their headers', () => {
    expect(detectMediaType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mediaType).toBe(
      'image/jpeg'
    );
    expect(
      detectMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
        ?.mediaType
    ).toBe('image/png');
    const riff = (kind: string) =>
      Buffer.concat([
        Buffer.from('RIFF'),
        bytes(0, 0, 0, 0),
        Buffer.from(kind),
      ]);
    expect(detectMediaType(riff('WEBP'))?.mediaType).toBe('image/webp');
    expect(detectMediaType(riff('WAVE'))?.mediaType).toBe('audio/wav');
    expect(detectMediaType(riff('AVI '))).toBeNull();
  });

  it('recognizes M4A by its ftyp brand at offset 4', () => {
    const m4a = Buffer.concat([bytes(0, 0, 0, 0x20), Buffer.from('ftypM4A ')]);
    expect(detectMediaType(m4a)?.mediaType).toBe('audio/mp4');
  });

  it('accepts nothing a browser would run, whatever the name says', () => {
    expect(detectMediaType(Buffer.from('<svg onload="alert(1)"/>'))).toBeNull();
    expect(detectMediaType(Buffer.from('<html><script>x</script>'))).toBeNull();
    expect(detectMediaType(Buffer.from('PK\u0003\u0004'))).toBeNull();
  });

  it('does not read past a short buffer', () => {
    expect(detectMediaType(Buffer.alloc(0))).toBeNull();
    expect(detectMediaType(bytes(0x89, 0x50))).toBeNull();
  });
});

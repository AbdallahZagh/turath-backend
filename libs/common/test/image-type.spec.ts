import { detectImageType, imageExtension } from '@turath/common';

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe('image/jpeg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('image/png');
    expect(detectImageType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP'), 0))).toBe('image/webp');
  });

  it('refuses everything else, however it is named', () => {
    expect(detectImageType(bytes(...ascii('GIF89a')))).toBeUndefined();
    expect(detectImageType(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')))).toBeUndefined();
    expect(detectImageType(bytes(...ascii('%PDF-1.7')))).toBeUndefined();
    // RIFF that is not WebP (e.g. a WAV file)
    expect(detectImageType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')))).toBeUndefined();
  });

  it('copes with empty and tiny files', () => {
    expect(detectImageType(new Uint8Array())).toBeUndefined();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeUndefined();
  });
});

describe('imageExtension', () => {
  it('gives each type its extension', () => {
    expect(['image/jpeg', 'image/png', 'image/webp'].map((type) => imageExtension(type as 'image/png'))).toEqual([
      'jpg',
      'png',
      'webp',
    ]);
  });
});

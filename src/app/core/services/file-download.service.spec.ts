import { TestBed } from '@angular/core/testing';
import { FileDownloadService } from './file-download.service';

describe('FileDownloadService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves the Blob with the given file name and releases the object URL afterwards', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:documento');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

    TestBed.inject(FileDownloadService).saveBlob(blob, 'cédula.pdf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('cédula.pdf');
    expect(anchor.href).toBe('blob:documento');
    expect(document.body.contains(anchor)).toBe(false);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:documento');
    vi.useRealTimers();
  });
});

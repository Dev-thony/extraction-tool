'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
// @ts-ignore
import './page.css';

type ExtractedRecord = {
  id: string;
  fullName: string | null;
  userName: string | null;
  phoneNumber: string | null;
  email: string | null;
  pukNumber: string | null;
  confidence: number | null;
  status: string;
};

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  kind: 'file' | 'folder';
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAX_LOCAL_FILES = 200;

const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export default function ExtractorPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<GooglePicker | null>(null);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);

  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveBatchId, setDriveBatchId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [records, setRecords] = useState<ExtractedRecord[]>([]);

  const [pickerReady, setPickerReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);

  /*
   * Load Google's Picker API and Google Identity Services.
   */
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const loadGoogleApis = () => {
      /*
       * Google Picker loader.
       */
      if (!document.getElementById('google-picker-script')) {
        const pickerScript = document.createElement('script');

        pickerScript.id = 'google-picker-script';
        pickerScript.src = 'https://apis.google.com/js/api.js';
        pickerScript.async = true;
        pickerScript.defer = true;

        pickerScript.onload = () => {
          window.gapi?.load('picker', () => {
            setPickerReady(true);
          });
        };

        document.head.appendChild(pickerScript);
      } else if (window.gapi) {
        window.gapi.load('picker', () => {
          setPickerReady(true);
        });
      }

      /*
       * Google Identity Services.
       */
      if (!document.getElementById('google-gis-script')) {
        const gisScript = document.createElement('script');

        gisScript.id = 'google-gis-script';
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;

        gisScript.onload = () => {
          setGisReady(true);
        };

        document.head.appendChild(gisScript);
      } else if (window.google?.accounts?.oauth2) {
        setGisReady(true);
      }
    };

    loadGoogleApis();
  }, []);

  /*
   * Revoke preview URLs when component unmounts.
   */
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      pickerRef.current?.dispose();
    };
  }, [previewUrls]);

  /*
   * Add local files.
   */
  const handleFiles = useCallback(
    (selectedFiles: FileList | File[]) => {
      setError(null);
      setRecords([]);

      const incoming = Array.from(selectedFiles);

      if (incoming.length === 0) {
        return;
      }

      const invalidType = incoming.find((file) => !ALLOWED_TYPES.includes(file.type));

      if (invalidType) {
        setError(`"${invalidType.name}" is not a JPG, PNG, or WEBP image.`);
        return;
      }

      const oversized = incoming.find((file) => file.size > MAX_FILE_SIZE);

      if (oversized) {
        setError(`"${oversized.name}" is larger than the 10 MB limit.`);
        return;
      }

      if (files.length + incoming.length > MAX_LOCAL_FILES) {
        setError(`You can upload a maximum of ${MAX_LOCAL_FILES} images at once.`);
        return;
      }

      const nextFiles = [...files, ...incoming];

      const nextPreviews = nextFiles.map((file) => URL.createObjectURL(file));

      previewUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      setFiles(nextFiles);
      setPreviewUrls(nextPreviews);
    },
    [files, previewUrls],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    setDragging(false);

    handleFiles(event.dataTransfer.files);
  };

  const removeLocalFile = (index: number) => {
    const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);

    const nextPreviewUrls = previewUrls.filter((_, fileIndex) => fileIndex !== index);

    const removedUrl = previewUrls[index];

    if (removedUrl) {
      URL.revokeObjectURL(removedUrl);
    }

    setFiles(nextFiles);
    setPreviewUrls(nextPreviewUrls);
    setRecords([]);
    setError(null);

    if (nextFiles.length === 0 && inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const clearLocalFiles = () => {
    previewUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    setFiles([]);
    setPreviewUrls([]);
    setRecords([]);
    setError(null);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  /*
   * Create the Google Picker.
   */
  const createGooglePicker = () => {
    if (!window.google?.picker) {
      setDriveError('Google Picker is still loading. Please try again in a moment.');
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const projectNumber = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER;

    if (!apiKey || !clientId || !projectNumber) {
      setDriveError('Google Drive is not configured. Check your Google environment variables.');
      return;
    }

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);

    /*
     * Show image files and folders.
     *
     * Folders are selectable so the user can select an entire
     * Google Drive folder containing hundreds or thousands of images.
     */
    view.setMimeTypes('image/jpeg,image/png,image/webp');

    view.setIncludeFolders(true);
    view.setSelectFolderEnabled(true);

    const picker = new window.google.picker.PickerBuilder()
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setDeveloperKey(apiKey)
      .setAppId(projectNumber)
      .setOAuthToken(accessTokenRef.current!)
      .setTitle('Select images from Google Drive')
      .addView(view)
      .setCallback(handleGooglePickerResult)
      .build();

    pickerRef.current = picker;

    picker.setVisible(true);
  };

  /*
   * Open Google Picker.
   */
  const openGoogleDrive = () => {
    setDriveError(null);
    setDriveItems([]);

    if (!pickerReady || !gisReady) {
      setDriveError('Google Drive is still loading. Please wait a moment and try again.');
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setDriveError('Google OAuth Client ID is missing.');
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setDriveError('Google authentication could not be loaded.');
      return;
    }

    if (!tokenClientRef.current) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_SCOPE,

        callback: (response) => {
          if (response.error) {
            setDriveError(response.error_description || 'Google Drive authorization failed.');

            setDriveLoading(false);

            return;
          }

          accessTokenRef.current = response.access_token;

          setDriveLoading(false);

          createGooglePicker();
        },
      });
    }

    setDriveLoading(true);

    /*
     * If we already have a token, request another token silently.
     *
     * If Google requires consent, it will show the Google
     * authorization dialog.
     */
    tokenClientRef.current.requestAccessToken({
      prompt: accessTokenRef.current ? '' : 'consent',
    });
  };

  /*
   * Handle files/folders selected in Google Picker.
   */
  const handleGooglePickerResult = async (data: GooglePickerResponse) => {
    if (!window.google?.picker || data.action !== window.google.picker.Action.PICKED) {
      return;
    }

    const documents = data[window.google.picker.Response.DOCUMENTS] as
      GooglePickerDocument[] | undefined;

    if (!documents || documents.length === 0) {
      return;
    }

    const selectedItems: DriveItem[] = [];

    for (const document of documents) {
      const id = document[window.google!.picker.Document.ID];
      const name = document[window.google!.picker.Document.NAME];
      const mimeType = document[window.google!.picker.Document.MIME_TYPE];

      if (typeof id !== 'string' || typeof name !== 'string' || typeof mimeType !== 'string') {
        continue;
      }

      selectedItems.push({
        id,
        name,
        mimeType,
        size:
          typeof document[window.google!.picker.Document.SIZE_BYTES] === 'number'
            ? (document[window.google!.picker.Document.SIZE_BYTES] as number)
            : undefined,
        kind: mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      });
    }

    setDriveItems(selectedItems);

    /*
     * Ask our server to inspect the selected files/folders.
     *
     * We do NOT download the images here.
     */
    try {
      setDriveLoading(true);

      const response = await fetch('/api/drive/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: accessTokenRef.current,
          items: selectedItems,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Google Drive import could not be prepared.');
      }

      setDriveItems(result.items);

      if (result.batch?.id) {
        setDriveBatchId(result.batch.id);
      }
    } catch (caughtError) {
      setDriveError(
        caughtError instanceof Error ? caughtError.message : 'Google Drive import failed.',
      );
    } finally {
      setDriveLoading(false);
    }
  };


  const extractGoogleDriveBatch = async () => {
    const accessToken = accessTokenRef.current;

    if (!accessToken) {
      setDriveError('Your Google Drive session has expired. Please connect to Google Drive again.');
      return;
    }

    if (!driveBatchId) {
      setDriveError('The Google Drive batch has not been created yet.');
      return;
    }

    setDriveLoading(true);
    setDriveError(null);
    setRecords([]);

    const extracted: ExtractedRecord[] = [];

    try {
      while (true) {
        const response = await fetch(`/api/batches/${driveBatchId}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken,
          }),
        });

        const result = await response.json();

        if (!response.ok && response.status >= 500) {
          throw new Error(result.error || 'Google Drive batch processing failed.');
        }

        if (Array.isArray(result.records)) {
          extracted.push(...result.records);

          setRecords([...extracted]);
        }

        if (result.done === true) {
          break;
        }

        /*
         * A permanently failed image must not stop the rest
         * of the batch.
         */
        if (result.success === false && result.retrying === false) {
          continue;
        }
      }

      setRecords(extracted);

      if (extracted.length === 0) {
        setDriveError('The Google Drive batch completed, but no records were extracted.');
      }
    } catch (caughtError) {
      setDriveError(
        caughtError instanceof Error ? caughtError.message : 'Google Drive extraction failed.',
      );
    } finally {
      setDriveLoading(false);
    }
  };

  /*
   * Extract local images.
   *
   * This still uses the existing /api/extract endpoint.
   * Batch processing will replace this with the Step 3 queue.
   */
  
  const extractLocalData = async () => {
    if (files.length === 0) {
      setError('Please select at least one image first.');
      return;
    }

    setLoading(true);
    setError(null);
    setRecords([]);

    try {
      /*
      * 1. Upload all selected images and create one batch.
      */
      const formData = new FormData();

      for (const file of files) {
        formData.append('files', file);
      }

      const createResponse = await fetch('/api/batches', {
        method: 'POST',
        body: formData,
      });

      const createResult = await createResponse.json();

      if (!createResponse.ok || !createResult.success) {
        throw new Error(
          createResult.error || 'Could not create the extraction batch.',
        );
      }

      const batchId = createResult.batch.id;

      /*
      * 2. Process queued items one at a time.
      *
      * The server atomically claims each queued item, so this is safe
      * even when multiple workers/process requests are running.
      */
      const extracted: ExtractedRecord[] = [];

      while (true) {
        const processResponse = await fetch(
          `/api/batches/${batchId}/process`,
          {
            method: 'POST',
          },
        );

        const processResult = await processResponse.json();

        /*
        * A worker-level HTTP error.
        */
        if (!processResponse.ok && processResponse.status >= 500) {
          throw new Error(
            processResult.error || 'Batch processing failed.',
          );
        }

        /*
        * An individual item may fail and be retried by the server.
        *
        * Do not immediately abort the entire batch for a retryable item.
        */
        if (Array.isArray(processResult.records)) {
          extracted.push(...processResult.records);
        }

        /*
        * The worker reports done=true when there are no remaining
        * queued/processing items.
        */
        if (processResult.done === true) {
          break;
        }

        /*
        * A permanently failed item returns success=false but the batch
        * itself can continue processing the remaining items.
        */
        if (
          processResult.success === false &&
          processResult.retrying === false
        ) {
          /*
          * Continue asking the worker to process the next queued item.
          * The failed item is now permanently FAILED.
          */
          continue;
        }
      }

      /*
      * 3. Display every Record created by the batch.
      */
      setRecords(extracted);

      /*
      * 4. Clear the selected local files after successful batch creation
      * and processing.
      */
      if (extracted.length > 0) {
        previewUrls.forEach((url) => {
          URL.revokeObjectURL(url);
        });

        setFiles([]);
        setPreviewUrls([]);

        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Batch extraction failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="extractor-page">
      <div className="extractor-container">
        <header className="extractor-header">
          <p className="eyebrow">DATA EXTRACTION</p>

          <h1>Handwritten Data Extractor</h1>

          <p className="subtitle">
            Upload handwritten images or import hundreds of images directly from Google Drive.
          </p>
        </header>

        <section className="upload-card">
          <div className="source-actions">
            <button
              type="button"
              className="source-button"
              onClick={() => inputRef.current?.click()}
              disabled={loading || driveLoading}
            >
              Upload Images
            </button>

            <button
              type="button"
              className="source-button google-drive-button"
              onClick={openGoogleDrive}
              disabled={loading || driveLoading}
            >
              {driveLoading ? 'Connecting...' : 'Choose from Google Drive'}
            </button>
          </div>

          {!files.length ? (
            <div
              className={`drop-zone ${dragging ? 'drop-zone-active' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div className="upload-icon">↑</div>

              <h2>Upload handwritten images</h2>

              <p>Drag and drop multiple images here, or click to browse.</p>

              <span>JPG, PNG or WEBP · Maximum 10 MB per image · Up to 200 images</span>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => {
                  if (event.target.files) {
                    handleFiles(event.target.files);
                  }
                }}
              />
            </div>
          ) : (
            <div className="selected-files">
              <div className="selected-header">
                <div>
                  <h2>
                    {files.length} image
                    {files.length === 1 ? '' : 's'} selected
                  </h2>

                  <p>Ready for extraction.</p>
                </div>

                <button
                  type="button"
                  className="remove-button"
                  onClick={clearLocalFiles}
                  disabled={loading}
                >
                  Clear
                </button>
              </div>

              <div className="preview-grid">
                {files.map((file, index) => (
                  <div className="preview-item" key={`${file.name}-${index}`}>
                    {previewUrls[index] && <img src={previewUrls[index]} alt={file.name} />}

                    <div className="preview-name">{file.name}</div>

                    <button type="button" onClick={() => removeLocalFile(index)} disabled={loading}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="extract-button"
                  onClick={extractLocalData}
                  disabled={loading}
                >
                  {loading
                    ? 'Processing batch...'
                    : `Extract ${files.length} image${files.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {driveError && <div className="error-message">{driveError}</div>}

          {driveItems.length > 0 && (
            <div className="drive-selection">
              <div className="selected-header">
                <div>
                  <p className="eyebrow">GOOGLE DRIVE</p>

                  <h2>Drive selection ready</h2>

                  <p>
                    {driveItems.length} item
                    {driveItems.length === 1 ? '' : 's'} selected.
                  </p>
                </div>
              </div>

              <div className="drive-items">
                {driveItems.slice(0, 20).map((item) => (
                  <div className="drive-item" key={item.id}>
                    <span>{item.kind === 'folder' ? '📁' : '🖼️'}</span>

                    <div>
                      <strong>{item.name}</strong>

                      <small>{item.kind === 'folder' ? 'Folder' : 'Image'}</small>
                    </div>
                  </div>
                ))}
              </div>

              {driveItems.length > 20 && (
                <p className="drive-more">+ {driveItems.length - 20} more selected items</p>
              )}

              <div className="drive-ready">
                <strong>Google Drive selection ready.</strong>

                <span>
                  {driveItems.length} image
                  {driveItems.length === 1 ? '' : 's'} are queued for extraction.
                </span>

                <button
                  type="button"
                  className="extract-button"
                  onClick={extractGoogleDriveBatch}
                  disabled={driveLoading || !driveBatchId}
                >
                  {driveLoading
                    ? 'Extracting from Google Drive...'
                    : `Extract ${driveItems.length} image${driveItems.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          )}
        </section>

        {records.length > 0 && (
          <section className="results-card">
            <div className="results-header">
              <div>
                <p className="eyebrow">EXTRACTION RESULT</p>

                <h2>{records.length} people extracted</h2>
              </div>
            </div>

            <div className="results-grid">
              {records.map((record) => (
                <div className="result-person" key={record.id}>
                  <div className="person-header">
                    <strong>{record.fullName || 'Unnamed person'}</strong>

                    <span className={`status status-${record.status.toLowerCase()}`}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="result-field">
                    <span>Partnership Name</span>

                    <strong>{record.userName || '—'}</strong>
                  </div>

                  <div className="result-field">
                    <span>Email</span>

                    <strong>{record.email || '—'}</strong>
                  </div>

                  <div className="result-field">
                    <span>Phone Number</span>

                    <strong>{record.phoneNumber || '—'}</strong>
                  </div>

                  <div className="result-field">
                    <span>PUK Number</span>

                    <strong>{record.pukNumber || '—'}</strong>
                  </div>

                  <div className="result-field">
                    <span>Confidence</span>

                    <strong>
                      {record.confidence !== null ? `${Math.round(record.confidence * 100)}%` : '—'}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

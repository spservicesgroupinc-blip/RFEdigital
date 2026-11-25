/**
 * FolioPress — Self-Bootstrapping Google Apps Script Backend (code.gs)
 *
 * HOW TO DEPLOY (COPY & PASTE):
 * 1. Go to https://script.google.com and create a new standalone project named "FolioPress Bridge".
 * 2. Paste this entire file into Code.gs and save.
 * 3. Run `setupWorkspace` once from the Apps Script toolbar (accept Google Drive & Sheets permissions).
 *    - Automatically creates your "FolioPress Workspace" folder in Google Drive.
 *    - Automatically creates your "FolioPress — Digital Product Library" Google Sheet inside that folder
 *      with formatted Products, Series, Assets, Jobs, Cost_Log, and Config tabs.
 *    - Automatically installs a 5-minute time-driven trigger on `runNextJobTick`.
 * 4. Click Deploy > New deployment > Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL (https://script.google.com/macros/s/.../exec) and add it as
 *    `APPS_SCRIPT_WEBAPP_URL` in your FolioPress app's Settings > Secrets panel.
 *
 * OPTIONAL (for unattended background job execution from Apps Script back to FolioPress):
 * In Apps Script > Project Settings > Script Properties, add:
 *   - FOLIOPRESS_APP_URL     : Your FolioPress app URL (e.g. https://your-app.run.app)
 *   - FOLIOPRESS_API_TOKEN   : A scoped token generated in FolioPress > Identity > Workspace API Tokens
 *   - APPS_SCRIPT_SHARED_SECRET (optional) : Must match APPS_SCRIPT_SHARED_SECRET in app Secrets if set
 */

const PROP_KEYS = {
  SPREADSHEET_ID: 'FOLIOPRESS_SPREADSHEET_ID',
  DRIVE_ROOT_ID: 'FOLIOPRESS_DRIVE_ROOT_ID',
  INITIALIZED_AT: 'FOLIOPRESS_INITIALIZED_AT',
  APP_URL: 'FOLIOPRESS_APP_URL',
  API_TOKEN: 'FOLIOPRESS_API_TOKEN',
  SHARED_SECRET: 'APPS_SCRIPT_SHARED_SECRET',
};

const SHEET_SCHEMAS = {
  Products: [
    'id',
    'seriesId',
    'title',
    'subtitle',
    'category',
    'status',
    'trimSize',
    'pageCount',
    'includeBleed',
    'isbn',
    'driveFolderId',
    'updatedAt',
    'createdAt',
  ],
  Series: ['id', 'name', 'description', 'targetAge', 'marketplace', 'createdAt'],
  Assets: [
    'id',
    'productId',
    'folderId',
    'name',
    'kind',
    'mimeType',
    'sizeBytes',
    'pageOrder',
    'caption',
    'storyText',
    'textPlacement',
    'driveFileId',
    'driveWebLink',
    'createdAt',
  ],
  Image_Gallery: [
    'id',
    'name',
    'label',
    'tags',
    'mimeType',
    'sizeBytes',
    'driveFileId',
    'driveWebLink',
    'downloadUrl',
    'createdAt',
  ],
  Jobs: [
    'id',
    'planId',
    'productId',
    'title',
    'stepType',
    'prompt',
    'provider',
    'status',
    'attempts',
    'maxAttempts',
    'resultAssetId',
    'resultSummary',
    'errorMessage',
    'createdAt',
    'updatedAt',
  ],
  Cost_Log: ['id', 'productId', 'model', 'callType', 'usdCost', 'createdAt'],
  Config: ['key', 'value', 'updatedAt'],
};

/**
 * FIRST-RUN SETUP:
 * Safe to run repeatedly (idempotent). Creates Drive folders, Library Spreadsheet,
 * all formatted database tabs, and installs the 5-minute background Jobs trigger.
 */
function setupWorkspace() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const now = new Date().toISOString();

    // 1. Ensure Google Drive root folder ("FolioPress Workspace")
    let rootFolder = getFolderByIdSafe_(props.getProperty(PROP_KEYS.DRIVE_ROOT_ID));
    if (!rootFolder) {
      const existing = DriveApp.getFoldersByName('FolioPress Workspace');
      rootFolder = existing.hasNext()
        ? existing.next()
        : DriveApp.createFolder('FolioPress Workspace');
      props.setProperty(PROP_KEYS.DRIVE_ROOT_ID, rootFolder.getId());
    }

    // Ensure standard workspace subfolders inside root
    ensureChildFolder_(rootFolder, 'Products');
    ensureChildFolder_(rootFolder, 'Exports');
    ensureChildFolder_(rootFolder, 'References');

    // 2. Ensure Library Google Spreadsheet
    let ss = getSpreadsheetByIdSafe_(props.getProperty(PROP_KEYS.SPREADSHEET_ID));
    if (!ss) {
      ss = SpreadsheetApp.create('FolioPress — Digital Product Library');
      const ssFile = DriveApp.getFileById(ss.getId());
      ssFile.moveTo(rootFolder);
      props.setProperty(PROP_KEYS.SPREADSHEET_ID, ss.getId());
    }

    // 3. Create & format all schema tabs
    const schemaNames = Object.keys(SHEET_SCHEMAS);
    for (let i = 0; i < schemaNames.length; i++) {
      const tabName = schemaNames[i];
      const headers = SHEET_SCHEMAS[tabName];
      ensureSheetWithHeaders_(ss, tabName, headers);
    }

    // Remove default blank "Sheet1" if our schema tabs are in place
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }

    // 4. Write setup summary into Config tab
    const configSheet = ss.getSheetByName('Config');
    if (configSheet) {
      const configRows = [
        SHEET_SCHEMAS.Config,
        ['spreadsheetId', ss.getId(), now],
        ['spreadsheetUrl', ss.getUrl(), now],
        ['driveRootId', rootFolder.getId(), now],
        ['driveRootUrl', rootFolder.getUrl(), now],
        ['initializedAt', props.getProperty(PROP_KEYS.INITIALIZED_AT) || now, now],
      ];
      configSheet.clearContents();
      configSheet.getRange(1, 1, configRows.length, 3).setValues(configRows);
    }

    // 5. Install idempotent 5-minute time-driven trigger for background jobs
    const triggerInstalled = ensureJobTrigger_();

    if (!props.getProperty(PROP_KEYS.INITIALIZED_AT)) {
      props.setProperty(PROP_KEYS.INITIALIZED_AT, now);
    }

    const summary = {
      ok: true,
      initializedAt: props.getProperty(PROP_KEYS.INITIALIZED_AT),
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      driveRootId: rootFolder.getId(),
      driveRootUrl: rootFolder.getUrl(),
      triggerInstalled: triggerInstalled,
      tabs: schemaNames,
    };

    Logger.log('FolioPress setup complete: ' + JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Adds a FolioPress menu when the Library Spreadsheet is opened directly.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('FolioPress')
      .addItem('Run First-Time Setup', 'setupWorkspace')
      .addItem('Process Next Queued Job Now', 'runNextJobTick')
      .addToUi();
  } catch (err) {
    // Ignore when executed in a standalone script context without Spreadsheet UI
  }
}

/**
 * Automatically bootstraps workspace resources on first Web App request if not initialized yet.
 */
function ensureInitialized_() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty(PROP_KEYS.SPREADSHEET_ID);
  const rootId = props.getProperty(PROP_KEYS.DRIVE_ROOT_ID);
  if (!ssId || !rootId || !getSpreadsheetByIdSafe_(ssId) || !getFolderByIdSafe_(rootId)) {
    return setupWorkspace();
  }
  return {
    ok: true,
    initializedAt: props.getProperty(PROP_KEYS.INITIALIZED_AT) || '',
    spreadsheetId: ssId,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + ssId + '/edit',
    driveRootId: rootId,
    driveRootUrl: 'https://drive.google.com/drive/folders/' + rootId,
    triggerInstalled: hasJobTrigger_(),
  };
}

/**
 * Optional shared secret check (enforced only if APPS_SCRIPT_SHARED_SECRET is set in Script Properties).
 */
function verifySharedSecret_(providedSecret) {
  const expected = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.SHARED_SECRET);
  if (!expected) return true;
  return Boolean(providedSecret && providedSecret === expected);
}

/**
 * HTTP GET handler: ?action=health | ?action=pull
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (!verifySharedSecret_(params.secret || '')) {
      return jsonResponse_({ ok: false, error: 'Unauthorized: invalid shared secret.' });
    }

    const setup = ensureInitialized_();
    const action = params.action || 'health';

    if (action === 'pull') {
      const ss = SpreadsheetApp.openById(setup.spreadsheetId);
      return jsonResponse_({
        ok: true,
        setup: setup,
        products: readTable_(ss, 'Products'),
        series: readTable_(ss, 'Series'),
        assets: readTable_(ss, 'Assets'),
        galleryImages: readTable_(ss, 'Image_Gallery'),
        jobs: readTable_(ss, 'Jobs'),
      });
    }

    if (action === 'listGalleryImages') {
      const ss = SpreadsheetApp.openById(setup.spreadsheetId);
      return jsonResponse_({
        ok: true,
        galleryImages: readTable_(ss, 'Image_Gallery'),
      });
    }

    const ss = SpreadsheetApp.openById(setup.spreadsheetId);
    return jsonResponse_({
      ok: true,
      action: 'health',
      setup: setup,
      counts: {
        products: Math.max(0, (ss.getSheetByName('Products') ? ss.getSheetByName('Products').getLastRow() : 1) - 1),
        series: Math.max(0, (ss.getSheetByName('Series') ? ss.getSheetByName('Series').getLastRow() : 1) - 1),
        assets: Math.max(0, (ss.getSheetByName('Assets') ? ss.getSheetByName('Assets').getLastRow() : 1) - 1),
        galleryImages: Math.max(0, (ss.getSheetByName('Image_Gallery') ? ss.getSheetByName('Image_Gallery').getLastRow() : 1) - 1),
        jobs: Math.max(0, (ss.getSheetByName('Jobs') ? ss.getSheetByName('Jobs').getLastRow() : 1) - 1),
      },
    });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/**
 * HTTP POST handler: JSON body { action, secret?, ...payload }
 * Actions: "setup" | "sync" | "pull" | "uploadFile" | "enqueueJob" | "configureCallback"
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(rawBody);

    if (!verifySharedSecret_(body.secret || '')) {
      return jsonResponse_({ ok: false, error: 'Unauthorized: invalid shared secret.' });
    }

    const action = body.action || 'setup';

    if (action === 'setup') {
      const setup = setupWorkspace();
      if (body.appUrl && typeof body.appUrl === 'string' && body.appUrl.indexOf('https://') === 0) {
        PropertiesService.getScriptProperties().setProperty(
          PROP_KEYS.APP_URL,
          body.appUrl.replace(/\/+$/, '')
        );
      }
      return jsonResponse_(setup);
    }

    const setup = ensureInitialized_();
    const ss = SpreadsheetApp.openById(setup.spreadsheetId);

    if (action === 'configureCallback') {
      const props = PropertiesService.getScriptProperties();
      if (body.appUrl && typeof body.appUrl === 'string') {
        props.setProperty(PROP_KEYS.APP_URL, body.appUrl.replace(/\/+$/, ''));
      }
      if (body.apiToken && typeof body.apiToken === 'string') {
        props.setProperty(PROP_KEYS.API_TOKEN, body.apiToken.trim());
      }
      return jsonResponse_({ ok: true, setup: setup });
    }

    if (action === 'sync') {
      const syncedAt = new Date().toISOString();
      const summary = {};
      if (Array.isArray(body.products)) {
        summary.products = writeTable_(ss, 'Products', SHEET_SCHEMAS.Products, body.products);
      }
      if (Array.isArray(body.series)) {
        summary.series = writeTable_(ss, 'Series', SHEET_SCHEMAS.Series, body.series);
      }
      if (Array.isArray(body.assets)) {
        summary.assets = writeTable_(ss, 'Assets', SHEET_SCHEMAS.Assets, body.assets);
      }
      if (Array.isArray(body.galleryImages)) {
        const normalizedGallery = body.galleryImages.map(function (img) {
          return {
            id: img.id || '',
            name: img.name || '',
            label: img.label || img.name || '',
            tags: Array.isArray(img.tags) ? img.tags.join(', ') : String(img.tags || ''),
            mimeType: img.mimeType || 'image/png',
            sizeBytes: img.sizeBytes || 0,
            driveFileId: img.driveFileId || '',
            driveWebLink: img.driveWebLink || '',
            downloadUrl: img.driveDownloadUrl || img.downloadUrl || '',
            createdAt: img.createdAt || syncedAt,
          };
        });
        summary.galleryImages = writeTable_(
          ss,
          'Image_Gallery',
          SHEET_SCHEMAS.Image_Gallery,
          normalizedGallery
        );
      }
      if (Array.isArray(body.jobs)) {
        summary.jobs = writeTable_(ss, 'Jobs', SHEET_SCHEMAS.Jobs, body.jobs);
      }
      return jsonResponse_({
        ok: true,
        syncedAt: syncedAt,
        setup: setup,
        rowsWritten: summary,
      });
    }

    if (action === 'pull') {
      return jsonResponse_({
        ok: true,
        setup: setup,
        products: readTable_(ss, 'Products'),
        series: readTable_(ss, 'Series'),
        assets: readTable_(ss, 'Assets'),
        galleryImages: readTable_(ss, 'Image_Gallery'),
        jobs: readTable_(ss, 'Jobs'),
      });
    }

    if (action === 'listGalleryImages') {
      return jsonResponse_({
        ok: true,
        galleryImages: readTable_(ss, 'Image_Gallery'),
      });
    }

    if (action === 'uploadGalleryImage') {
      if (!body.fileName || !body.base64Data) {
        return jsonResponse_({ ok: false, error: 'fileName and base64Data are required.' });
      }
      const rootFolder = DriveApp.getFolderById(setup.driveRootId);
      const refsFolder = ensureChildFolder_(rootFolder, 'References');
      const safeName = sanitizeName_(body.fileName.replace(/\.[^.]+$/, '')) +
        (body.fileName.indexOf('.') >= 0 ? body.fileName.slice(body.fileName.lastIndexOf('.')) : '.png');

      const bytes = Utilities.base64Decode(body.base64Data);
      const blob = Utilities.newBlob(
        bytes,
        body.mimeType || 'image/png',
        safeName
      );
      const file = refsFolder.createFile(blob);
      const downloadUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();
      const now = new Date().toISOString();
      const record = {
        id: String(body.id || 'gal-' + Utilities.getUuid().slice(0, 8)),
        name: safeName,
        label: String(body.label || safeName).slice(0, 120),
        tags: Array.isArray(body.tags) ? body.tags.join(', ') : String(body.tags || ''),
        mimeType: body.mimeType || 'image/png',
        sizeBytes: bytes.length,
        driveFileId: file.getId(),
        driveWebLink: file.getUrl(),
        downloadUrl: downloadUrl,
        createdAt: String(body.createdAt || now),
      };

      const gallerySheet = ensureSheetWithHeaders_(ss, 'Image_Gallery', SHEET_SCHEMAS.Image_Gallery);
      gallerySheet.appendRow(
        SHEET_SCHEMAS.Image_Gallery.map(function (col) {
          return record[col] !== undefined && record[col] !== null ? String(record[col]) : '';
        })
      );

      return jsonResponse_({
        ok: true,
        galleryImage: record,
        driveFolderId: refsFolder.getId(),
        driveFileId: file.getId(),
        driveWebLink: file.getUrl(),
        downloadUrl: downloadUrl,
      });
    }

    if (action === 'getGalleryImage') {
      if (!body.driveFileId) {
        return jsonResponse_({ ok: false, error: 'driveFileId is required.' });
      }
      const file = DriveApp.getFileById(String(body.driveFileId));
      const blob = file.getBlob();
      const base64Data = Utilities.base64Encode(blob.getBytes());
      return jsonResponse_({
        ok: true,
        name: file.getName(),
        mimeType: blob.getContentType() || 'image/png',
        base64Data: base64Data,
      });
    }

    if (action === 'deleteGalleryImage') {
      const targetId = String(body.id || '');
      const driveFileId = String(body.driveFileId || '');
      if (driveFileId) {
        try {
          DriveApp.getFileById(driveFileId).setTrashed(true);
        } catch (trashErr) {
          // File may already be deleted or inaccessible
        }
      }
      const gallerySheet = ss.getSheetByName('Image_Gallery');
      if (gallerySheet && gallerySheet.getLastRow() >= 2 && (targetId || driveFileId)) {
        const vals = gallerySheet.getDataRange().getValues();
        const hdrs = vals[0];
        const idCol = hdrs.indexOf('id');
        const fileCol = hdrs.indexOf('driveFileId');
        for (let r = vals.length - 1; r >= 1; r--) {
          const matchId = targetId && idCol >= 0 && String(vals[r][idCol]) === targetId;
          const matchFile = driveFileId && fileCol >= 0 && String(vals[r][fileCol]) === driveFileId;
          if (matchId || matchFile) {
            gallerySheet.deleteRow(r + 1);
          }
        }
      }
      return jsonResponse_({ ok: true });
    }

    if (action === 'uploadFile') {
      if (!body.fileName || !body.base64Data) {
        return jsonResponse_({ ok: false, error: 'fileName and base64Data are required.' });
      }
      const rootFolder = DriveApp.getFolderById(setup.driveRootId);
      const productsContainer = ensureChildFolder_(rootFolder, 'Products');
      const folderName = sanitizeName_(body.productFolderName || 'General');
      const productFolder = ensureChildFolder_(productsContainer, folderName);

      const bytes = Utilities.base64Decode(body.base64Data);
      const blob = Utilities.newBlob(
        bytes,
        body.mimeType || 'application/octet-stream',
        body.fileName
      );
      const file = productFolder.createFile(blob);

      return jsonResponse_({
        ok: true,
        driveFolderId: productFolder.getId(),
        driveFileId: file.getId(),
        driveWebLink: file.getUrl(),
        downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
      });
    }

    if (action === 'enqueueJob') {
      const sheet = ensureSheetWithHeaders_(ss, 'Jobs', SHEET_SCHEMAS.Jobs);
      const row = SHEET_SCHEMAS.Jobs.map(function (col) {
        return body.job && body.job[col] !== undefined && body.job[col] !== null
          ? String(body.job[col])
          : '';
      });
      sheet.appendRow(row);
      return jsonResponse_({ ok: true, jobId: body.job ? body.job.id : '' });
    }

    return jsonResponse_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * TIME-DRIVEN BACKGROUND WORKER (runs every 5 minutes via Apps Script trigger):
 * Picks the first queued row in the Jobs sheet, calls FolioPress `/api/jobs/run-next`,
 * and records the updated status and output summary back into Google Sheets.
 */
function runNextJobTick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return; // Another trigger tick is already running
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const appUrl = (props.getProperty(PROP_KEYS.APP_URL) || '').replace(/\/+$/, '');
    const apiToken = (props.getProperty(PROP_KEYS.API_TOKEN) || '').trim();
    if (!appUrl || !apiToken) {
      Logger.log(
        'runNextJobTick skipped: configure FOLIOPRESS_APP_URL and FOLIOPRESS_API_TOKEN in Script Properties.'
      );
      return;
    }

    const setup = ensureInitialized_();
    const ss = SpreadsheetApp.openById(setup.spreadsheetId);
    const jobsSheet = ensureSheetWithHeaders_(ss, 'Jobs', SHEET_SCHEMAS.Jobs);
    const data = jobsSheet.getDataRange().getValues();
    if (data.length < 2) return;

    const headers = data[0];
    const idIdx = headers.indexOf('id');
    const statusIdx = headers.indexOf('status');
    const attemptsIdx = headers.indexOf('attempts');
    const summaryIdx = headers.indexOf('resultSummary');
    const errIdx = headers.indexOf('errorMessage');
    const updatedIdx = headers.indexOf('updatedAt');

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][statusIdx]) === 'queued') {
        const jobId = String(data[r][idIdx]);
        const rowNum = r + 1;

        jobsSheet.getRange(rowNum, statusIdx + 1).setValue('running');
        SpreadsheetApp.flush();

        const res = UrlFetchApp.fetch(appUrl + '/api/jobs/run-next', {
          method: 'post',
          contentType: 'application/json',
          headers: {
            Authorization: 'Bearer ' + apiToken,
            'X-Apps-Script': '1',
          },
          payload: JSON.stringify({ jobId: jobId }),
          muteHttpExceptions: true,
        });

        const code = res.getResponseCode();
        const text = res.getContentText() || '{}';
        let parsed = {};
        try {
          parsed = JSON.parse(text);
        } catch (parseErr) {
          parsed = { error: text.slice(0, 200) };
        }

        const now = new Date().toISOString();
        const currentAttempts = Number(data[r][attemptsIdx] || 0) + 1;

        if (code >= 200 && code < 300 && parsed.job) {
          jobsSheet.getRange(rowNum, statusIdx + 1).setValue(parsed.job.status || 'completed');
          jobsSheet.getRange(rowNum, attemptsIdx + 1).setValue(parsed.job.attempts || currentAttempts);
          if (summaryIdx >= 0) {
            jobsSheet.getRange(rowNum, summaryIdx + 1).setValue(parsed.job.resultSummary || '');
          }
          if (errIdx >= 0) {
            jobsSheet.getRange(rowNum, errIdx + 1).setValue(parsed.job.errorMessage || '');
          }
        } else {
          jobsSheet.getRange(rowNum, statusIdx + 1).setValue('failed');
          jobsSheet.getRange(rowNum, attemptsIdx + 1).setValue(currentAttempts);
          if (errIdx >= 0) {
            jobsSheet
              .getRange(rowNum, errIdx + 1)
              .setValue(parsed.error || 'Worker HTTP ' + code);
          }
        }

        if (updatedIdx >= 0) {
          jobsSheet.getRange(rowNum, updatedIdx + 1).setValue(now);
        }
        break; // Execute strictly one queued step per tick
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/* ==================== Internal Helpers ==================== */

function ensureSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#F1F5F9');
    sheet.setFrozenRows(1);
  } else {
    // Safely append any newly added schema columns without disturbing existing rows
    const existingHeaders = sheet
      .getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
      .getValues()[0]
      .map(function (h) {
        return String(h);
      });
    for (let i = 0; i < headers.length; i++) {
      if (existingHeaders.indexOf(headers[i]) === -1) {
        const nextCol = sheet.getLastColumn() + 1;
        const cell = sheet.getRange(1, nextCol);
        cell.setValue(headers[i]);
        cell.setFontWeight('bold');
        cell.setBackground('#F1F5F9');
      }
    }
  }
  return sheet;
}

function writeTable_(ss, tabName, headers, records) {
  const sheet = ensureSheetWithHeaders_(ss, tabName, headers);
  const rows = [headers];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i] || {};
    rows.push(
      headers.map(function (col) {
        const v = rec[col];
        if (v === null || v === undefined) return '';
        if (typeof v === 'boolean') return v ? 'yes' : 'no';
        return String(v);
      })
    );
  }
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#F1F5F9');
  sheet.setFrozenRows(1);
  return records.length;
}

function readTable_(ss, tabName) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[String(headers[c])] = values[r][c];
    }
    out.push(obj);
  }
  return out;
}

function ensureChildFolder_(parentFolder, name) {
  const matches = parentFolder.getFoldersByName(name);
  return matches.hasNext() ? matches.next() : parentFolder.createFolder(name);
}

function getFolderByIdSafe_(id) {
  if (!id) return null;
  try {
    const folder = DriveApp.getFolderById(id);
    return folder.isTrashed() ? null : folder;
  } catch (err) {
    return null;
  }
}

function getSpreadsheetByIdSafe_(id) {
  if (!id) return null;
  try {
    const file = DriveApp.getFileById(id);
    if (file.isTrashed()) return null;
    return SpreadsheetApp.openById(id);
  } catch (err) {
    return null;
  }
}

function hasJobTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runNextJobTick') {
      return true;
    }
  }
  return false;
}

function ensureJobTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runNextJobTick') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('runNextJobTick').timeBased().everyMinutes(5).create();
  return true;
}

function sanitizeName_(input) {
  const clean = String(input || '')
    .replace(/[^a-zA-Z0-9 _-]+/g, '')
    .trim()
    .slice(0, 80);
  return clean || 'Product';
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

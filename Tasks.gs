/**
 * Tasks and subtasks stored in Google Sheets.
 */

var TITLE_MAX_LENGTH = 180;
var NOTES_MAX_LENGTH = 500;

function sanitizeTitle_(value, label) {
  var text = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    throw new Error('Enter a ' + (label || 'title') + '.');
  }
  if (text.length > TITLE_MAX_LENGTH) {
    throw new Error((label || 'Title') + ' must be ' + TITLE_MAX_LENGTH + ' characters or fewer.');
  }
  return text;
}

function sanitizeNotes_(value) {
  var text = String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
  if (text.length > NOTES_MAX_LENGTH) {
    throw new Error('Notes must be ' + NOTES_MAX_LENGTH + ' characters or fewer.');
  }
  return text;
}

function readSheetRows_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  var rows = [];
  if (lastRow < 2) {
    return rows;
  }
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = cellAsText_(row[0], 'yyyy-MM-dd');
    if (!id) {
      continue;
    }
    rows.push({ values: row, rowIndex: i + 2, id: id });
  }
  return rows;
}

function writeRow_(sheet, rowIndex, values) {
  var range;
  if (rowIndex) {
    range = sheet.getRange(rowIndex, 1, 1, values.length);
  } else {
    sheet.appendRow(values);
    range = sheet.getRange(sheet.getLastRow(), 1, 1, values.length);
  }
  range.setNumberFormat('@');
  range.setValues([values]);
}

function deleteSheetRow_(sheet, rowIndex) {
  sheet.deleteRow(rowIndex);
}

function listTasks_() {
  var taskSheet = getTasksSheet_();
  var subSheet = getSubtasksSheet_();
  var taskRows = readSheetRows_(taskSheet, TASKS_HEADERS);
  var subRows = readSheetRows_(subSheet, SUBTASKS_HEADERS);
  var grouped = {};

  subRows.forEach(function (item) {
    var taskId = cellAsText_(item.values[1], 'yyyy-MM-dd');
    if (!grouped[taskId]) {
      grouped[taskId] = [];
    }
    grouped[taskId].push({
      id: item.id,
      taskId: taskId,
      title: cellAsText_(item.values[2], 'yyyy-MM-dd'),
      done: String(item.values[3]).toLowerCase() === 'true',
      sortOrder: Number(item.values[4]) || 0,
      updatedAt: cellAsText_(item.values[5], 'yyyy-MM-dd HH:mm:ss')
    });
  });

  var tasks = taskRows.map(function (item) {
    var subtasks = (grouped[item.id] || []).sort(function (a, b) {
      return a.sortOrder - b.sortOrder;
    });
    var doneCount = subtasks.filter(function (sub) { return sub.done; }).length;
    var percent = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;
    return {
      id: item.id,
      title: cellAsText_(item.values[1], 'yyyy-MM-dd'),
      notes: cellAsText_(item.values[2], 'yyyy-MM-dd'),
      createdAt: cellAsText_(item.values[3], 'yyyy-MM-dd HH:mm:ss'),
      updatedAt: cellAsText_(item.values[4], 'yyyy-MM-dd HH:mm:ss'),
      subtasks: subtasks,
      doneCount: doneCount,
      totalCount: subtasks.length,
      percent: percent
    };
  }).sort(function (a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });

  return { ok: true, tasks: tasks };
}

function saveTask_(task) {
  task = task || {};
  var title = sanitizeTitle_(task.title, 'task title');
  var notes = sanitizeNotes_(task.notes);
  var sheet = getTasksSheet_();
  var now = nowNairobi_();
  var rows = readSheetRows_(sheet, TASKS_HEADERS);
  var existing = null;
  if (task.id) {
    rows.forEach(function (item) {
      if (item.id === task.id) {
        existing = item;
      }
    });
    if (!existing) {
      throw new Error('Task not found.');
    }
  }
  var id = existing ? existing.id : Utilities.getUuid();
  var createdAt = existing ? cellAsText_(existing.values[3], 'yyyy-MM-dd HH:mm:ss') : now;
  writeRow_(sheet, existing ? existing.rowIndex : 0, [id, title, notes, createdAt, now]);
  return listTasks_();
}

function saveSubtask_(subtask) {
  subtask = subtask || {};
  var title = sanitizeTitle_(subtask.title, 'subtask');
  var taskId = String(subtask.taskId || '').trim();
  if (!taskId) {
    throw new Error('Task is required.');
  }
  var taskSheet = getTasksSheet_();
  var taskRows = readSheetRows_(taskSheet, TASKS_HEADERS);
  var taskExists = taskRows.some(function (item) { return item.id === taskId; });
  if (!taskExists) {
    throw new Error('Task not found.');
  }

  var sheet = getSubtasksSheet_();
  var rows = readSheetRows_(sheet, SUBTASKS_HEADERS);
  var existing = null;
  var maxOrder = 0;
  rows.forEach(function (item) {
    if (cellAsText_(item.values[1], 'yyyy-MM-dd') === taskId) {
      var order = Number(item.values[4]) || 0;
      if (order > maxOrder) {
        maxOrder = order;
      }
    }
    if (subtask.id && item.id === subtask.id) {
      existing = item;
    }
  });

  var now = nowNairobi_();
  var id = existing ? existing.id : Utilities.getUuid();
  var done = existing ? String(existing.values[3]).toLowerCase() === 'true' : false;
  var sortOrder = existing ? (Number(existing.values[4]) || 0) : maxOrder + 1;
  writeRow_(sheet, existing ? existing.rowIndex : 0, [id, taskId, title, done ? 'true' : 'false', String(sortOrder), now]);
  return listTasks_();
}

function toggleSubtask_(id) {
  id = String(id || '').trim();
  if (!id) {
    throw new Error('Subtask is required.');
  }
  var sheet = getSubtasksSheet_();
  var rows = readSheetRows_(sheet, SUBTASKS_HEADERS);
  var existing = null;
  rows.forEach(function (item) {
    if (item.id === id) {
      existing = item;
    }
  });
  if (!existing) {
    throw new Error('Subtask not found.');
  }
  var done = String(existing.values[3]).toLowerCase() !== 'true';
  writeRow_(sheet, existing.rowIndex, [
    existing.id,
    cellAsText_(existing.values[1], 'yyyy-MM-dd'),
    cellAsText_(existing.values[2], 'yyyy-MM-dd'),
    done ? 'true' : 'false',
    String(existing.values[4] || '0'),
    nowNairobi_()
  ]);
  return listTasks_();
}

function deleteTask_(id) {
  id = String(id || '').trim();
  if (!id) {
    throw new Error('Task is required.');
  }
  var taskSheet = getTasksSheet_();
  var subSheet = getSubtasksSheet_();
  var taskRows = readSheetRows_(taskSheet, TASKS_HEADERS);
  var found = null;
  taskRows.forEach(function (item) {
    if (item.id === id) {
      found = item;
    }
  });
  if (!found) {
    throw new Error('Task not found.');
  }

  var subRows = readSheetRows_(subSheet, SUBTASKS_HEADERS)
    .filter(function (item) { return cellAsText_(item.values[1], 'yyyy-MM-dd') === id; })
    .sort(function (a, b) { return b.rowIndex - a.rowIndex; });
  subRows.forEach(function (item) {
    deleteSheetRow_(subSheet, item.rowIndex);
  });
  deleteSheetRow_(taskSheet, found.rowIndex);
  return listTasks_();
}

function deleteSubtask_(id) {
  id = String(id || '').trim();
  if (!id) {
    throw new Error('Subtask is required.');
  }
  var sheet = getSubtasksSheet_();
  var rows = readSheetRows_(sheet, SUBTASKS_HEADERS);
  var found = null;
  rows.forEach(function (item) {
    if (item.id === id) {
      found = item;
    }
  });
  if (!found) {
    throw new Error('Subtask not found.');
  }
  deleteSheetRow_(sheet, found.rowIndex);
  return listTasks_();
}

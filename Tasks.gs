/**
 * Tasks and subtasks stored in Google Sheets, scoped to the signed-in user.
 */

var TITLE_MAX_LENGTH = 180;
var NOTES_MAX_LENGTH = 500;
var PRIORITY_LEVELS = ['urgent', 'high', 'medium', 'low'];
var PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

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

function sanitizePriority_(value) {
  var priority = String(value || 'medium').toLowerCase().trim();
  if (PRIORITY_LEVELS.indexOf(priority) === -1) {
    return 'medium';
  }
  return priority;
}

function sanitizeDueDate_(value) {
  var text = String(value || '').trim();
  if (!text) {
    return '';
  }
  parseYmd_(text);
  return text;
}

function isTaskComplete_(task) {
  return task.totalCount > 0 && task.doneCount === task.totalCount;
}

function dueBucket_(dueDate, today) {
  if (!dueDate) {
    return 'none';
  }
  if (dueDate < today) {
    return 'overdue';
  }
  if (dueDate <= addDays_(today, 2)) {
    return 'soon';
  }
  return 'upcoming';
}

function mapSubtask_(item, userId) {
  return {
    id: item.id,
    userId: userId,
    taskId: cellAsText_(item.taskId, 'yyyy-MM-dd'),
    title: cellAsText_(item.title, 'yyyy-MM-dd'),
    done: String(item.done).toLowerCase() === 'true',
    sortOrder: Number(item.sortOrder) || 0,
    updatedAt: cellAsText_(item.updatedAt, 'yyyy-MM-dd HH:mm:ss')
  };
}

function mapTask_(item, subtasks) {
  var doneCount = subtasks.filter(function (sub) { return sub.done; }).length;
  var percent = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;
  var dueDate = cellAsText_(item.dueDate, 'yyyy-MM-dd');
  return {
    id: item.id,
    userId: cellAsText_(item.userId, 'yyyy-MM-dd'),
    title: cellAsText_(item.title, 'yyyy-MM-dd'),
    notes: cellAsText_(item.notes, 'yyyy-MM-dd'),
    priority: sanitizePriority_(item.priority),
    dueDate: dueDate,
    createdAt: cellAsText_(item.createdAt, 'yyyy-MM-dd HH:mm:ss'),
    updatedAt: cellAsText_(item.updatedAt, 'yyyy-MM-dd HH:mm:ss'),
    subtasks: subtasks,
    doneCount: doneCount,
    totalCount: subtasks.length,
    percent: percent,
    complete: subtasks.length > 0 && doneCount === subtasks.length
  };
}

function sortTasks_(tasks) {
  var today = todayNairobi_();
  return tasks.slice().sort(function (a, b) {
    var bucketRank = { overdue: 0, soon: 1, upcoming: 2, none: 3 };
    var aBucket = dueBucket_(a.dueDate, today);
    var bBucket = dueBucket_(b.dueDate, today);
    if (aBucket !== bBucket) {
      return bucketRank[aBucket] - bucketRank[bBucket];
    }
    var aPri = PRIORITY_RANK[a.priority] != null ? PRIORITY_RANK[a.priority] : 2;
    var bPri = PRIORITY_RANK[b.priority] != null ? PRIORITY_RANK[b.priority] : 2;
    if (aPri !== bPri) {
      return aPri - bPri;
    }
    return String(a.dueDate || '9999-99-99').localeCompare(String(b.dueDate || '9999-99-99')) ||
      String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function listTasks_(profile) {
  var userId = profile.userId;
  var taskRows = recordsForUser_(readRecords_(getTasksSheet_(), TASKS_HEADERS), userId);
  var subRows = recordsForUser_(readRecords_(getSubtasksSheet_(), SUBTASKS_HEADERS), userId);
  var grouped = {};

  subRows.forEach(function (item) {
    var mapped = mapSubtask_(item, userId);
    if (!grouped[mapped.taskId]) {
      grouped[mapped.taskId] = [];
    }
    grouped[mapped.taskId].push(mapped);
  });

  var tasks = sortTasks_(taskRows.map(function (item) {
    var subtasks = (grouped[item.id] || []).sort(function (a, b) {
      return a.sortOrder - b.sortOrder;
    });
    return mapTask_(item, subtasks);
  }));

  return { ok: true, tasks: tasks, today: todayNairobi_() };
}

function requireOwnedTask_(userId, taskId) {
  var rows = recordsForUser_(readRecords_(getTasksSheet_(), TASKS_HEADERS), userId);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === taskId) {
      return rows[i];
    }
  }
  throw new Error('Task not found.');
}

function saveTask_(profile, task) {
  task = task || {};
  var title = sanitizeTitle_(task.title, 'task title');
  var notes = sanitizeNotes_(task.notes);
  var priority = sanitizePriority_(task.priority);
  var dueDate = sanitizeDueDate_(task.dueDate);
  var sheet = getTasksSheet_();
  var now = nowNairobi_();
  var existing = null;
  if (task.id) {
    existing = requireOwnedTask_(profile.userId, String(task.id));
  }
  var id = existing ? existing.id : Utilities.getUuid();
  var createdAt = existing ? cellAsText_(existing.createdAt, 'yyyy-MM-dd HH:mm:ss') : now;
  writeRecord_(sheet, TASKS_HEADERS, existing ? existing._rowIndex : 0, {
    id: id,
    userId: profile.userId,
    title: title,
    notes: notes,
    priority: priority,
    dueDate: dueDate,
    createdAt: createdAt,
    updatedAt: now
  });
  return listTasks_(profile);
}

function saveSubtask_(profile, subtask) {
  subtask = subtask || {};
  var title = sanitizeTitle_(subtask.title, 'subtask');
  var taskId = String(subtask.taskId || '').trim();
  if (!taskId) {
    throw new Error('Task is required.');
  }
  requireOwnedTask_(profile.userId, taskId);

  var sheet = getSubtasksSheet_();
  var rows = recordsForUser_(readRecords_(sheet, SUBTASKS_HEADERS), profile.userId);
  var existing = null;
  var maxOrder = 0;
  rows.forEach(function (item) {
    if (cellAsText_(item.taskId, 'yyyy-MM-dd') === taskId) {
      var order = Number(item.sortOrder) || 0;
      if (order > maxOrder) {
        maxOrder = order;
      }
    }
    if (subtask.id && item.id === subtask.id) {
      existing = item;
    }
  });
  if (subtask.id && !existing) {
    throw new Error('Subtask not found.');
  }

  var now = nowNairobi_();
  var id = existing ? existing.id : Utilities.getUuid();
  var done = existing ? String(existing.done).toLowerCase() === 'true' : false;
  var sortOrder = existing ? (Number(existing.sortOrder) || 0) : maxOrder + 1;
  writeRecord_(sheet, SUBTASKS_HEADERS, existing ? existing._rowIndex : 0, {
    id: id,
    userId: profile.userId,
    taskId: taskId,
    title: title,
    done: done ? 'true' : 'false',
    sortOrder: String(sortOrder),
    updatedAt: now
  });
  return listTasks_(profile);
}

function toggleSubtask_(profile, id) {
  id = String(id || '').trim();
  if (!id) {
    throw new Error('Subtask is required.');
  }
  var sheet = getSubtasksSheet_();
  var rows = recordsForUser_(readRecords_(sheet, SUBTASKS_HEADERS), profile.userId);
  var existing = null;
  rows.forEach(function (item) {
    if (item.id === id) {
      existing = item;
    }
  });
  if (!existing) {
    throw new Error('Subtask not found.');
  }
  var done = String(existing.done).toLowerCase() !== 'true';
  writeRecord_(sheet, SUBTASKS_HEADERS, existing._rowIndex, {
    id: existing.id,
    userId: profile.userId,
    taskId: cellAsText_(existing.taskId, 'yyyy-MM-dd'),
    title: cellAsText_(existing.title, 'yyyy-MM-dd'),
    done: done ? 'true' : 'false',
    sortOrder: String(existing.sortOrder || '0'),
    updatedAt: nowNairobi_()
  });
  return listTasks_(profile);
}

function deleteTask_(profile, id) {
  id = String(id || '').trim();
  if (!id) {
    throw new Error('Task is required.');
  }
  var found = requireOwnedTask_(profile.userId, id);
  var subSheet = getSubtasksSheet_();
  var subRows = recordsForUser_(readRecords_(subSheet, SUBTASKS_HEADERS), profile.userId)
    .filter(function (item) { return cellAsText_(item.taskId, 'yyyy-MM-dd') === id; })
    .sort(function (a, b) { return b._rowIndex - a._rowIndex; });
  subRows.forEach(function (item) {
    deleteSheetRow_(subSheet, item._rowIndex);
  });
  deleteSheetRow_(getTasksSheet_(), found._rowIndex);
  return listTasks_(profile);
}

function deleteSubtask_(profile, id) {
  id = String(id || '').trim();
  if (!id) {
    throw new Error('Subtask is required.');
  }
  var sheet = getSubtasksSheet_();
  var rows = recordsForUser_(readRecords_(sheet, SUBTASKS_HEADERS), profile.userId);
  var found = null;
  rows.forEach(function (item) {
    if (item.id === id) {
      found = item;
    }
  });
  if (!found) {
    throw new Error('Subtask not found.');
  }
  deleteSheetRow_(sheet, found._rowIndex);
  return listTasks_(profile);
}

function getTaskAlerts_(profile) {
  var listed = listTasks_(profile);
  var today = listed.today;
  var alerts = listed.tasks.filter(function (task) {
    if (task.complete) {
      return false;
    }
    if (task.priority === 'urgent') {
      return true;
    }
    var bucket = dueBucket_(task.dueDate, today);
    return bucket === 'overdue' || bucket === 'soon';
  });
  return { ok: true, alerts: alerts, today: today };
}

function taskSummaryStats_(profile) {
  var listed = listTasks_(profile);
  var today = listed.today;
  var open = 0;
  var urgent = 0;
  var overdue = 0;
  listed.tasks.forEach(function (task) {
    if (task.complete) {
      return;
    }
    open += 1;
    if (task.priority === 'urgent') {
      urgent += 1;
    }
    if (dueBucket_(task.dueDate, today) === 'overdue') {
      overdue += 1;
    }
  });
  return { open: open, urgent: urgent, overdue: overdue };
}

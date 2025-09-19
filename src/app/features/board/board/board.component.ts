import { Component, OnInit, inject } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ColumnDto, TaskDto, UserDto, CommentDto, HistoryDto } from '../../../core/api.service';
import { ThemeToggleComponent } from '../../../core/components/theme-toggle/theme-toggle.component';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ThemeToggleComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
  animations: [
    trigger('listStagger', [
      transition(':enter', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(6px)' }),
          stagger(50, animate('180ms ease-out', style({ opacity: 1, transform: 'none' }))),
        ], { optional: true })
      ])
    ]),
    trigger('itemAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px) scale(0.98)' }),
        animate('160ms ease-out', style({ opacity: 1, transform: 'none' }))
      ]),
      transition(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translateY(-4px) scale(0.98)' }))
      ])
    ])
  ]
})
export class BoardComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  columns: ColumnDto[] = [];
  assigneeFilter = '';
  isAdmin = false;
  newColumnTitle = '';
  inviteEmail = '';
  inviteCopied = false;
  newTaskTitle: Record<string, string> = {};
  newTaskDescription: Record<string, string> = {};
  newTaskDueDate: Record<string, string> = {};
  newTaskPriority: Record<string, 'low' | 'medium' | 'high'> = {};
  newTaskAssignees: Record<string, Set<string>> = {};
  // Modal state
  showTaskModal = false;
  modalColumnId: string | null = null;
  modalTitle = '';
  modalDescription = '';
  modalDueDate = '';
  modalPriority: 'low' | 'medium' | 'high' = 'medium';
  modalAssignees: Set<string> = new Set<string>();
  // Multi-select helpers
  modalAssigneesArray: string[] = [];
  // Task details modal state
  showTaskDetails = false;
  selectedTask: TaskDto | null = null;
  comments: CommentDto[] = [];
  newComment = '';
  activeDetailsTab: 'details' | 'comments' | 'history' = 'details';
  history: HistoryDto[] = [];
  // Inline editing fields
  editTitle = '';
  editDescription = '';
  editPriority: 'low' | 'medium' | 'high' = 'medium';
  editDueDate = '';
  editLabels = '';
  editAssignees: Set<string> = new Set<string>();
  editAssigneesArray: string[] = [];
  // Per-field edit flags (view mode by default)
  isEditingTitle = false;
  isEditingDescription = false;
  isEditingPriority = false;
  isEditingDueDate = false;
  isEditingAssignees = false;
  isEditingLabels = false;

  // Search filter
  searchText = '';
  addingColumn = false;
  addingTaskFor: string | null = null;
  showAssigneeFor: string | null = null;
  users: UserDto[] = [];
  loadingUsers = false;
  selectedAssignees: Record<string, Set<string>> = {};
  // Toolbar filter highlight
  selectedFilterUserId: string | null = null;
  // Toolbar avatar pagination
  avatarShowCount = 5;
  expandedChip: { taskId: string; userId: string } | null = null;
  // UI-only starred tasks (persisted locally)
  private starred = new Set<string>();
  ngOnInit() {
  this.load();
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    this.isAdmin = !!u?.isAdmin;
  } catch {}
  // Preload users for assignee selection when adding tasks
  this.loadingUsers = true;
  this.api.listUsers().subscribe({
    next: (u) => (this.users = u),
    error: () => {},
    complete: () => (this.loadingUsers = false),
  });
  // Load starred ids from localStorage
  try {
    const raw = localStorage.getItem('starredTasks');
    const arr: string[] = raw ? JSON.parse(raw) : [];
    this.starred = new Set<string>(Array.isArray(arr) ? arr : []);
  } catch {}
}

  load() {
    this.api
      .getBoard(this.assigneeFilter ? { assignee: this.assigneeFilter } : undefined)
      .subscribe((cols) => (this.columns = cols));
  }

  // Toolbar avatar helpers
  visibleUsers(): UserDto[] {
    return (this.users || []).slice(0, this.avatarShowCount);
  }
  moreUsersCount(): number {
    const total = this.users?.length || 0;
    return total > this.avatarShowCount ? (total - this.avatarShowCount) : 0;
  }
  showMoreAvatars() {
    const total = this.users?.length || 0;
    if (this.avatarShowCount < total) {
      this.avatarShowCount = Math.min(total, this.avatarShowCount + 5);
    }
  }

  openTaskDetails(task: TaskDto) {
    this.selectedTask = task;
    this.showTaskDetails = true;
    this.newComment = '';
    this.comments = [];
    this.activeDetailsTab = 'details';
    this.loadComments(task.id);
    this.history = [];

    // Seed inline-editing fields
    this.editTitle = task.title;
    this.editDescription = task.description || '';
    this.editPriority = (task.priority || 'medium') as any;
    this.editDueDate = task.dueDate || '';
    this.editLabels = task.labels || '';
    this.editAssignees = new Set<string>((task.assignees || []).map(a => a.id));
    this.editAssigneesArray = Array.from(this.editAssignees);
    this.isEditingTitle = false;
    this.isEditingDescription = false;
    this.isEditingPriority = false;
    this.isEditingDueDate = false;
    this.isEditingAssignees = false;
    this.isEditingLabels = false;
  }

  closeTaskDetails() {
    this.showTaskDetails = false;
    this.selectedTask = null;
    this.newComment = '';
    this.comments = [];
  }

  loadComments(taskId: string) {
    this.api.listComments(taskId).subscribe({ next: (c) => (this.comments = c) });
  }

  postComment() {
    if (!this.selectedTask) return;
    const content = this.newComment.trim();
    if (!content) return;
    this.api.addComment(this.selectedTask.id, content).subscribe((c) => {
      this.comments.push(c);
      this.newComment = '';
    });
  }

  getAssigneesLabel(task: TaskDto | null | undefined): string {
    if (!task || !task.assignees || task.assignees.length === 0) return 'Unassigned';
    return task.assignees
      .map((a) => (a.name && a.name.trim().length ? a.name : a.email))
      .join(', ');
  }

  setDetailsTab(tab: 'details' | 'comments' | 'history') {
    this.activeDetailsTab = tab;
    if (tab === 'comments' && this.selectedTask && this.comments.length === 0) {
      this.loadComments(this.selectedTask.id);
    }
    if (tab === 'history' && this.selectedTask && this.history.length === 0) {
      this.loadHistory(this.selectedTask.id);
    }
  }

  hasNewTaskAssignee(columnId: string, userId: string): boolean {
    const set = this.newTaskAssignees[columnId];
    return !!set && set.has(userId);
  }

  onCommentKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.postComment();
    }
  }

  loadHistory(taskId: string) {
    this.api.listHistory(taskId).subscribe({ next: (h) => (this.history = h) });
  }

  // Inline save methods
  saveTitle() {
    if (!this.selectedTask) return;
    const title = this.editTitle.trim() || 'Untitled';
    this.api.updateTask(this.selectedTask.id, { title }).subscribe(t => {
      this.selectedTask!.title = t.title;
      this.syncTaskInBoard(t);
      this.isEditingTitle = false;
    });
  }

  saveDescription() {
    if (!this.selectedTask) return;
    const description = this.editDescription.trim();
    this.api.updateTask(this.selectedTask.id, { description }).subscribe(t => {
      this.selectedTask!.description = t.description;
      this.syncTaskInBoard(t);
      this.isEditingDescription = false;
    });
  }

  startEditTitle() { this.isEditingTitle = true; setTimeout(()=>document.getElementById('edit-title-input')?.focus(), 0); }
  cancelEditTitle() { this.isEditingTitle = false; this.editTitle = this.selectedTask?.title || ''; }
  onTitleKey(e: KeyboardEvent) { if (e.key === 'Enter') this.saveTitle(); if (e.key === 'Escape') this.cancelEditTitle(); }

  startEditDescription() { this.isEditingDescription = true; setTimeout(()=>document.getElementById('edit-desc-input')?.focus(), 0); }
  cancelEditDescription() { this.isEditingDescription = false; this.editDescription = this.selectedTask?.description || ''; }

  savePriority() {
    if (!this.selectedTask) return;
    const priority = this.editPriority;
    this.api.updateTask(this.selectedTask.id, { priority }).subscribe(t => {
      this.selectedTask!.priority = t.priority;
      this.syncTaskInBoard(t);
      this.isEditingPriority = false;
    });
  }

  saveDueDate() {
    if (!this.selectedTask) return;
    const dueDate = this.editDueDate || null;
    this.api.updateTask(this.selectedTask.id, { dueDate }).subscribe(t => {
      this.selectedTask!.dueDate = t.dueDate || null;
      this.syncTaskInBoard(t);
      this.isEditingDueDate = false;
    });
  }

  saveLabels() {
    if (!this.selectedTask) return;
    const labels = this.editLabels.trim() || '';
    this.api.updateTask(this.selectedTask.id, { labels }).subscribe(t => {
      this.selectedTask!.labels = t.labels || '';
      this.syncTaskInBoard(t);
      this.isEditingLabels = false;
    });
  }

  toggleEditAssignee(userId: string, ev: Event) {
    const input = ev.target as HTMLInputElement | null;
    if (!input || !this.selectedTask) return;
    if (input.checked) this.editAssignees.add(userId); else this.editAssignees.delete(userId);
  }

  saveAssignees() {
    if (!this.selectedTask) return;
    const assigneeIds = Array.from(this.editAssigneesArray || []);
    this.api.updateTask(this.selectedTask.id, { assigneeIds }).subscribe(t => {
      this.selectedTask!.assignees = t.assignees;
      this.syncTaskInBoard(t);
      this.isEditingAssignees = false;
    });
  }

  startEditPriority() { this.isEditingPriority = true; }
  cancelEditPriority() { this.isEditingPriority = false; this.editPriority = (this.selectedTask?.priority || 'medium') as any; }

  startEditDueDate() { this.isEditingDueDate = true; }
  cancelEditDueDate() { this.isEditingDueDate = false; this.editDueDate = this.selectedTask?.dueDate || ''; }

  startEditAssignees() {
    this.isEditingAssignees = true;
    this.editAssigneesArray = Array.from((this.selectedTask?.assignees || []).map(a=>a.id));
  }
  cancelEditAssignees() {
    this.isEditingAssignees = false;
    this.editAssigneesArray = Array.from((this.selectedTask?.assignees || []).map(a=>a.id));
  }

  startEditLabels() { this.isEditingLabels = true; }
  cancelEditLabels() { this.isEditingLabels = false; this.editLabels = this.selectedTask?.labels || ''; }

  private syncTaskInBoard(updated: TaskDto) {
    // Update task in columns array for immediate UI reflect
    for (const col of this.columns) {
      const idx = col.tasks.findIndex(x => x.id === updated.id);
      if (idx >= 0) {
        col.tasks[idx] = { ...col.tasks[idx], ...updated } as any;
        break;
      }
    }
  }

  matchesFilter(t: TaskDto): boolean {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return true;
    const labels = (t.labels || '').toLowerCase();
    const title = (t.title || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return title.includes(q) || desc.includes(q) || labels.includes(q);
  }

  splitLabels(labels?: string | null): string[] {
    if (!labels) return [];
    return labels
      .split(',')
      .map((s) => s.trim())
      .filter((s) => !!s);
  }

  // History helpers
  getUserNameById(id: string | null | undefined): string {
    if (!id) return '';
    const u = this.users.find((x) => x.id === id);
    return (u?.name && u.name.trim().length ? u.name : u?.email) || id;
  }

  getColumnTitleById(id: string | null | undefined): string {
    if (!id) return '';
    const c = this.columns.find((x) => x.id === id);
    return c?.title || id;
  }

  // Modal actions
  submitTaskFromModal() {
    if (!this.isAdmin || !this.modalColumnId) return;
    const columnId = this.modalColumnId;
    const title = (this.modalTitle || '').trim() || 'New Task';
    const description = (this.modalDescription || '').trim();
    const dueDate = this.modalDueDate || null;
    const priority = this.modalPriority || 'medium';
    const assigneeIds = Array.from(this.modalAssigneesArray || []);
    const column = this.columns.find((c) => c.id === columnId)!;
    const orderIndex = column.tasks.length;
    this.api
      .createTask({ title, description, orderIndex, columnId, priority, dueDate, assigneeIds })
      .subscribe((task) => {
        column.tasks.push(task);
        this.showTaskModal = false;
        this.modalColumnId = null;
      });
  }

  onModalAssigneeToggle(userId: string, ev: Event) {
    const input = ev.target as HTMLInputElement | null;
    if (!input) return;
    if (input.checked) this.modalAssignees.add(userId);
    else this.modalAssignees.delete(userId);
  }

  // New checkbox handlers for array-based selection
  onToggleModalAssignee(userId: string, ev: Event) {
    const input = ev.target as HTMLInputElement | null;
    if (!input) return;
    const idx = this.modalAssigneesArray.indexOf(userId);
    if (input.checked && idx === -1) {
      this.modalAssigneesArray = [...this.modalAssigneesArray, userId];
    } else if (!input.checked && idx !== -1) {
      const next = [...this.modalAssigneesArray];
      next.splice(idx, 1);
      this.modalAssigneesArray = next;
    }
  }

  onToggleEditAssignee(userId: string, ev: Event) {
    const input = ev.target as HTMLInputElement | null;
    if (!input) return;
    const idx = this.editAssigneesArray.indexOf(userId);
    if (input.checked && idx === -1) {
      this.editAssigneesArray = [...this.editAssigneesArray, userId];
    } else if (!input.checked && idx !== -1) {
      const next = [...this.editAssigneesArray];
      next.splice(idx, 1);
      this.editAssigneesArray = next;
    }
  }

  // Allow selecting multiple items in <select multiple> without holding Ctrl/Command
  onEditAssigneeOptionMouseDown(e: MouseEvent, userId: string) {
    e.preventDefault();
    const idx = this.editAssigneesArray.indexOf(userId);
    if (idx === -1) {
      this.editAssigneesArray = [...this.editAssigneesArray, userId];
    } else {
      const next = [...this.editAssigneesArray];
      next.splice(idx, 1);
      this.editAssigneesArray = next;
    }
  }

  getConnectedLists(): string[] {
    return this.columns.map((c) => 'list-' + c.id);
  }

  trackByColumn = (_: number, c: ColumnDto) => c.id;
  trackByTask = (_: number, t: TaskDto) => t.id;

  initialsOf(user: UserDto): string {
    const label = (user.name || user.email || '').trim();
    if (!label) return '';
    const parts = label.split(' ').filter(Boolean);
    const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    return initials.toUpperCase();
  }

  uniqueAssignees(): UserDto[] {
    const map = new Map<string, UserDto>();
    for (const col of this.columns) {
      for (const t of col.tasks || []) {
        for (const u of t.assignees || []) {
          if (!map.has(u.id)) map.set(u.id, u);
        }
      }
    }
    return Array.from(map.values());
  }

  filterByUser(u: UserDto | null) {
    if (u && this.selectedFilterUserId === u.id) {
      this.selectedFilterUserId = null;
      this.assigneeFilter = '';
    } else if (u) {
      this.selectedFilterUserId = u.id;
      this.assigneeFilter = (u.name || u.email || '');
    } else {
      this.selectedFilterUserId = null;
      this.assigneeFilter = '';
    }
    this.load();
  }

  isFilterUserActive(id: string): boolean {
    return this.selectedFilterUserId === id;
  }

  toggleChipName(taskId: string, userId: string) {
    const cur = this.expandedChip;
    this.expandedChip = cur && cur.taskId === taskId && cur.userId === userId ? null : { taskId, userId };
  }

  hasSelected(taskId: string, userId: string): boolean {
    const set = this.selectedAssignees[taskId];
    return !!set && set.has(userId);
  }

  logout() {
    this.auth.logout();
  }

  // Star helpers (UI-only)
  isStarred(id: string): boolean {
    return this.starred.has(id);
  }

  toggleStar(id: string, ev?: Event) {
    if (ev) ev.stopPropagation();
    if (this.starred.has(id)) this.starred.delete(id); else this.starred.add(id);
    try {
      localStorage.setItem('starredTasks', JSON.stringify(Array.from(this.starred)));
    } catch {}
  }

  currentYear(): number {
    return new Date().getFullYear();
  }


  scrollBoard(delta: number) {
    const el = document.querySelector('.board') as HTMLElement | null;
    if (el) el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  startAddColumn() {
    if (!this.isAdmin) return;
    this.addingColumn = true;
    setTimeout(() => {
      const el = document.getElementById('add-col-input');
      if (el) el.focus();
    }, 0);
  }

  cancelAddColumn() {
    this.addingColumn = false;
    this.newColumnTitle = '';
  }

  async toggleAssignMenu(taskId: string) {
    this.showAssigneeFor = this.showAssigneeFor === taskId ? null : taskId;
    if (this.showAssigneeFor && this.users.length === 0 && !this.loadingUsers) {
      this.loadingUsers = true;
      this.api.listUsers().subscribe({
        next: (u) => (this.users = u),
        error: () => {},
        complete: () => (this.loadingUsers = false),
      });
    }
    if (this.showAssigneeFor) {
      // initialize selection with current assignees
      const task = this.columns.flatMap(c => c.tasks).find(t => t.id === taskId);
      const set = new Set<string>((task?.assignees || []).map(a => a.id));
      this.selectedAssignees[taskId] = set;
    }
  }

  toggleAssignee(taskId: string, userId: string) {
    if (!this.selectedAssignees[taskId]) this.selectedAssignees[taskId] = new Set<string>();
    const set = this.selectedAssignees[taskId];
    if (set.has(userId)) set.delete(userId); else set.add(userId);
  }

  applyAssignees(taskId: string) {
    const ids = Array.from(this.selectedAssignees[taskId] || []);
    this.api.updateTask(taskId, { assigneeIds: ids }).subscribe(() => {
      this.load();
      this.showAssigneeFor = null;
    });
  }

  clearAssignees(taskId: string) {
    this.api.updateTask(taskId, { assigneeIds: [] }).subscribe(() => {
      this.load();
      this.showAssigneeFor = null;
    });
  }

  dropColumn(event: CdkDragDrop<ColumnDto[]>) {
    moveItemInArray(this.columns, event.previousIndex, event.currentIndex);
    this.api.reorderColumns(this.columns.map((c) => c.id)).subscribe();
  }

  dropTask(event: CdkDragDrop<TaskDto[]>, col: ColumnDto) {
    if (event.previousContainer === event.container) {
      moveItemInArray(col.tasks, event.previousIndex, event.currentIndex);
      col.tasks.forEach((t, idx) => this.api.updateTask(t.id, { orderIndex: idx }).subscribe(() => {}));
    } else {
      const prevTasks = event.previousContainer.data as TaskDto[];
      const nextTasks = event.container.data as TaskDto[];
      transferArrayItem(prevTasks, nextTasks, event.previousIndex, event.currentIndex);
      const moved = nextTasks[event.currentIndex];
      this.api.updateTask(moved.id, { columnId: col.id, orderIndex: event.currentIndex }).subscribe(() => {});
      nextTasks.forEach((t, idx) => this.api.updateTask(t.id, { orderIndex: idx }).subscribe(() => {}));
    }
  }

  addColumn() {
    if (!this.isAdmin) return;
    const title = this.newColumnTitle.trim() || 'New Column';
    const orderIndex = this.columns.length;
    this.api.createColumn({ title, orderIndex }).subscribe((created) => {
      this.columns.push({ ...created, tasks: [] });
      this.newColumnTitle = '';
      this.addingColumn = false;
    });
  }

  inviteUser() {
    const email = this.inviteEmail.trim();
    if (!email) return;
    this.api.createInvite(email).subscribe((inv) => {
      const link = `${location.origin}/accept-invite?token=${inv.token}`;
      navigator.clipboard
        .writeText(link)
        .then(() => (this.inviteCopied = true))
        .catch(() => (this.inviteCopied = false));
      setTimeout(() => (this.inviteCopied = false), 2000);
      this.inviteEmail = '';
    });
  }

  startAddTask(columnId: string) {
    if (!this.isAdmin) return;
    // Open modal instead of inline form
    this.modalColumnId = columnId;
    this.modalTitle = '';
    this.modalDescription = '';
    this.modalDueDate = '';
    this.modalPriority = 'medium';
    this.modalAssignees = new Set<string>();
    this.modalAssigneesArray = [];
    this.showTaskModal = true;
  }

  cancelAddTask() {                                                                                                                                                                                                                                                                                                                                                      
    this.addingTaskFor = null;
    this.showTaskModal = false;
    this.modalColumnId = null;
  }

  addTask(columnId: string) {
    if (!this.isAdmin) return;
    const title = (this.newTaskTitle[columnId] || '').trim() || 'New Task';
    const description = (this.newTaskDescription[columnId] || '').trim();
    const dueDate = this.newTaskDueDate[columnId] || null;
    const priority = this.newTaskPriority[columnId] || 'medium';
    const assigneeIds = Array.from(this.newTaskAssignees[columnId] || []);
    const column = this.columns.find((c) => c.id === columnId)!;
    const orderIndex = column.tasks.length;
    this.api
      .createTask({ title, description, orderIndex, columnId, priority, dueDate, assigneeIds })
      .subscribe((task) => {
        column.tasks.push(task);
        this.newTaskTitle[columnId] = '';
        this.newTaskDescription[columnId] = '';
        this.newTaskDueDate[columnId] = '';
        this.newTaskPriority[columnId] = 'medium';
        this.newTaskAssignees[columnId] = new Set<string>();
        this.addingTaskFor = null;
      });
  }

  deleteTask(id: string) {
    this.api.deleteTask(id).subscribe(() => this.load());
  }

  removeColumn(id: string) {
    if (!this.isAdmin) return;
    this.api.deleteColumn(id).subscribe(() => this.load());
  }

  onAssigneeCheckboxChange(columnId: string, userId: string, event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    if (!this.newTaskAssignees[columnId]) this.newTaskAssignees[columnId] = new Set<string>();
    if (input.checked) {
      this.newTaskAssignees[columnId].add(userId);
    } else {
      this.newTaskAssignees[columnId].delete(userId);
    }
  }
}
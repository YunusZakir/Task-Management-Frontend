import { Component, OnInit, inject } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ColumnDto, TaskDto, UserDto } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
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
  addingColumn = false;
  addingTaskFor: string | null = null;
  showAssigneeFor: string | null = null;
  users: UserDto[] = [];
  loadingUsers = false;
  selectedAssignees: Record<string, Set<string>> = {};
  expandedChip: { taskId: string; userId: string } | null = null;
  theme: 'light' | 'dark' = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';

  ngOnInit() {
  this.load();
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    this.isAdmin = !!u?.isAdmin;
  } catch {}
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(this.theme);
}

  load() {
    this.api
      .getBoard(this.assigneeFilter ? { assignee: this.assigneeFilter } : undefined)
      .subscribe((cols) => (this.columns = cols));
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
    this.assigneeFilter = u ? (u.name || u.email || '') : '';
    this.load();
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

  currentYear(): number {
    return new Date().getFullYear();
  }

toggleTheme() {
  this.theme = this.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', this.theme);
  document.body.classList.remove('light', 'dark');
  document.body.classList.add(this.theme);
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
    this.addingTaskFor = columnId;
    setTimeout(() => {
      const el = document.getElementById(`add-task-input-${columnId}`);
      if (el) el.focus();
    }, 0);
  }

  cancelAddTask() {
    this.addingTaskFor = null;
  }

  addTask(columnId: string) {
    if (!this.isAdmin) return;
    const title = (this.newTaskTitle[columnId] || '').trim() || 'New Task';
    const description = '';
    const column = this.columns.find((c) => c.id === columnId)!;
    const orderIndex = column.tasks.length;
    this.api
      .createTask({ title, description, orderIndex, columnId })
      .subscribe((task) => {
        column.tasks.push(task);
        this.newTaskTitle[columnId] = '';
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
}

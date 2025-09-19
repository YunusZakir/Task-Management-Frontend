import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// --- DTOs ---
export interface UserDto { 
  id: string; 
  email: string; 
  name?: string; 
  isAdmin: boolean; 
}

export interface TaskDto {
  id: string;
  title: string;
  description?: string;
  orderIndex: number;
  column: { id: string };
  assignees?: UserDto[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  labels?: string | null;
}

export interface ColumnDto { 
  id: string; 
  title: string; 
  orderIndex: number; 
  tasks: TaskDto[]; 
}

export interface CommentDto {
  id: string;
  content: string;
  createdAt: string;
  author?: { id: string; name?: string; email: string } | null;
}

export interface HistoryDto {
  id: string;
  action: 'create' | 'update' | 'delete' | 'assign' | 'unassign' | 'move';
  field?: 'title' | 'description' | 'priority' | 'dueDate' | 'orderIndex' | 'column' | 'assignees' | null;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
  actor?: { id: string; name?: string; email: string } | null;
}

// --- API Service ---
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private base: string;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      // ✅ Running in browser: prefer environment, allow window override
      this.base = (window as any).__API__ || environment.apiUrl;
    } else {
      // ✅ Running on server (SSR)
      this.base = process.env['API_URL'] || environment.apiUrl;
    }
  }

  // --- Auth ---
  login(data: { email: string; password: string }): Observable<{ accessToken: string; user: UserDto }> {
    return this.http.post<{ accessToken: string; user: UserDto }>(`${this.base}/auth/login`, data);
  }

  acceptInvite(data: { token: string; name?: string; password: string }): Observable<{ accessToken: string; user: UserDto }> {
    return this.http.post<{ accessToken: string; user: UserDto }>(`${this.base}/auth/accept-invite`, data);
  }

  // --- Board ---
  getBoard(params?: { assignee?: string }): Observable<ColumnDto[]> {
    const assignee = params?.assignee ? `?assignee=${encodeURIComponent(params.assignee)}` : '';
    return this.http.get<ColumnDto[]>(`${this.base}/columns${assignee}`);
  }

  createColumn(body: { title: string; orderIndex: number }): Observable<ColumnDto> {
    return this.http.post<ColumnDto>(`${this.base}/columns`, body);
  }

  updateColumn(id: string, body: Partial<{ title: string; orderIndex: number }>): Observable<ColumnDto> {
    return this.http.patch<ColumnDto>(`${this.base}/columns/${id}`, body);
  }

  reorderColumns(ids: string[]): Observable<ColumnDto[]> {
    return this.http.patch<ColumnDto[]>(`${this.base}/columns/reorder/all`, { ids });
  }

  // --- Tasks ---
  createTask(body: { title: string; description?: string; orderIndex: number; columnId: string; assigneeIds?: string[]; priority?: 'low' | 'medium' | 'high'; dueDate?: string | null; labels?: string | null }): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.base}/tasks`, body);
  }

  updateTask(id: string, body: Partial<{ title: string; description: string; orderIndex: number; columnId: string; assigneeIds: string[] | null; priority: 'low' | 'medium' | 'high'; dueDate: string | null; labels: string | null }>): Observable<TaskDto> {
    return this.http.patch<TaskDto>(`${this.base}/tasks/${id}`, body);
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/tasks/${id}`);
  }

  // --- Columns ---
  deleteColumn(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/columns/${id}`);
  }

  // --- Users & Invites ---
  listUsers(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.base}/users`);
  }

  createInvite(email: string): Observable<{ id: string; token: string; email: string }> {
    return this.http.post<{ id: string; token: string; email: string }>(`${this.base}/invites`, { email });
  }

  // --- Comments ---
  listComments(taskId: string): Observable<CommentDto[]> {
    return this.http.get<CommentDto[]>(`${this.base}/tasks/${taskId}/comments`);
  }

  addComment(taskId: string, content: string): Observable<CommentDto> {
    return this.http.post<CommentDto>(`${this.base}/tasks/${taskId}/comments`, { content });
  }

  // --- History ---
  listHistory(taskId: string): Observable<HistoryDto[]> {
    return this.http.get<HistoryDto[]>(`${this.base}/tasks/${taskId}/history`);
  }
}

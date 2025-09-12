import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

export interface UserDto { id: string; email: string; name?: string; isAdmin: boolean }
export interface TaskDto {
  id: string;
  title: string;
  description?: string;
  orderIndex: number;
  column: { id: string };
  assignees?: UserDto[];
}
export interface ColumnDto { id: string; title: string; orderIndex: number; tasks: TaskDto[] }

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private base: string;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      // ✅ Running in browser
      this.base = (window as any).__API__ || 'http://localhost:3000';
    } else {
      // ✅ Running on server (SSR)
      this.base = process.env['API_URL'] || 'http://localhost:3000';
    }
  }

  login(data: { email: string; password: string }) {
    return this.http.post<{ accessToken: string; user: UserDto }>(`${this.base}/auth/login`, data);
  }

  acceptInvite(data: { token: string; name?: string; password: string }) {
    return this.http.post<{ accessToken: string; user: UserDto }>(`${this.base}/auth/accept-invite`, data);
  }

  getBoard(params?: { assignee?: string }): Observable<ColumnDto[]> {
    const assignee = params?.assignee ? `?assignee=${encodeURIComponent(params.assignee)}` : '';
    return this.http.get<ColumnDto[]>(`${this.base}/columns${assignee}`);
  }

  createColumn(body: { title: string; orderIndex: number }) {
    return this.http.post<ColumnDto>(`${this.base}/columns`, body);
  }

  updateColumn(id: string, body: Partial<{ title: string; orderIndex: number }>) {
    return this.http.patch<ColumnDto>(`${this.base}/columns/${id}`, body);
  }

  reorderColumns(ids: string[]) {
    return this.http.patch<ColumnDto[]>(`${this.base}/columns/reorder/all`, { ids });
  }

  createTask(body: { title: string; description?: string; orderIndex: number; columnId: string; assigneeIds?: string[] }) {
    return this.http.post<TaskDto>(`${this.base}/tasks`, body);
  }

  updateTask(id: string, body: Partial<{ title: string; description: string; orderIndex: number; columnId: string; assigneeIds: string[] | null }>) {
    return this.http.patch<TaskDto>(`${this.base}/tasks/${id}`, body);
  }

  deleteTask(id: string) {
    return this.http.delete(`${this.base}/tasks/${id}`);
  }

  deleteColumn(id: string) {
    return this.http.delete(`${this.base}/columns/${id}`);
  }

  listUsers() {
    return this.http.get<UserDto[]>(`${this.base}/users`);
  }

  createInvite(email: string) {
    return this.http.post<{ id: string; token: string; email: string }>(`${this.base}/invites`, { email });
  }
}

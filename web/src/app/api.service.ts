import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { AuditEntry, Handover, Health, Incident, Machine, Run, SearchResult, Ticket } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  health() { return this.request<Health>('GET', '/health'); }
  incidents() { return this.request<Incident[]>('GET', '/incidents'); }
  machines() { return this.request<Machine[]>('GET', '/machines'); }
  tickets() { return this.request<Ticket[]>('GET', '/tickets'); }
  audit() { return this.request<AuditEntry[]>('GET', '/audit'); }
  investigate(incidentId: string, question: string) {
    return this.request<Run>('POST', '/investigate', { incidentId, question });
  }
  approve(ticketId: string) {
    return this.request<{ status: string }>('POST', `/tickets/${encodeURIComponent(ticketId)}/approve`, { confirmed: true });
  }
  search(query: string) { return this.request<SearchResult>('POST', '/search', { query }); }
  handover() { return this.request<Handover>('POST', '/handover', {}); }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, '/api' + path, { body }));
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        const detail = error.error?.detail ?? error.error?.error;
        throw new Error(typeof detail === 'string' ? detail : error.status === 0
          ? '無法連線至本機服務，請檢查服務是否已啟動。' : `HTTP ${error.status}`);
      }
      throw error;
    }
  }
}

import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import type { AuditEntry, Handover, Health, Incident, Machine, Run, SearchResult, Ticket } from './models';

@Injectable({ providedIn: 'root' })
export class FabOpsStore {
  private readonly api = inject(ApiService);
  readonly incidents = signal<Incident[]>([]);
  readonly machines = signal<Machine[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly audit = signal<AuditEntry[]>([]);
  readonly health = signal<Health | null>(null);
  readonly run = signal<Run | null>(null);
  readonly selected = signal('INC-1001');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly reviewed = signal(false);
  readonly question = signal('根據設備數值、異常與保養紀錄，檢索 SOP，提出有來源的建議；需要追蹤時建立 Ticket 草稿。');
  readonly searchQuery = signal('vacuum pressure');
  readonly searchResults = signal<SearchResult | null>(null);
  readonly handoverResult = signal<Handover | null>(null);
  readonly current = computed(() => this.incidents().find(i => i.id === this.selected()));
  readonly telemetry = computed(() => Object.entries(this.machines().find(m => m.id === this.current()?.machineId)?.telemetry ?? {}));
  readonly liveCount = computed(() => Object.values(this.health()?.dependencies ?? {}).filter(Boolean).length);
  readonly priorityCount = computed(() => this.incidents().filter(i => i.severity === 'P1').length);
  readonly approved = computed(() => this.run()?.ticket?.status === 'approved');

  refresh() {
    return this.act(async () => {
      this.health.set(await this.api.health());
      const [incidents, machines, tickets, audit] = await Promise.all([
        this.api.incidents(), this.api.machines(), this.api.tickets(), this.api.audit(),
      ]);
      this.incidents.set(incidents); this.machines.set(machines);
      this.tickets.set(tickets); this.audit.set(audit);
    });
  }

  investigate() {
    return this.act(async () => {
      this.run.set(null); this.reviewed.set(false);
      this.run.set(await this.api.investigate(this.selected(), this.question()));
      this.tickets.set(await this.api.tickets());
    });
  }

  approve() {
    const ticket = this.run()?.ticket;
    // UI confirmation is also checked here; the API independently enforces approval policy.
    if (!ticket || !this.reviewed() || this.approved()) return Promise.resolve();
    return this.act(async () => {
      await this.api.approve(ticket.id);
      this.run.update(run => run ? { ...run, ticket: { ...ticket, status: 'approved' } } : run);
      this.reviewed.set(false);
      const [tickets, audit] = await Promise.all([this.api.tickets(), this.api.audit()]);
      this.tickets.set(tickets); this.audit.set(audit);
    });
  }

  choose(id: string) {
    if (this.busy()) return;
    this.selected.set(id); this.run.set(null); this.reviewed.set(false);
  }

  search() {
    return this.act(async () => { this.searchResults.set(await this.api.search(this.searchQuery())); });
  }

  generateHandover() {
    return this.act(async () => { this.handoverResult.set(await this.api.handover()); });
  }

  private async act(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try { await action(); }
    catch (error: unknown) { this.error.set(error instanceof Error ? error.message : '請求失敗，請檢查服務。'); }
    finally { this.busy.set(false); }
  }
}

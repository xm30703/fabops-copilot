import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FabOpsStore } from '../fabops.store';

@Component({
  selector: 'fabops-audit',
  imports: [JsonPipe],
  template: `
    <section class="panel standalone">
      <div class="panel-heading"><h2>工單與核准紀錄</h2><span>HUMAN-IN-THE-LOOP</span></div>
      <div class="table-wrap"><table><thead><tr><th>Ticket</th><th>事故</th><th>狀態</th><th>核准人</th></tr></thead><tbody>
        @for (ticket of store.tickets(); track ticket.id) {
          <tr><td>{{ ticket.title }}<small class="mono">{{ ticket.id }}</small></td><td>{{ ticket.incidentId }}</td><td><span class="mode">{{ ticket.status }}</span></td><td>{{ ticket.approvedBy || '待人工審查' }}</td></tr>
        }
      </tbody></table></div>
      @if (!store.tickets().length) { <p class="empty">尚無工單。完成一次調查後可檢視草稿。</p> }
      <h3 class="audit-title">Audit trail</h3>
      @for (item of store.audit(); track $index) { <article class="source"><span>{{ item.eventName }}</span><p>{{ item.at }}</p><code>{{ item.payload | json }}</code></article> }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditComponent { readonly store = inject(FabOpsStore); }

import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FabOpsStore } from '../fabops.store';

@Component({
  selector: 'fabops-handover',
  imports: [JsonPipe],
  template: `
    <section class="panel standalone">
      <div class="panel-heading"><h2>Shift handover summary</h2><span>OBSERVED FACTS → SUMMARY</span></div>
      <p>以目前事故與 Ticket 狀態整理交接內容，保留事故 ID 供核對。</p>
      <button class="primary" [disabled]="store.busy()" (click)="store.generateHandover()">{{ store.busy() ? '產生中…' : '產生交接摘要' }}</button>
      @if (store.handoverResult(); as result) {
        <p class="mode">{{ result.mode }}</p><pre class="handover">{{ result.summary }}</pre>
        @for (id of result.incidentIds; track id) { <span class="citation">{{ id }}</span> }
        <details><summary>核對摘要使用的原始資料</summary><pre>{{ result.facts | json }}</pre></details>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandoverComponent { readonly store = inject(FabOpsStore); }

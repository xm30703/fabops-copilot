import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FabOpsStore } from '../fabops.store';

@Component({
  selector: 'fabops-knowledge',
  imports: [ReactiveFormsModule],
  template: `
    <section class="panel standalone">
      <div class="panel-heading"><h2>Enterprise knowledge search</h2><span>POSTGRESQL + PGVECTOR</span></div>
      <p>SOP 分段、embedding 與關鍵字混合搜尋；embedding 不可用時會標示降級。</p>
      <form class="search-form" [formGroup]="form" (ngSubmit)="store.search()">
        <input aria-label="搜尋 SOP" formControlName="query" placeholder="vacuum pressure / 真空壓力" required maxlength="1000">
        <button class="primary" type="submit" [disabled]="!ready() || store.busy() || form.invalid || !store.searchQuery().trim()">搜尋</button>
      </form>
      @if (store.searchResults(); as results) {
        <p class="mode">{{ results.mode }} {{ results.warning }}</p>
        @for (source of results.evidence; track source.id) {
          <article class="source"><span class="mono">{{ source.id }} · {{ source.score.toFixed(3) }}</span><h3>{{ source.title }}</h3><p>{{ source.content }}</p></article>
        } @empty { <p class="empty">找不到符合的文件；不產生沒有依據的回答。</p> }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeComponent {
  readonly store = inject(FabOpsStore);
  readonly ready = signal(false);
  readonly form = new FormGroup({
    query: new FormControl({ value: this.store.searchQuery(), disabled: true }, { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000)] }),
  });

  constructor() {
    this.form.controls.query.valueChanges.pipe(takeUntilDestroyed()).subscribe(query => this.store.searchQuery.set(query));
    // Keep the input disabled until Angular has attached the control bindings.
    afterNextRender(() => {
      this.form.controls.query.enable({ emitEvent: false });
      this.ready.set(true);
    });
  }
}

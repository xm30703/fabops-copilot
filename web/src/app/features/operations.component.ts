import { DOCUMENT, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FabOpsStore } from '../fabops.store';

@Component({
  selector: 'fabops-operations',
  imports: [FormsModule, JsonPipe],
  templateUrl: './operations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationsComponent {
  readonly store = inject(FabOpsStore);
  private readonly document = inject(DOCUMENT);

  showSource(id: string) { this.document.getElementById(id)?.scrollIntoView({ block: 'start' }); }
}

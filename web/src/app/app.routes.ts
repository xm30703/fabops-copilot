import type { Routes } from '@angular/router';
import { OperationsComponent } from './features/operations.component';
import { KnowledgeComponent } from './features/knowledge.component';
import { HandoverComponent } from './features/handover.component';
import { AuditComponent } from './features/audit.component';

export const routes: Routes = [
  { path: 'operations', component: OperationsComponent },
  { path: 'knowledge', component: KnowledgeComponent },
  { path: 'handover', component: HandoverComponent },
  { path: 'audit', component: AuditComponent },
  { path: '', redirectTo: 'operations', pathMatch: 'full' },
  { path: '**', redirectTo: 'operations' },
];

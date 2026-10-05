import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { FabOpsStore } from './fabops.store';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  readonly store = inject(FabOpsStore);
  private readonly router = inject(Router);
  readonly navigation = [
    { path: '/operations', icon: '◈', label: '事故應變', number: '01', breadcrumb: 'INCIDENT RESPONSE', title: '從告警到有依據的決策' },
    { path: '/knowledge', icon: '▤', label: '知識檢索', number: '02', breadcrumb: 'KNOWLEDGE SEARCH', title: '每一個建議，都有來源' },
    { path: '/handover', icon: '⇄', label: '值班交接', number: '03', breadcrumb: 'SHIFT HANDOVER', title: '讓下一班接得住' },
    { path: '/audit', icon: '◎', label: '工單與稽核', number: '04', breadcrumb: 'AUDIT TRAIL', title: '留下可追溯的決策紀錄' },
  ];
  private readonly url = toSignal(this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map(event => event.urlAfterRedirects),
  ), { initialValue: this.router.url });
  readonly page = computed(() => this.navigation.find(item => item.path === this.url().split(/[?#]/)[0]) ?? this.navigation[0]);

  ngOnInit() { void this.store.refresh(); }
}

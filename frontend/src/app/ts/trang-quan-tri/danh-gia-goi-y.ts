import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ApiService } from '../dich-vu/api.service';

interface Metrics {
  offline: { k: number; profiles: number; products: number; precisionAtK: number; hitRateAtK: number; ndcgAtK: number; coverage: number; stability: number;
    detail: Array<{ profile: string; topK: Array<{ name: string; score: number; relevance: number }>; precision: number; hit: number; ndcg: number | null }> };
  online: { sampleSize: number; enoughSamples: boolean; avgMatchScoreRating: number | null; spearmanScoreVsRating: number | null; completedProfiles: number };
}

/** Đánh giá chất lượng gợi ý — UC-DASH-002 (FR-DASH-REC-001): Precision@K, HitRate@K, NDCG@K, coverage, độ ổn định; tương quan Spearman điểm match ↔ đánh giá. */
@Component({ selector: 'app-danh-gia-goi-y', standalone: true, imports: [DecimalPipe, PercentPipe], templateUrl: '../../html/trang-quan-tri/danh-gia-goi-y.html' })
export class DanhGiaGoiY implements OnInit {
  private api = inject(ApiService);
  m = signal<Metrics | null>(null);
  async ngOnInit() { this.m.set(await this.api.get<Metrics>('/admin/recommendation-metrics').catch(() => null)); }
}

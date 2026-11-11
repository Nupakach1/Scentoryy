/**
 * npm run evaluate — đánh giá ngoại tuyến Scent Match (UC-DASH-002) trên dữ liệu du-lieu/san-pham,
 * KHÔNG cần kết nối CSDL. Kết quả dùng cho Chương 3 mục 3.4.
 */
import { offlineMetrics } from "../dich-vu/evaluation";
import { familyDocs, productDocs } from "./duLieuDanhMuc";

const r = offlineMetrics(productDocs(), familyDocs());
console.log(`Hồ sơ kiểm thử: ${r.profiles} · Sản phẩm: ${r.products} · K = ${r.k}`);
console.log(`Precision@${r.k}: ${r.precisionAtK}  HitRate@${r.k}: ${r.hitRateAtK}  NDCG@${r.k}: ${r.ndcgAtK}  Độ phủ: ${r.coverage}  Độ ổn định: ${r.stability}`);
for (const d of r.detail) console.log(`- ${d.profile}: ${d.topK.map((t) => `${t.name} (${t.score}, nhãn ${t.relevance})`).join("; ")}`);
if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));

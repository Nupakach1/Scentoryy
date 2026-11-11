/**
 * Đọc dữ liệu danh mục từ backend/du-lieu/san-pham (6 thương hiệu, 37 sản phẩm, 8 nhóm hương Michael Edwards)
 * và dựng tài liệu MongoDB tương ứng. Hàm thuần — dùng cho seed và kiểm thử.
 */
import fs from "node:fs";
import path from "node:path";
import {
  FAMILY_NOTES,
  FAMILY_OCCASIONS,
  deriveConcentrationProfile,
  normalizeFamily,
  SCENTORY_FAMILIES,
  type ScentoryFamily,
} from "../cau-hinh/scentMatch";

export const DATA_DIR = path.resolve(__dirname, "..", "..", "du-lieu", "san-pham");
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")) as T;
type Row = Record<string, unknown>;

export const BRANDS = [
  { name: "Le Labo", slug: "le-labo", file: "Le Labo.json" },
  { name: "Byredo", slug: "byredo", file: "Byredo.json" },
  { name: "Dior Privée", slug: "dior-privee", file: "dior-privee.json" },
  { name: "Maison Margiela", slug: "maison-margiela", file: "Maison Margiela.json" },
  { name: "Diptyque", slug: "diptyque", file: "Diptyque.json" },
  { name: "Creed", slug: "creed", file: "Creed.json" },
];

/** Nhóm lân cận trên bánh xe hương Michael Edwards (khớp 0,5 điểm trong Scent Match). */
const CORRELATED: Record<ScentoryFamily, string[]> = {
  Woody: ["Chypre", "Oriental/Amber", "Fougère"],
  Aromatic: ["Fresh/Citrus", "Fougère"],
  Floral: ["Chypre", "Fresh/Citrus", "Gourmand"],
  "Fresh/Citrus": ["Aromatic", "Floral"],
  Fougère: ["Aromatic", "Woody"],
  "Oriental/Amber": ["Gourmand", "Woody"],
  Chypre: ["Woody", "Floral"],
  Gourmand: ["Oriental/Amber", "Floral"],
};

/** Nội dung thẻ nhóm hương — lấy nguyên từ giao diện gốc (customer-ui/pages/scent-families.html). */
const FAMILY_CARD: Record<ScentoryFamily, { anh: string; ten: string; moTa: string; not: string; thanThai: string }> = {
  Woody: { anh: "woody", ten: "Gỗ Ấm Áp & Trầm Lắng", moTa: "Sâu lắng, ấm áp và bền bỉ, gợi những khu rừng gỗ quý cùng hơi ấm của tinh dầu gỗ.", not: "Đàn hương, Tuyết tùng, Hoắc hương", thanThai: "Trầm ổn, quyền lực, bí ẩn." },
  Aromatic: { anh: "aromatic", ten: "Thảo Mộc Xanh Mát", moTa: "Xanh mát và sạch sẽ với thảo mộc, quả bách xù và lá cây, mang lại cảm giác thư thái, gần gũi.", not: "Bách xù, Trà đen, Rong biển", thanThai: "Thư thái, tự nhiên, trong lành." },
  Floral: { anh: "floral", ten: "Hoa Cỏ Tinh Khiết & Tao Nhã", moTa: "Dịu dàng, sang trọng và tràn đầy sức sống như bình minh sớm phủ sương trên vườn hoa.", not: "Hoa hồng, Diên vĩ, Hoa nhài, Mẫu đơn", thanThai: "Duyên dáng, thanh lịch, rạng rỡ." },
  "Fresh/Citrus": { anh: "citrus", ten: "Cam Chanh Tươi Mát", moTa: "Sáng, sạch và tràn năng lượng như vườn cam chanh dưới nắng, hợp những ngày nóng ở Việt Nam.", not: "Cam bergamot, Chanh, Bưởi, Quýt", thanThai: "Tươi tỉnh, năng động, gần gũi." },
  Fougère: { anh: "fougere", ten: "Oải Hương & Dương Xỉ Cổ Điển", moTa: "Cấu trúc kinh điển với oải hương và thảo mộc, sạch sẽ, nam tính và đậm chất truyền thống.", not: "Oải hương, Cam bergamot, Quế", thanThai: "Lịch lãm, nam tính, cổ điển." },
  "Oriental/Amber": { anh: "oriental", ten: "Hổ Phách & Gia Vị Phương Đông", moTa: "Ấm, dày và quyến rũ với nhựa thơm cùng gia vị, tạo vệt hương nồng nàn cho buổi tối sang trọng.", not: "Hổ phách, Nhũ hương, Hoa hồng", thanThai: "Quyến rũ, gợi cảm, tiệc đêm." },
  Chypre: { anh: "chypre", ten: "Chypre Thanh Lịch", moTa: "Cấu trúc cổ điển từ cam bergamot, hoa hồng và nền gỗ rêu, mang vẻ trưởng thành và tinh tế.", not: "Cam bergamot, Hoa hồng, Hoa nhài", thanThai: "Trưởng thành, tinh tế, sang trọng." },
  Gourmand: { anh: "gourmand", ten: "Ngọt Ngào Kiểu Bánh Kẹo", moTa: "Ấm áp và ngọt ngào, gợi hơi ấm lò sưởi, tách cà phê buổi sáng và những khoảnh khắc êm đềm.", not: "Cà phê, Tiêu hồng, Hoa cam", thanThai: "Ấm áp, ngọt ngào, êm đềm." },
};

export function familyDocs() {
  return SCENTORY_FAMILIES.map((name, i) => {
    const c = FAMILY_CARD[name];
    return {
      Name: name,
      NameVi: c.ten,
      Description: c.moTa,
      KeyNotes: c.not,
      Vibe: c.thanThai,
      CorrelatedFamilies: CORRELATED[name],
      ImageUrl: `/hinh-anh/nhom-huong/${c.anh}.webp`,
      DisplayOrder: i + 1,
      IsActive: true,
    };
  });
}

export function brandDocs() {
  return BRANDS.map((b) => {
    const rows = read<Row[]>(b.file);
    const info = (label: string) => String(rows.find((r) => Object.values(r)[0] === label)?.["Unnamed: 1"] ?? "");
    return {
      Name: b.name,
      Slug: b.slug,
      Origin: info("Xuất xứ"),
      Style: info("Phong cách"),
      Description: [info("Mô tả"), info("Lịch sử")].filter(Boolean).join(" "),
      ImageUrl: `/hinh-anh/thuong-hieu/${b.slug}-ngang.webp`,
      IsActive: true,
    };
  });
}

/** Nồng độ + đầu hương thật lấy từ bảng của từng thương hiệu. */
function skuMeta(): Map<string, { concentration: string; top: string }> {
  const m = new Map<string, { concentration: string; top: string }>();
  for (const b of BRANDS) {
    for (const r of read<Row[]>(b.file)) {
      const v = Object.values(r);
      if (typeof v[0] === "string" && /^[A-Z]{2,4}-\d{3}$/.test(v[0])) m.set(v[0], { concentration: String(v[2] ?? "EDP · 50ml"), top: String(v[4] ?? "") });
    }
  }
  return m;
}

export function productDocs() {
  const meta = skuMeta();
  return read<Row[]>("tong-hop-sp.json").map((r) => {
    const sku = String(r["SKU"]);
    const family = (normalizeFamily(String(r["Nhóm hương (Michael Edwards)"])) ?? "Woody") as ScentoryFamily;
    const m = meta.get(sku);
    const conc = deriveConcentrationProfile(m?.concentration ?? "EDP");
    const volume = Number(/(\d+)\s*ml/i.exec(m?.concentration ?? "")?.[1] ?? 50);
    const notes = FAMILY_NOTES[family];
    const name = String(r["Tên sản phẩm"]);
    return {
      SKU: sku,
      Name: name,
      BrandName: String(r["Thương hiệu"]),
      Price: Number(r["Giá (VNĐ)"]),
      StockQuantity: 40,
      Concentration: conc.concentration,
      Volume: volume,
      ScentFamily: family,
      TopNotes: m?.top?.trim() || notes.middle,
      MiddleNotes: notes.middle,
      BaseNotes: notes.base,
      Projection: conc.projection,
      Longevity: conc.longevity,
      Occasion: FAMILY_OCCASIONS[family].join(", "),
      Description: `${name} thuộc nhóm ${family}: mở đầu bằng ${(m?.top || notes.middle).toLowerCase()}, lắng lại với ${notes.base.toLowerCase()}.`,
      ImageUrl: `/hinh-anh/san-pham/${sku.toLowerCase()}.webp`,
      GalleryUrls: [`/hinh-anh/san-pham/${sku.toLowerCase()}-2.webp`],
      SoldCount: Number(r["Đã bán (30 ngày)"] ?? 0),
      IsActive: true,
    };
  });
}

export function voucherDocs(now = new Date()) {
  const start = new Date(now.getTime() - 86_400_000);
  const end = new Date(now.getFullYear() + 1, 11, 31);
  return [
    { Code: "SCENTORY10", Title: "Giảm 10% giá trị tác phẩm", Description: "Đơn tối thiểu 2.000.000đ, giảm tối đa 1.000.000đ", DiscountType: "PERCENT", DiscountValue: 10, MinOrderAmount: 2_000_000, MaxDiscountAmount: 1_000_000, UsageLimit: 1000, StartAt: start, EndAt: end, IsActive: true },
    { Code: "WELCOME50", Title: "Ưu đãi chào mừng giảm 50.000đ", Description: "Áp dụng cho mọi đơn hàng", DiscountType: "FIXED", DiscountValue: 50_000, MinOrderAmount: 0, UsageLimit: 1000, StartAt: start, EndAt: end, IsActive: true },
    { Code: "FREESHIP", Title: "Hỗ trợ phí vận chuyển đến 35.000đ", Description: "Áp dụng cho đơn có phí giao hàng (Hỏa tốc)", DiscountType: "SHIPPING", DiscountValue: 35_000, MinOrderAmount: 0, UsageLimit: 1000, StartAt: start, EndAt: end, IsActive: true },
  ];
}

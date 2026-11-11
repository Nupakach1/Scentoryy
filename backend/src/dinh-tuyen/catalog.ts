/**
 * Danh mục — UC-CAT-001 (tìm kiếm/lọc), UC-CAT-002 (chi tiết), UC-CAT-003 (thương hiệu, nhóm hương).
 * Quy tắc: BR-CAT-001, BR-CAT-002.
 */
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../cau-hinh/nghiepVu";
import { AppError } from "../trung-gian/error";
import { Product } from "../mo-hinh/Product";
import { Brand } from "../mo-hinh/Brand";
import { ScentFamily } from "../mo-hinh/ScentFamily";
import { toProductDto } from "../dich-vu/dto";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, paging } from "../tien-ich/phanHoi";

export const productsRouter = Router();
export const brandsRouter = Router();
export const familiesRouter = Router();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  family: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(100).optional(),
  concentration: z.string().trim().max(50).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "bestseller", "rating", "name"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

/** Bộ lọc danh mục dùng chung cho /products và /match/products. */
export function buildProductFilter(q: z.infer<typeof ListQuery>): Record<string, unknown> {
  const filter: Record<string, unknown> = { IsActive: true };
  if (q.q) {
    const re = new RegExp(escapeRe(q.q), "i");
    filter.$or = [{ Name: re }, { BrandName: re }, { TopNotes: re }, { MiddleNotes: re }, { BaseNotes: re }, { ScentFamily: re }];
  }
  if (q.family) filter.ScentFamily = { $in: q.family.split(",").map((s) => s.trim()) };
  if (q.brand) filter.BrandName = { $in: q.brand.split(",").map((s) => s.trim()) };
  if (q.concentration) filter.Concentration = { $in: q.concentration.split(",").map((s) => s.trim()) };
  if (q.minPrice != null || q.maxPrice != null) {
    filter.Price = { ...(q.minPrice != null ? { $gte: q.minPrice } : {}), ...(q.maxPrice != null ? { $lte: q.maxPrice } : {}) };
  }
  return filter;
}
export { ListQuery as ProductListQuery };

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { CreatedAt: -1, Name: 1 },
  price_asc: { Price: 1, Name: 1 },
  price_desc: { Price: -1, Name: 1 },
  bestseller: { SoldCount: -1, Name: 1 },
  rating: { AvgRating: -1, Name: 1 },
  name: { Name: 1 },
};

// GET /api/v1/products — FR-CAT-SRCH-001, FR-CAT-FLT-001, FR-CAT-SORT-001
productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = ListQuery.parse(req.query);
    const { page, limit, skip } = paging(req.query as Record<string, unknown>, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const filter = buildProductFilter(q);
    const [items, total, facets] = await Promise.all([
      Product.find(filter).sort(SORTS[q.sort ?? "name"]).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
      Product.aggregate([
        { $match: { IsActive: true } },
        { $facet: {
            families: [{ $group: { _id: "$ScentFamily", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
            brands: [{ $group: { _id: "$BrandName", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
            concentrations: [{ $group: { _id: "$Concentration", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
            price: [{ $group: { _id: null, min: { $min: "$Price" }, max: { $max: "$Price" } } }],
        } },
      ]),
    ]);
    const f = facets[0] ?? {};
    ok(res, items.map(toProductDto), {
      page, limit, total, pages: Math.ceil(total / limit),
      facets: {
        families: (f.families ?? []).map((x: { _id: string; count: number }) => ({ value: x._id, count: x.count })),
        brands: (f.brands ?? []).map((x: { _id: string; count: number }) => ({ value: x._id, count: x.count })),
        concentrations: (f.concentrations ?? []).map((x: { _id: string; count: number }) => ({ value: x._id, count: x.count })),
        price: f.price?.[0] ? { min: f.price[0].min, max: f.price[0].max } : null,
      },
    });
  })
);

// GET /api/v1/products/:idOrSku — FR-CAT-DTL-001
productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const p = Types.ObjectId.isValid(id)
      ? await Product.findById(id).lean()
      : await Product.findOne({ SKU: id.toUpperCase() }).lean();
    if (!p || !p.IsActive) throw new AppError("ERR-CAT-404-01");
    const related = await Product.find({ IsActive: true, ScentFamily: p.ScentFamily, _id: { $ne: p._id } }).sort({ SoldCount: -1 }).limit(4).lean();
    ok(res, { ...toProductDto(p), related: related.map(toProductDto) });
  })
);

// GET /api/v1/brands — FR-CAT-BRD-001
brandsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [brands, counts] = await Promise.all([
      Brand.find({ IsActive: true }).sort({ Name: 1 }).lean(),
      Product.aggregate([{ $match: { IsActive: true } }, { $group: { _id: "$BrandName", count: { $sum: 1 }, minPrice: { $min: "$Price" } } }]),
    ]);
    const byName = new Map(counts.map((c: { _id: string; count: number; minPrice: number }) => [c._id, c]));
    ok(res, brands.map((b) => ({
      id: String(b._id), name: b.Name, slug: b.Slug, description: b.Description, origin: b.Origin, style: b.Style,
      imageUrl: b.ImageUrl, productCount: byName.get(b.Name)?.count ?? 0, minPrice: byName.get(b.Name)?.minPrice ?? null,
    })));
  })
);

brandsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const b = await Brand.findOne({ Slug: String(req.params.slug).toLowerCase(), IsActive: true }).lean();
    if (!b) throw new AppError("ERR-CAT-404-01", "Thương hiệu không tồn tại.");
    const products = await Product.find({ BrandName: b.Name, IsActive: true }).sort({ SoldCount: -1 }).lean();
    ok(res, {
      id: String(b._id), name: b.Name, slug: b.Slug, description: b.Description, origin: b.Origin, style: b.Style,
      imageUrl: b.ImageUrl, products: products.map(toProductDto),
    });
  })
);

// GET /api/v1/scent-families — FR-CAT-FAM-001
familiesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [families, counts] = await Promise.all([
      ScentFamily.find({ IsActive: true }).sort({ DisplayOrder: 1 }).lean(),
      Product.aggregate([{ $match: { IsActive: true } }, { $group: { _id: "$ScentFamily", count: { $sum: 1 }, sold: { $sum: "$SoldCount" } } }]),
    ]);
    const byName = new Map(counts.map((c: { _id: string; count: number; sold: number }) => [c._id, c]));
    ok(res, families.map((f) => ({
      id: String(f._id), name: f.Name, nameVi: f.NameVi ?? null, description: f.Description,
      keyNotes: f.KeyNotes ?? null, vibe: f.Vibe ?? null,
      imageUrl: f.ImageUrl, correlated: f.CorrelatedFamilies, productCount: byName.get(f.Name)?.count ?? 0,
      soldCount: byName.get(f.Name)?.sold ?? 0, order: f.DisplayOrder,
    })));
  })
);

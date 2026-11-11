/**
 * Ánh xạ câu trả lời Scent Quiz 8 bước → hồ sơ mùi hương chuẩn hóa.
 * Hàm thuần (không truy cập CSDL) để kiểm thử độc lập — UC-QUIZ-001.
 *   BR-QUIZ-002: điểm nhóm hương   BR-QUIZ-003: hoàn cảnh, độ tỏa, dung tích
 */
import { z } from "zod";
import { SCENTORY_FAMILIES, type ScentoryFamily } from "../cau-hinh/scentMatch";
import { QUIZ_AGE_MAX, QUIZ_AGE_MIN } from "../cau-hinh/nghiepVu";

export const QuizAnswersSchema = z.object({
  style: z.enum(["feminine", "masculine"]),
  includeUnisex: z.boolean(),
  tone: z.enum(["warm_opulent", "fresh_clean"]),
  mood: z.enum(["night_party", "day_energy", "mindful_relax"]),
  aura: z.enum(["bold", "soft"]),
  habit: z.enum(["scent_shifter", "daily_spritzer"]),
  age: z.coerce.number().int().min(QUIZ_AGE_MIN).max(QUIZ_AGE_MAX),
});
export type QuizAnswersInput = z.infer<typeof QuizAnswersSchema>;

/** Nhóm hương theo tông hương (+2). */
export const TONE_FAMILIES: Record<QuizAnswersInput["tone"], ScentoryFamily[]> = {
  warm_opulent: ["Woody", "Oriental/Amber", "Chypre", "Gourmand"],
  fresh_clean: ["Fresh/Citrus", "Aromatic", "Floral", "Fougère"],
};
/** Nhóm hương đặc trưng của phong cách (+1, phong cách đối lập −1 khi không chọn Unisex). */
export const STYLE_FAMILIES: Record<QuizAnswersInput["style"], ScentoryFamily[]> = {
  feminine: ["Floral", "Gourmand", "Chypre"],
  masculine: ["Woody", "Fougère", "Oriental/Amber"],
};
export const MOOD_OCCASIONS: Record<QuizAnswersInput["mood"], string[]> = {
  night_party: ["Tiệc tối", "Hẹn hò"],
  day_energy: ["Hàng ngày", "Công sở"],
  mindful_relax: ["Hàng ngày", "Du lịch"],
};
export const AURA_PROJECTION: Record<QuizAnswersInput["aura"], "Mạnh" | "Nhẹ"> = { bold: "Mạnh", soft: "Nhẹ" };
export const HABIT_VOLUME: Record<QuizAnswersInput["habit"], "50ml" | "100ml"> = {
  scent_shifter: "50ml",
  daily_spritzer: "100ml",
};

const BASE = 2;
const clamp = (v: number) => Math.max(1, Math.min(5, v));

export interface DerivedProfile {
  familyRatings: Record<ScentoryFamily, number>;
  preferredFamilies: ScentoryFamily[];
  expectedOccasion: string;
  preferredProjection: "Mạnh" | "Nhẹ";
  preferredVolume: "50ml" | "100ml";
  profileTitle: string;
  profileLede: string;
}

const TITLES: Record<string, [string, string]> = {
  "warm|feminine": ["Hổ Phách Quyến Rũ", "Sắc thái ấm áp, nồng nàn với hổ phách, vani và hoa hồng quyến rũ."],
  "warm|masculine": ["Trầm Mộc Quý Phái", "Hương gỗ ấm, khói nhẹ và da thuộc — chiều sâu sang trọng, bền bỉ."],
  "fresh|feminine": ["Hoa Cỏ Thanh Khiết", "Làn hương trong trẻo như sương mai với diên vĩ, hoa cam và xạ hương êm dịu."],
  "fresh|masculine": ["Bách Xù & Rêu Phong", "Phong thái phóng khoáng từ cam chanh, quả bách xù và gỗ tuyết tùng."],
};

export function deriveProfile(a: QuizAnswersInput): DerivedProfile {
  const ratings = Object.fromEntries(SCENTORY_FAMILIES.map((f) => [f, BASE])) as Record<ScentoryFamily, number>;
  for (const f of TONE_FAMILIES[a.tone]) ratings[f] += 2;
  for (const f of STYLE_FAMILIES[a.style]) ratings[f] += 1;
  if (!a.includeUnisex) {
    const opposite = a.style === "feminine" ? "masculine" : "feminine";
    for (const f of STYLE_FAMILIES[opposite]) ratings[f] -= 1;
  }
  for (const f of SCENTORY_FAMILIES) ratings[f] = clamp(ratings[f]);
  const preferred = SCENTORY_FAMILIES.filter((f) => ratings[f] >= 4).sort((x, y) => ratings[y] - ratings[x]);
  const [title, lede] = TITLES[`${a.tone === "warm_opulent" ? "warm" : "fresh"}|${a.style}`];
  return {
    familyRatings: ratings,
    preferredFamilies: preferred,
    expectedOccasion: MOOD_OCCASIONS[a.mood].join(", "),
    preferredProjection: AURA_PROJECTION[a.aura],
    preferredVolume: HABIT_VOLUME[a.habit],
    profileTitle: title,
    profileLede: lede,
  };
}

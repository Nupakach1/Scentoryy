import { Schema, model, type Types } from "mongoose";

/**
 * Hồ sơ mùi hương — collection `ScentProfiles` (1–1 với Users).
 * Tạo rỗng khi đăng ký (BR-ACC-002), điền khi hoàn thành Scent Quiz (BR-QUIZ-002..004),
 * điều chỉnh theo hành vi (BR-MTCH-005). Admin chỉ đọc.
 */
export interface QuizAnswers {
  Style: "feminine" | "masculine";
  IncludeUnisex: boolean;
  Tone: "warm_opulent" | "fresh_clean";
  Mood: "night_party" | "day_energy" | "mindful_relax";
  Aura: "bold" | "soft";
  Habit: "scent_shifter" | "daily_spritzer";
  Age: number;
}

export interface ScentProfileDoc {
  UserID: Types.ObjectId;
  QuizAnswers?: QuizAnswers | null;
  PreferredFamilies?: string | null;
  FamilyRatings?: Map<string, number> | null;
  PreferredProjection?: string | null;
  ExpectedOccasion?: string | null;
  PreferredVolume?: string | null;
  BudgetRange?: string | null;
  ProfileTitle?: string | null;
  BehaviorScores?: Map<string, number> | null;
  BehaviorAdjustments?: Map<string, number> | null;
  LearnedAt?: Date | null;
  IsCompleted: boolean;
  UpdatedAt: Date;
}

const ScentProfileSchema = new Schema<ScentProfileDoc>(
  {
    UserID: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    QuizAnswers: {
      type: new Schema(
        {
          Style: { type: String, enum: ["feminine", "masculine"], required: true },
          IncludeUnisex: { type: Boolean, required: true },
          Tone: { type: String, enum: ["warm_opulent", "fresh_clean"], required: true },
          Mood: { type: String, enum: ["night_party", "day_energy", "mindful_relax"], required: true },
          Aura: { type: String, enum: ["bold", "soft"], required: true },
          Habit: { type: String, enum: ["scent_shifter", "daily_spritzer"], required: true },
          Age: { type: Number, min: 16, max: 80, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    PreferredFamilies: { type: String, trim: true, maxlength: 255, default: null },
    FamilyRatings: { type: Map, of: { type: Number, min: 1, max: 5 }, default: null },
    PreferredProjection: { type: String, enum: ["Nhẹ", "Vừa", "Mạnh", null], default: null },
    ExpectedOccasion: { type: String, trim: true, maxlength: 255, default: null },
    PreferredVolume: { type: String, enum: ["50ml", "100ml", null], default: null },
    BudgetRange: { type: String, trim: true, maxlength: 100, default: null },
    ProfileTitle: { type: String, trim: true, maxlength: 100, default: null },
    BehaviorScores: { type: Map, of: Number, default: null },
    BehaviorAdjustments: { type: Map, of: Number, default: null },
    LearnedAt: { type: Date, default: null },
    IsCompleted: { type: Boolean, default: false },
    UpdatedAt: { type: Date, default: Date.now },
  },
  { collection: "ScentProfiles", timestamps: false }
);

export const ScentProfile = model<ScentProfileDoc>("ScentProfile", ScentProfileSchema, "ScentProfiles");

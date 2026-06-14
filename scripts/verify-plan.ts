/**
 * Read-only sanity check for the Phase 3 generator (pnpm tsx scripts/verify-plan.ts).
 * Pulls the real selectable catalog foods and runs the deterministic generator,
 * printing the resulting day. No writes, no user impersonation - just confirms
 * the generator produces a coherent plan from live catalog data + categories.
 */
import { config } from 'dotenv';
import postgres from 'postgres';

import { generateMealPlan, type PlanFoodInput } from '../src/lib/nutrition/meal-plan';

config({ path: '.env.local' });

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error('DATABASE_URL_DIRECT required');
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

  try {
    const rows = await sql<
      { id: string; name_es: string; category: string; calories: string; protein: string; carbs: string; fat: string }[]
    >`select id, name_es, category, calories, protein, carbs, fat
      from public.foods where category <> 'other' order by category, name_es`;

    const byCat = (c: string, n: number): PlanFoodInput[] =>
      rows
        .filter((r) => r.category === c)
        .slice(0, n)
        .map((r) => ({
          id: r.id,
          nameEs: r.name_es,
          category: r.category as PlanFoodInput['category'],
          per100g: {
            calories: Number(r.calories),
            protein: Number(r.protein),
            carbs: Number(r.carbs),
            fat: Number(r.fat),
          },
        }));

    const foods = [
      ...byCat('protein', 2),
      ...byCat('grain', 2),
      ...byCat('vegetable', 2),
      ...byCat('fruit', 1),
      ...byCat('fat', 1),
      ...byCat('dairy', 1),
    ];
    console.log(`Selectable catalog foods used: ${foods.length}`);

    const plan = generateMealPlan({
      calorieTarget: 2000,
      macros: { protein: 150, carbs: 200, fat: 67 },
      mealsPerDay: 4,
      mainMeals: 3,
      foods,
    });

    console.log(
      `Plan: ${plan.meals.length} meals, day total ${Math.round(plan.totals.calories)} kcal / ` +
        `${Math.round(plan.totals.protein)}P ${Math.round(plan.totals.carbs)}C ${Math.round(plan.totals.fat)}F`,
    );
    for (const meal of plan.meals) {
      console.log(`  [${meal.mealType}] ${Math.round(meal.totals.calories)} kcal`);
      for (const item of meal.items) {
        console.log(`    - ${item.nameEs}: ${Math.round(item.grams)} g / ${Math.round(item.calories)} kcal`);
      }
    }
    console.log('\nGenerator runs cleanly on live catalog data.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error('verify-plan failed:', err);
  process.exit(1);
});
